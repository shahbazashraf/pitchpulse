import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/providers/registry";
import { cache, CacheKey, TTL } from "@/lib/cache";
import { wc2026Provider } from "@/lib/providers/wc2026";
import { getFixturesByDate, WC_TEAMS } from "@/lib/worldcup2026/data";
import { enrichWCMatch } from "@/lib/worldcup2026/espnSync";
import { EspnProvider } from "@/lib/providers/espn";

export const runtime = "edge";

function getTzOffsetMs(date: Date, timeZone: string): number {
  const dateWithZeroMs = new Date(date);
  dateWithZeroMs.setUTCMilliseconds(0);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(dateWithZeroMs);
  const getPart = (type: string) => parseInt(parts.find((p) => p.type === type)!.value, 10);

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  let hour = getPart("hour");
  if (hour === 24) hour = 0;
  const minute = getPart("minute");
  const second = getPart("second");

  const utcDateInTz = Date.UTC(year, month - 1, day, hour, minute, second);
  return utcDateInTz - dateWithZeroMs.getTime();
}

function getUtcRangeForLocalDate(dateStr: string, timeZone: string) {
  const utcMidnight = new Date(`${dateStr}T00:00:00Z`);
  const offsetStart = getTzOffsetMs(utcMidnight, timeZone);
  const start = new Date(utcMidnight.getTime() - offsetStart);

  const utcEndOfDay = new Date(`${dateStr}T23:59:59.999Z`);
  const offsetEnd = getTzOffsetMs(utcEndOfDay, timeZone);
  const end = new Date(utcEndOfDay.getTime() - offsetEnd);

  const startUtcStr = start.toISOString().slice(0, 10);
  const endUtcStr = end.toISOString().slice(0, 10);

  const utcDates = [startUtcStr];
  if (endUtcStr !== startUtcStr) {
    utcDates.push(endUtcStr);
  }

  return { start, end, utcDates };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const competitions = searchParams.get("competitions")?.split(",").filter(Boolean);
  const timezone = searchParams.get("timezone") ?? "UTC";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 });
  }

  try {
    const { start, end, utcDates } = getUtcRangeForLocalDate(date, timezone);
    const todayUtc = new Date().toISOString().slice(0, 10);

    // Fetch matches for all overlapping UTC dates in parallel
    const results = await Promise.all(
      utcDates.map((utcDate) => {
        const cacheKey = CacheKey.matchesByDate(utcDate, competitions);
        const isTodayOrNear = utcDate === todayUtc;

        return cache.getOrFetch(
          cacheKey,
          async () => {
            const [wcMatches, registryResult] = await Promise.allSettled([
              fetchWCMatchesByDate(utcDate),
              getRegistry().getMatchesByDate(utcDate, competitions),
            ]);

            const wc = wcMatches.status === "fulfilled" ? wcMatches.value : [];
            const registryMatches = registryResult.status === "fulfilled" ? (registryResult.value.data ?? []) : [];

            // Strip WC from registry only when we have our own WC data (ESPN or static fallback).
            // fetchWCMatchesByDate always falls back to static, so wc is non-empty whenever WC
            // fixtures exist for this date — safe to always strip duplicates from registry.
            const others = wc.length > 0
              ? registryMatches.filter((m) => m.competitionId !== "fifa-world-cup-2026")
              : registryMatches;

            // De-duplicate remaining by team name pair (safety net)
            const wcIds = new Set(wc.map((m: any) => `${m.homeTeam?.name}|${m.awayTeam?.name}`));
            const filteredOthers = others.filter(
              (m) => !wcIds.has(`${m.homeTeam.name}|${m.awayTeam.name}`),
            );

            return [...wc, ...filteredOthers].map(enrichWCMatch);
          },
          isTodayOrNear ? TTL.UPCOMING_MATCHES : TTL.COMPETITION,
        );
      })
    );

    // Merge all fetched matches and filter by the local day's range
    const allMatches = results.flat();
    const filteredMatches = allMatches.filter((m) => {
      const matchTime = new Date(m.startTime).getTime();
      return matchTime >= start.getTime() && matchTime <= end.getTime();
    });

    let isLocalToday = false;
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
      const parts = formatter.formatToParts(new Date());
      const getPart = (type: string) => parts.find((p) => p.type === type)!.value;
      const localTodayStr = `${getPart("year")}-${getPart("month").padStart(2, "0")}-${getPart("day").padStart(2, "0")}`;
      isLocalToday = date === localTodayStr;
    } catch {
      isLocalToday = date === new Date().toISOString().split("T")[0];
    }

    return NextResponse.json(
      { matches: filteredMatches, date, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${isLocalToday ? TTL.UPCOMING_MATCHES : 3600}, stale-while-revalidate=60`,
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch matches" },
      { status: 503 },
    );
  }
}


async function fetchWCMatchesByDate(date: string) {
  // 1. ESPN directly — NormalizedMatch has real status + scores
  try {
    const espn = new EspnProvider();
    const result = await espn.getMatchesByDate(date, ["fifa-world-cup-2026"]);
    if (result.data?.length) return result.data;
  } catch {
    // fall through
  }

  // 2. Try wc2026api.com
  if (wc2026Provider.isConfigured) {
    try {
      const raw = await wc2026Provider.getMatchesByDate(date);
      if (raw.length > 0) return raw.map(normalizeWCMatch);
    } catch {
      // fall through to static
    }
  }

  // 3. Static seed fallback
  const fixtures = getFixturesByDate(date);
  return fixtures.map((f) => {
    const home = WC_TEAMS[f.homeTeamCode];
    const away = WC_TEAMS[f.awayTeamCode];
    return {
      id: `wc2026:static:${f.id}`,
      provider: "wc2026-static",
      providerId: f.id,
      competitionId: "fifa-world-cup-2026",
      season: "2026",
      round: f.group ? `Group ${f.group}` : f.stage,
      roundType: f.stage === "group" ? "group" : f.stage,
      group: f.group ?? null,
      homeTeam: makeTeam(home, f.homeTeamCode),
      awayTeam: makeTeam(away, f.awayTeamCode),
      homeScore: null, awayScore: null,
      homeScoreHT: null, awayScoreHT: null,
      homeScoreET: null, awayScoreET: null,
      homePenalties: null, awayPenalties: null,
      status: "NS",
      minute: null, injuryTime: null,
      venue: { id: "", name: f.venue, city: f.city, country: f.country, capacity: null, surface: null, imageUrl: null },
      referee: null,
      startTime: f.kickoffUtc,
      timezone: "UTC",
      events: [], stats: null, lineups: null,
      updatedAt: new Date().toISOString(),
    };
  });
}

function makeTeam(t: any, code: string) {
  return {
    id: `wc2026:${code}`,
    provider: "wc2026",
    providerId: code,
    name: t?.name ?? code,
    shortName: t?.shortName ?? code,
    code: t?.code ?? code,
    country: t?.name ?? "",
    countryCode: t?.code ?? code,
    logoUrl: null,
    flag: t?.flag ?? "🏳️",
  };
}

function normalizeWCMatch(m: any) {
  const home = Object.values(WC_TEAMS).find((t) => t.name === m.homeTeam || t.code === m.homeTeam);
  const away = Object.values(WC_TEAMS).find((t) => t.name === m.awayTeam || t.code === m.awayTeam);
  return {
    id: `wc2026:${m.id}`,
    provider: "wc2026",
    providerId: m.id,
    competitionId: "fifa-world-cup-2026",
    season: "2026",
    round: m.stage ?? "Group Stage",
    roundType: m.group ? "group" : "other",
    group: m.group ?? null,
    homeTeam: makeTeam(home, m.homeTeam),
    awayTeam: makeTeam(away, m.awayTeam),
    homeScore: m.homeScore ?? null, awayScore: m.awayScore ?? null,
    homeScoreHT: null, awayScoreHT: null,
    homeScoreET: null, awayScoreET: null,
    homePenalties: null, awayPenalties: null,
    status: normalizeStatus(m.status, m.minute),
    minute: m.minute ?? null, injuryTime: null,
    venue: m.venue ? { id: "", name: m.venue, city: m.city ?? "", country: "", capacity: null, surface: null, imageUrl: null } : null,
    referee: null,
    startTime: m.kickoff,
    timezone: "UTC",
    events: [], stats: null, lineups: null,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeStatus(status: string, minute?: number | null): string {
  const s = status?.toLowerCase();
  if (s === "live") return minute && minute > 45 ? "2H" : "1H";
  if (s === "halftime") return "HT";
  if (s === "finished") return "FT";
  return "NS";
}
