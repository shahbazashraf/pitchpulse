import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/providers/registry";
import { cache, CacheKey, TTL } from "@/lib/cache";
import { wc2026Provider } from "@/lib/providers/wc2026";
import { getFixturesByDate, WC_TEAMS } from "@/lib/worldcup2026/data";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const competitions = searchParams.get("competitions")?.split(",").filter(Boolean);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 });
  }

  const cacheKey = CacheKey.matchesByDate(date, competitions);
  const isToday = date === new Date().toISOString().split("T")[0];

  try {
    const data = await cache.getOrFetch(
      cacheKey,
      async () => {
        const [wcMatches, registryResult] = await Promise.allSettled([
          fetchWCMatchesByDate(date),
          getRegistry().getMatchesByDate(date, competitions),
        ]);

        const wc = wcMatches.status === "fulfilled" ? wcMatches.value : [];
        const others = registryResult.status === "fulfilled" ? (registryResult.value.data ?? []) : [];

        // De-duplicate: WC matches take priority
        const wcIds = new Set(wc.map((m: any) => `${m.homeTeam?.name}|${m.awayTeam?.name}`));
        const filteredOthers = others.filter(
          (m) => !wcIds.has(`${m.homeTeam.name}|${m.awayTeam.name}`),
        );

        return [...wc, ...filteredOthers];
      },
      isToday ? TTL.UPCOMING_MATCHES : TTL.COMPETITION,
    );

    return NextResponse.json(
      { matches: data, date, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${isToday ? TTL.UPCOMING_MATCHES : 3600}, stale-while-revalidate=60`,
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
  // Try live API first
  if (wc2026Provider.isConfigured) {
    try {
      const raw = await wc2026Provider.getMatchesByDate(date);
      if (raw.length > 0) return raw.map(normalizeWCMatch);
    } catch {
      // fall through to static
    }
  }

  // Static seed fallback
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
