import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/providers/registry";
import { cache, CacheKey, TTL } from "@/lib/cache";
import { wc2026Provider } from "@/lib/providers/wc2026";
import { WC_GROUPS, WC_TEAMS } from "@/lib/worldcup2026/data";

export const runtime = "edge";

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
        TTL.STANDINGS,
      );
      return NextResponse.json(
        { standings: data, competitionId, fetchedAt: new Date().toISOString() },
        { headers: { "Cache-Control": `public, s-maxage=${TTL.STANDINGS}, stale-while-revalidate=60` } },
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
      // fall through to static data
    }
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
