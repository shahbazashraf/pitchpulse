import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/providers/registry";
import { cache, CacheKey, TTL } from "@/lib/cache";
import { wc2026Provider } from "@/lib/providers/wc2026";
import { EspnProvider } from "@/lib/providers/espn";
import { WC_GROUPS, WC_TEAMS } from "@/lib/worldcup2026/data";

const WC_START_DATE = "2026-06-11";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const competitionId = searchParams.get("competition");
  const season = searchParams.get("season") ?? undefined;

  if (!competitionId) {
    return NextResponse.json({ error: "competition param required" }, { status: 400 });
  }

  const cacheKey = CacheKey.standings(competitionId, season);

  try {
    // ── World Cup: use WC2026 provider (priority 0) ──────────────────────────
    if (competitionId === "fifa-world-cup-2026") {
      const data = await cache.getOrFetch(
        cacheKey,
        () => fetchWCStandings(),
        60,
      );
      return NextResponse.json(
        { standings: data, competitionId, fetchedAt: new Date().toISOString() },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } },
      );
    }

    // ── Other competitions: use provider registry ────────────────────────────
    const data = await cache.getOrFetch(
      cacheKey,
      async () => {
        const result = await getRegistry().getStandings(competitionId, season);
        return result.data ?? [];
      },
      TTL.STANDINGS,
    );

    return NextResponse.json(
      { standings: data, competitionId, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": `public, s-maxage=${TTL.STANDINGS}, stale-while-revalidate=60` } },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}

/**
 * Fetch WC standings — tries wc2026api.com first, falls back to static seed data.
 */
async function fetchWCStandings() {
  // Try live API first
  if (wc2026Provider.isConfigured) {
    try {
      const liveStandings = await wc2026Provider.getStandings();
      if (liveStandings.length > 0) {
        return liveStandings.map((s) => ({
          competitionId: "fifa-world-cup-2026",
          season: "2026",
          group: s.group,
          entries: s.entries.map((e) => ({
            rank:           e.position,
            team: {
              id:        `wc2026:${e.team}`,
              name:      e.team,
              shortName: e.team,
              code:      e.team.substring(0, 3).toUpperCase(),
              flag:      e.flag,
            },
            played:         e.played,
            win:            e.won,
            draw:           e.drawn,
            lose:           e.lost,
            goalsFor:       e.goalsFor,
            goalsAgainst:   e.goalsAgainst,
            goalDifference: e.goalDifference,
            points:         e.points,
            form:           e.form,
            status:         null,
            description:    null,
          })),
        }));
      }
    } catch {
      // fall through to ESPN
    }
  }

  // ESPN fallback — compute standings from completed group-stage match results
  try {
    const computed = await computeStandingsFromResults();
    if (computed) return computed;
  } catch {
    // fall through to static data
  }

  // Static seed data fallback — always works, zero API calls
  return WC_GROUPS.map((group) => ({
    competitionId: "fifa-world-cup-2026",
    season: "2026",
    group: group.id,
    entries: group.teams.map((code, i) => {
      const team = WC_TEAMS[code];
      return {
        rank: i + 1,
        team: {
          id:        `static:${code}`,
          name:      team?.name ?? code,
          shortName: team?.shortName ?? code,
          code,
          flag:      team?.flag ?? "🏳️",
        },
        played: 0,
        win: 0,
        draw: 0,
        lose: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        form: null,
        status: null,
        description: null,
      };
    }),
  }));
}

type TeamRow = {
  group: string;
  name: string;
  shortName: string;
  code: string;
  flag: string;
  played: number;
  win: number;
  draw: number;
  lose: number;
  gf: number;
  ga: number;
  pts: number;
};

async function computeStandingsFromResults() {
  const espn = new EspnProvider();
  const start = new Date(WC_START_DATE);
  const today = new Date();
  const dates: string[] = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  const dayResults = await Promise.allSettled(
    dates.map((d) => espn.getMatchesByDate(d, ["fifa-world-cup-2026"])),
  );

  const completedGroupMatches = dayResults
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof espn.getMatchesByDate>>> => r.status === "fulfilled")
    .flatMap((r) => r.value.data ?? [])
    .filter((m) => (m.roundType === "group" || Boolean(m.group)) && ["FT", "AET", "PEN"].includes(m.status));

  if (!completedGroupMatches.length) return null;

  const rows: Record<string, TeamRow> = {};

  for (const m of completedGroupMatches) {
    const group = m.group ?? "?";
    const hCode = m.homeTeam.code;
    const aCode = m.awayTeam.code;
    const hGoals = m.homeScore ?? 0;
    const aGoals = m.awayScore ?? 0;
    const hTeam = m.homeTeam as typeof m.homeTeam & { flag?: string };
    const aTeam = m.awayTeam as typeof m.awayTeam & { flag?: string };

    if (!rows[hCode]) rows[hCode] = { group, name: hTeam.name, shortName: hTeam.shortName, code: hCode, flag: hTeam.flag ?? WC_TEAMS[hCode]?.flag ?? "", played: 0, win: 0, draw: 0, lose: 0, gf: 0, ga: 0, pts: 0 };
    if (!rows[aCode]) rows[aCode] = { group, name: aTeam.name, shortName: aTeam.shortName, code: aCode, flag: aTeam.flag ?? WC_TEAMS[aCode]?.flag ?? "", played: 0, win: 0, draw: 0, lose: 0, gf: 0, ga: 0, pts: 0 };

    rows[hCode].played++;
    rows[aCode].played++;
    rows[hCode].gf += hGoals;
    rows[hCode].ga += aGoals;
    rows[aCode].gf += aGoals;
    rows[aCode].ga += hGoals;

    if (hGoals > aGoals) {
      rows[hCode].win++; rows[hCode].pts += 3; rows[aCode].lose++;
    } else if (hGoals < aGoals) {
      rows[aCode].win++; rows[aCode].pts += 3; rows[hCode].lose++;
    } else {
      rows[hCode].draw++; rows[hCode].pts++;
      rows[aCode].draw++; rows[aCode].pts++;
    }
  }

  const byGroup: Record<string, TeamRow[]> = {};
  for (const row of Object.values(rows)) {
    if (!byGroup[row.group]) byGroup[row.group] = [];
    byGroup[row.group].push(row);
  }

  // Fill in teams that haven't played yet from WC_GROUPS (so all 4 per group appear)
  for (const group of WC_GROUPS) {
    if (!byGroup[group.id]) byGroup[group.id] = [];
    for (const code of group.teams) {
      if (!rows[code]) {
        const t = WC_TEAMS[code];
        byGroup[group.id].push({ group: group.id, name: t?.name ?? code, shortName: t?.shortName ?? code, code, flag: t?.flag ?? "", played: 0, win: 0, draw: 0, lose: 0, gf: 0, ga: 0, pts: 0 });
      }
    }
  }

  return Object.entries(byGroup).map(([group, teams]) => ({
    competitionId: "fifa-world-cup-2026",
    season: "2026",
    group,
    entries: teams
      .sort((a, b) => (b.pts - a.pts) || (b.gf - b.ga - (a.gf - a.ga)) || (b.gf - a.gf))
      .map((t, i) => ({
        rank: i + 1,
        team: {
          id: `espn:${t.code}`,
          name: t.name,
          shortName: t.shortName,
          code: t.code,
          flag: t.flag || WC_TEAMS[t.code]?.flag || "",
        },
        played: t.played,
        win: t.win,
        draw: t.draw,
        lose: t.lose,
        goalsFor: t.gf,
        goalsAgainst: t.ga,
        goalDifference: t.gf - t.ga,
        points: t.pts,
        form: null,
        status: null,
        description: null,
      })),
  }));
}
