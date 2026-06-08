import { NextRequest, NextResponse } from "next/server";
import { cache, TTL, CacheKey } from "@/lib/cache";
import { Highlight } from "@/types";

export const runtime = "nodejs";

// ─── Static fallback (always shown when Firestore is empty) ──────────────────
// These are known-working vibedailyhighlights embeds confirmed during dev
// Thumbnails via embed image endpoint (HTTP 200 confirmed)

const STATIC_FALLBACK: Highlight[] = [
  {
    id: "static-hoofoot-37766",
    matchId: null,
    title: "Argentina vs Honduras – Highlights",
    competition: "Friendly Match",
    year: 2026,
    thumbnail: "https://hoohfooha.vibedailyhighlights.com/embed/image/mHQ9Q3RAEZQFw",
    duration: null,
    source: "hoofoot",
    provider: "HooFoot",
    videoUrl: null,
    embedUrl: "https://hoohfooha.vibedailyhighlights.com/embed/mHQ9Q3RAEZQFw",
    publishedAt: "2026-06-07T12:00:00Z",
    verified: false,
  },
  {
    id: "static-yt-wc22-final",
    matchId: null,
    title: "Argentina vs France – 2022 World Cup Final Highlights",
    competition: "FIFA World Cup",
    year: 2022,
    thumbnail: "https://i.ytimg.com/vi/pK8EHiHPMf0/hqdefault.jpg",
    duration: "14:53",
    source: "youtube",
    provider: "FIFA",
    videoUrl: null,
    embedUrl: "https://www.youtube.com/embed/pK8EHiHPMf0",
    publishedAt: "2022-12-18T22:00:00Z",
    verified: true,
  },
  {
    id: "static-yt-wc22-semi-arg",
    matchId: null,
    title: "Argentina vs Croatia – 2022 World Cup Semi-Final Highlights",
    competition: "FIFA World Cup",
    year: 2022,
    thumbnail: "https://i.ytimg.com/vi/gRdj1naBMhM/hqdefault.jpg",
    duration: "10:47",
    source: "youtube",
    provider: "FIFA",
    videoUrl: null,
    embedUrl: "https://www.youtube.com/embed/gRdj1naBMhM",
    publishedAt: "2022-12-13T22:00:00Z",
    verified: true,
  },
  {
    id: "static-yt-wc22-semi-fra",
    matchId: null,
    title: "France vs Morocco – 2022 World Cup Semi-Final Highlights",
    competition: "FIFA World Cup",
    year: 2022,
    thumbnail: "https://i.ytimg.com/vi/uORuDjPVBCQ/hqdefault.jpg",
    duration: "9:58",
    source: "youtube",
    provider: "FIFA",
    videoUrl: null,
    embedUrl: "https://www.youtube.com/embed/uORuDjPVBCQ",
    publishedAt: "2022-12-14T22:00:00Z",
    verified: true,
  },
  {
    id: "static-yt-wc22-qf-bra",
    matchId: null,
    title: "Croatia vs Brazil – 2022 World Cup Quarter-Final Highlights",
    competition: "FIFA World Cup",
    year: 2022,
    thumbnail: "https://i.ytimg.com/vi/iH1dBDsM4mc/hqdefault.jpg",
    duration: "11:22",
    source: "youtube",
    provider: "FIFA",
    videoUrl: null,
    embedUrl: "https://www.youtube.com/embed/iH1dBDsM4mc",
    publishedAt: "2022-12-09T18:00:00Z",
    verified: true,
  },
  {
    id: "static-yt-wc18-final",
    matchId: null,
    title: "France vs Croatia – 2018 World Cup Final Highlights",
    competition: "FIFA World Cup",
    year: 2018,
    thumbnail: "https://i.ytimg.com/vi/DZ4NTm7NFBU/hqdefault.jpg",
    duration: "12:30",
    source: "youtube",
    provider: "FIFA",
    videoUrl: null,
    embedUrl: "https://www.youtube.com/embed/DZ4NTm7NFBU",
    publishedAt: "2018-07-15T15:00:00Z",
    verified: true,
  },
];

// ─── Firebase Admin ───────────────────────────────────────────────────────────

function getFirebaseAdmin() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getApps, initializeApp, cert } = require("firebase-admin/app");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getFirestore } = require("firebase-admin/firestore");
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!sa) return null;
    if (!getApps().length) initializeApp({ credential: cert(JSON.parse(sa)) });
    return getFirestore();
  } catch { return null; }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const competition = searchParams.get("competition") ?? "all";
  const year = searchParams.get("year") ?? "all";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "12"), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0);

  const cacheKey = CacheKey.highlights(competition, year, limit) + `:${offset}`;
  const cached = await cache.get<Highlight[]>(cacheKey);
  if (cached && Array.isArray(cached)) {
    return NextResponse.json({ highlights: cached, fromCache: true });
  }

  let highlights: Highlight[] = [];

  // Read from Firestore
  const db = getFirebaseAdmin();
  if (db) {
    try {
      let query = db
        .collection("highlights")
        .orderBy("publishedAt", "desc")
        .offset(offset)
        .limit(limit);

      if (competition !== "all") {
        query = query.where("competition", "==", competition);
      }
      if (year !== "all") {
        query = query.where("year", "==", parseInt(year));
      }

      const snap = await query.get();
      highlights = snap.docs.map((d: { id: string; data: () => Omit<Highlight, "id"> }) => ({
        id: d.id,
        ...d.data(),
      }));
    } catch { /* fall through to static */ }
  }

  // Static fallback when Firestore empty (e.g. first run before cron has written data)
  if (highlights.length === 0 && offset === 0) {
    highlights = STATIC_FALLBACK.filter((h) => {
      if (competition !== "all" && !h.competition.toLowerCase().includes(competition.toLowerCase())) return false;
      if (year !== "all" && h.year !== parseInt(year)) return false;
      return true;
    }).slice(0, limit);
  }

  if (highlights.length > 0) {
    await cache.set(cacheKey, highlights, TTL.HIGHLIGHTS);
  }

  return NextResponse.json({
    highlights,
    total: highlights.length,
    offset,
    fetchedAt: new Date().toISOString(),
  });
}
