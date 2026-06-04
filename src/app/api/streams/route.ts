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
  const matchId = searchParams.get("matchId");
  const liveOnly = searchParams.get("liveOnly") === "true";
  const cacheKey = `streams:all:${matchId ?? "all"}:${liveOnly}`;

  try {
    const data = await cache.getOrFetch(
      cacheKey,
      async () => {
        const db = getDb();
        let query = db
          .collection("streams")
          .where("is_official", "==", true)
          .orderBy("is_available", "desc");

        if (matchId) query = query.where("matchId", "==", matchId) as any;
        if (liveOnly) query = query.where("is_available", "==", true) as any;

        const snap = await query.limit(50).get();
        return snap.docs.map((d) => d.data());
      },
      TTL.STREAMS,
    );

    return NextResponse.json(
      { streams: data, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": `public, s-maxage=${TTL.STREAMS}, stale-while-revalidate=30` } },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}
