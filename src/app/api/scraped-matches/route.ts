import { NextRequest, NextResponse } from "next/server";
import { cache, TTL } from "@/lib/cache";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const runtime = "nodejs";

export interface ScrapedStream {
  url: string;
  embed_url: string | null;
  quality: string;
  source: string;
  priority: number;
}

export interface ScrapedMatch {
  id: string;
  title: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  status: "NS" | "LIVE" | "FT";
  score: { home: number; away: number } | null;
  minute: string | null;
  startTime: string | null;
  isLive: boolean;
  streams: ScrapedStream[];
  scrapedAt: string;
}

function getDb() {
  if (!getApps().length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (sa) initializeApp({ credential: cert(JSON.parse(sa)) });
    else initializeApp();
  }
  return getFirestore();
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get("status"); // LIVE | NS | FT | null = all
  const cacheKey = `scraped-matches:${statusFilter ?? "all"}`;

  try {
    const data = await cache.getOrFetch<ScrapedMatch[]>(
      cacheKey,
      async () => {
        const db = getDb();
        // Only return matches scraped in the last 3 hours to avoid stale data
        const staleThreshold = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

        let query = db
          .collection("scraped_matches")
          .where("scrapedAt", ">=", staleThreshold)
          .orderBy("scrapedAt", "desc") as FirebaseFirestore.Query;

        const snap = await query.limit(100).get();

        const matches: ScrapedMatch[] = snap.docs.map((d) => {
          const doc = d.data();
          return {
            id: doc.id ?? d.id,
            title: doc.title ?? "",
            homeTeam: doc.homeTeam ?? "",
            awayTeam: doc.awayTeam ?? "",
            competition: doc.competition ?? "Football",
            status: doc.status ?? "NS",
            score: doc.score ?? null,
            minute: doc.minute ?? null,
            startTime: doc.startTime ?? null,
            isLive: doc.isLive ?? false,
            streams: (doc.streams ?? []) as ScrapedStream[],
            scrapedAt: doc.scrapedAt ?? "",
          };
        });

        // Apply status filter after fetch (simpler than Firestore filtering)
        return statusFilter
          ? matches.filter((m) => m.status === statusFilter)
          : matches;
      },
      TTL.LIVE_MATCH, // 15s — fast refresh for live data
    );

    const live     = data.filter((m) => m.status === "LIVE");
    const upcoming = data.filter((m) => m.status === "NS");
    const finished = data.filter((m) => m.status === "FT");

    return NextResponse.json(
      {
        matches: data,
        grouped: { live, upcoming, finished },
        total: data.length,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${TTL.LIVE_MATCH}, stale-while-revalidate=30`,
        },
      },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err), matches: [], grouped: { live: [], upcoming: [], finished: [] } }, { status: 503 });
  }
}
