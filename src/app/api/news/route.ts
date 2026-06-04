import { NextRequest, NextResponse } from "next/server";
import { cache, TTL } from "@/lib/cache";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
        const db = getDb();
        let query = db
          .collection("articles")
          .orderBy("publishedAt", "desc")
          .limit(limit);

        if (source) query = query.where("source", "==", source) as any;

        const snap = await query.get();
        return snap.docs.map((d) => d.data());
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
