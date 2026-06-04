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

interface Params { params: { matchId: string } }

export async function GET(_: NextRequest, { params }: Params) {
  const { matchId } = params;
  const cacheKey = `commentary:${matchId}`;

  try {
    const data = await cache.getOrFetch(
      cacheKey,
      async () => {
        const db = getDb();
        const snap = await db
          .collection("commentary")
          .where("matchId", "==", matchId)
          .orderBy("minute", "desc")
          .limit(100)
          .get();
        return snap.docs.map((d) => d.data());
      },
      TTL.COMMENTARY,
    );

    return NextResponse.json(
      { commentary: data, matchId },
      { headers: { "Cache-Control": `public, s-maxage=${TTL.COMMENTARY}, stale-while-revalidate=5` } },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}
