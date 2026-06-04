import { NextRequest, NextResponse } from "next/server";
import { cache, CacheKey, TTL } from "@/lib/cache";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const runtime = "nodejs";

function getDb() {
  if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccount) {
      initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
    } else {
      initializeApp();
    }
  }
  return getFirestore();
}

interface Params {
  params: { matchId: string };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { matchId } = params;
  const cacheKey = CacheKey.streams(matchId);

  try {
    const streams = await cache.getOrFetch(
      cacheKey,
      async () => {
        const db = getDb();
        const snap = await db
          .collection("streams")
          .where("matchId", "==", matchId)
          .where("is_official", "==", true)
          .get();

        return snap.docs
          .map((d) => d.data())
          .sort((a, b) => {
            // Sort: available first, then by quality
            if (a.is_available !== b.is_available) return a.is_available ? -1 : 1;
            const qualityOrder = { "4K": 4, FHD: 3, HD: 2, SD: 1 };
            return (qualityOrder[b.quality as keyof typeof qualityOrder] ?? 0)
              - (qualityOrder[a.quality as keyof typeof qualityOrder] ?? 0);
          });
      },
      TTL.STREAMS,
    );

    return NextResponse.json(
      { streams, matchId, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${TTL.STREAMS}, stale-while-revalidate=30`,
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch streams" },
      { status: 503 },
    );
  }
}
