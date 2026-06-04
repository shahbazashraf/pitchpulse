import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/providers/registry";
import { cache, CacheKey, TTL } from "@/lib/cache";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const competitions = searchParams.get("competitions")?.split(",").filter(Boolean);

  const cacheKey = CacheKey.liveMatches(competitions);

  try {
    const data = await cache.getOrFetch(
      cacheKey,
      async () => {
        const registry = getRegistry();
        const result = await registry.getLiveMatches(competitions);
        if (result.error && !result.data) {
          throw new Error(result.error);
        }
        return result.data ?? [];
      },
      TTL.LIVE_MATCH,
    );

    return NextResponse.json(
      { matches: data, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${TTL.LIVE_MATCH}, stale-while-revalidate=10`,
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch live matches" },
      { status: 503 },
    );
  }
}
