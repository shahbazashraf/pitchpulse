import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/providers/registry";
import { cache, CacheKey, TTL } from "@/lib/cache";
import { WC_FIXTURES, WC_TEAMS } from "@/lib/worldcup2026/data";

export const runtime = "edge";

// PHASE 1 FIX: Next.js 15 made route params a Promise — must await them.
interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const include = searchParams.get("include")?.split(",") ?? [];

  try {
    const staticMatch = getStaticWCMatch(id);
    if (staticMatch) {
      return NextResponse.json(
        { match: staticMatch, fetchedAt: new Date().toISOString() },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } },
      );
    }

    const registry = getRegistry();

    const [matchResult, eventsResult, statsResult, lineupsResult] = await Promise.all([
      cache.getOrFetch(CacheKey.match(id), () => registry.getMatch(id).then(r => r.data), TTL.LIVE_MATCH),
      include.includes("events")
        ? cache.getOrFetch(CacheKey.matchEvents(id), () => registry.getMatchEvents(id).then(r => r.data), TTL.MATCH_EVENTS)
        : Promise.resolve(null),
      include.includes("stats")
        ? cache.getOrFetch(CacheKey.matchStats(id), () => registry.getMatchStats(id).then(r => r.data), TTL.MATCH_STATS)
        : Promise.resolve(null),
      include.includes("lineups")
        ? cache.getOrFetch(CacheKey.matchLineups(id), () => registry.getMatchLineups(id).then(r => r.data), TTL.MATCH_LINEUPS)
        : Promise.resolve(null),
    ]);

    if (!matchResult) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const match = {
      ...matchResult,
      events: eventsResult ?? matchResult.events,
      stats: statsResult ?? matchResult.stats,
      lineups: lineupsResult ?? matchResult.lineups,
    };

    const isLive = ["1H", "HT", "2H", "ET", "P"].includes(match.status);

    return NextResponse.json(
      { match, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": isLive
            ? `public, s-maxage=${TTL.LIVE_MATCH}, stale-while-revalidate=10`
            : `public, s-maxage=60, stale-while-revalidate=300`,
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch match" },
      { status: 503 },
    );
  }
}

function getStaticWCMatch(id: string) {
  if (!id.startsWith("wc2026:static:")) return null;

  const fixtureId = id.replace("wc2026:static:", "");
  const fixture = WC_FIXTURES.find((f) => f.id === fixtureId);
  if (!fixture) return null;

  const home = WC_TEAMS[fixture.homeTeamCode];
  const away = WC_TEAMS[fixture.awayTeamCode];

  return {
    id,
    provider: "wc2026-static",
    providerId: fixture.id,
    competitionId: "fifa-world-cup-2026",
    season: "2026",
    round: fixture.group ? `Group ${fixture.group}` : fixture.stage,
    roundType: fixture.stage,
    group: fixture.group,
    homeTeam: {
      id: `wc2026:${fixture.homeTeamCode}`,
      provider: "wc2026",
      providerId: fixture.homeTeamCode,
      name: home?.name ?? fixture.homeTeamCode,
      shortName: home?.shortName ?? fixture.homeTeamCode,
      code: home?.code ?? fixture.homeTeamCode,
      country: home?.name ?? "",
      countryCode: home?.code ?? fixture.homeTeamCode,
      logoUrl: null,
      flag: home?.flag ?? "🏳️",
    },
    awayTeam: {
      id: `wc2026:${fixture.awayTeamCode}`,
      provider: "wc2026",
      providerId: fixture.awayTeamCode,
      name: away?.name ?? fixture.awayTeamCode,
      shortName: away?.shortName ?? fixture.awayTeamCode,
      code: away?.code ?? fixture.awayTeamCode,
      country: away?.name ?? "",
      countryCode: away?.code ?? fixture.awayTeamCode,
      logoUrl: null,
      flag: away?.flag ?? "🏳️",
    },
    homeScore: null,
    awayScore: null,
    homeScoreHT: null,
    awayScoreHT: null,
    homeScoreET: null,
    awayScoreET: null,
    homePenalties: null,
    awayPenalties: null,
    status: "NS",
    minute: null,
    injuryTime: null,
    venue: {
      id: "",
      name: fixture.venue,
      city: fixture.city,
      country: fixture.country,
      capacity: null,
      surface: null,
      imageUrl: null,
    },
    referee: null,
    startTime: fixture.kickoffUtc,
    timezone: "UTC",
    events: [],
    stats: null,
    lineups: null,
    updatedAt: new Date().toISOString(),
  };
}
