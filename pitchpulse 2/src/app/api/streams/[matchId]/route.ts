import { NextRequest, NextResponse } from "next/server";
import { cache, CacheKey, TTL } from "@/lib/cache";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { FREE_BROADCASTERS, broadcasterToStream } from "@/lib/streams/broadcasters";

export const runtime = "nodejs";

function getDb() {
  if (!getApps().length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (sa) initializeApp({ credential: cert(JSON.parse(sa)) });
    else initializeApp();
  }
  return getFirestore();
}

interface Params { params: Promise<{ matchId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { matchId } = await params;
  const cacheKey = CacheKey.streams(matchId);
  const isWCMatch = matchId.startsWith("wc2026:") || matchId.includes(":1:");

  try {
    const streams = await cache.getOrFetch(cacheKey, async () => {
      let firestoreStreams: any[] = [];
      try {
        const db = getDb();
        const snap = await db.collection("streams").where("matchId","==",matchId).where("is_official","==",true).get();
        firestoreStreams = snap.docs.map((d) => d.data());
      } catch { /* Firestore unavailable */ }

      if (isWCMatch) {
        const staticStreams = FREE_BROADCASTERS.map((b) => broadcasterToStream(b, matchId, false));
        const firestoreIds = new Set(firestoreStreams.map((s) => s.id));
        const newStatic = staticStreams.filter((s: any) => !firestoreIds.has(s.id));
        return [...firestoreStreams, ...newStatic].sort(sortStreams);
      }
      return firestoreStreams.sort(sortStreams);
    }, TTL.STREAMS);

    return NextResponse.json(
      { streams, matchId, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": `public, s-maxage=${TTL.STREAMS}, stale-while-revalidate=30` } },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}

function sortStreams(a: any, b: any) {
  if (a.is_available !== b.is_available) return a.is_available ? -1 : 1;
  const q: Record<string,number> = { "4K": 4, FHD: 3, HD: 2, SD: 1 };
  return (q[b.quality] ?? 0) - (q[a.quality] ?? 0);
}
