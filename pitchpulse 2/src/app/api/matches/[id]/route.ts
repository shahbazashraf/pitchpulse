import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/providers/registry";
import { cache, CacheKey, TTL } from "@/lib/cache";

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
