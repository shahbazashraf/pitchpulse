import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/providers/registry";
import { cache, CacheKey, TTL } from "@/lib/cache";

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
