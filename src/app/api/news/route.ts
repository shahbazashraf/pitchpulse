import { NextRequest, NextResponse } from "next/server";
import { cache, TTL } from "@/lib/cache";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { NewsArticle } from "@/types";

export const runtime = "nodejs";

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
  const source = searchParams.get("source");
  const limit = Math.min(Number(searchParams.get("limit") ?? 40), 100);
  const cacheKey = `news:${source ?? "all"}:${limit}`;

  try {
    const data = await cache.getOrFetch(
      cacheKey,
      async () => {
        try {
          const db = getDb();
          let query = db
            .collection("articles")
            .orderBy("publishedAt", "desc")
            .limit(limit);

          if (source) query = query.where("source", "==", source) as any;

          const snap = await query.get();
          const articles = snap.docs.map((d) => d.data());
          return articles.length ? articles : getStubNews(source).slice(0, limit);
        } catch {
          return getStubNews(source).slice(0, limit);
        }
      },
      TTL.NEWS,
    );

    return NextResponse.json(
      { articles: data, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": `public, s-maxage=${TTL.NEWS}, stale-while-revalidate=60` } },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}

function getStubNews(source?: string | null): NewsArticle[] {
  const now = new Date().toISOString();
  const articles: NewsArticle[] = [
    {
      id: "stub-fifa-wc26",
      headline: "World Cup 2026 hub is ready for live fixtures",
      summary: "PitchPulse is tracking World Cup groups, fixtures, standings, official streams, and match commentary from the Phase 2 local data layer.",
      body: null,
      source: "fifa",
      sourceName: "FIFA",
      sourceLogoUrl: null,
      author: null,
      imageUrl: null,
      url: "https://www.fifa.com",
      publishedAt: now,
      tags: ["World Cup", "Fixtures", "Streams"],
      competitionId: "fifa-world-cup-2026",
      teamIds: [],
      playerIds: [],
      matchId: null,
      language: "en",
    },
    {
      id: "stub-streams",
      headline: "Official free-to-air stream directory added",
      summary: "The streams experience now surfaces broadcaster links from the static World Cup rights-holder list while live data is unavailable.",
      body: null,
      source: "pitchpulse",
      sourceName: "PitchPulse",
      sourceLogoUrl: null,
      author: "PitchPulse",
      imageUrl: null,
      url: "/streams",
      publishedAt: now,
      tags: ["Streams", "Broadcast"],
      competitionId: "fifa-world-cup-2026",
      teamIds: [],
      playerIds: [],
      matchId: null,
      language: "en",
    },
  ];

  return source ? articles.filter((article) => article.source === source) : articles;
}
