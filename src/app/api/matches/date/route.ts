import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/providers/registry";
import { cache, CacheKey, TTL } from "@/lib/cache";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const competitions = searchParams.get("competitions")?.split(",").filter(Boolean);

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 });
  }

  const cacheKey = CacheKey.matchesByDate(date, competitions);
  const isToday = date === new Date().toISOString().split("T")[0];

  try {
    const data = await cache.getOrFetch(
      cacheKey,
      async () => {
        const result = await getRegistry().getMatchesByDate(date, competitions);
        return result.data ?? [];
      },
      isToday ? TTL.UPCOMING_MATCHES : TTL.COMPETITION, // older dates cache longer
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
