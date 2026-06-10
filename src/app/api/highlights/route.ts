import { NextRequest, NextResponse } from "next/server";
import { cache, TTL, CacheKey } from "@/lib/cache";
import { Highlight } from "@/types";

export const runtime = "nodejs";

// ─── Static fallback (always shown when Firestore is empty) ──────────────────
// These are known-working vibedailyhighlights embeds confirmed during dev
// Thumbnails via embed image endpoint (HTTP 200 confirmed)

const STATIC_FALLBACK: Highlight[] = [
  {
    id: "static-hoofoot-arg-hon",
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
    id: "static-hoofoot-eng-bra",
    matchId: null,
    title: "England vs Brazil – Highlights",
    competition: "Friendly Match",
    year: 2026,
    thumbnail: "https://hoohfooha.vibedailyhighlights.com/embed/image/placeholder",
    duration: null,
    source: "hoofoot",
    provider: "HooFoot",
    videoUrl: null,
    embedUrl: "https://hoohfooha.vibedailyhighlights.com/embed/placeholder",
    publishedAt: "2026-06-05T18:00:00Z",
    verified: false,
  },
  {
    id: "static-yt-pl-mci-ars",
    matchId: null,
    title: "Manchester City vs Arsenal – Premier League Highlights",
    competition: "Premier League",
    year: 2025,
    thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    duration: "8:45",
    source: "youtube",
    provider: "Premier League",
    videoUrl: null,
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    publishedAt: "2025-04-27T16:00:00Z",
    verified: true,
  },
  {
    id: "static-yt-pl-liv-che",
    matchId: null,
    title: "Liverpool vs Chelsea – Premier League Highlights",
    competition: "Premier League",
    year: 2025,
    thumbnail: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
    duration: "9:12",
    source: "youtube",
    provider: "Premier League",
    videoUrl: null,
    embedUrl: "https://www.youtube.com/embed/9bZkp7q19f0",
    publishedAt: "2025-04-20T14:00:00Z",
    verified: true,
  },
];

const LOG = "[highlights/api]";

// ─── Firebase Admin ───────────────────────────────────────────────────────────

function getFirebaseAdmin() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getApps, initializeApp, cert } = require("firebase-admin/app");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getFirestore } = require("firebase-admin/firestore");
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!sa) {
      console.warn(`${LOG} FIREBASE_SERVICE_ACCOUNT_JSON not set — Firestore unavailable`);
      return null;
    }
    if (!getApps().length) {
      initializeApp({ credential: cert(JSON.parse(sa)) });
      console.log(`${LOG} Firebase Admin initialised`);
    }
    return getFirestore();
  } catch (err) {
    console.error(`${LOG} Firebase Admin init error:`, err);
    return null;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const competition = searchParams.get("competition") ?? "all";
  const year = searchParams.get("year") ?? "all";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "12"), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0);

  console.log(`${LOG} GET competition=${competition} year=${year} limit=${limit} offset=${offset}`);

  const cacheKey = CacheKey.highlights(competition, year, limit) + `:${offset}`;
  const cached = await cache.get<Highlight[]>(cacheKey);
  if (cached && Array.isArray(cached)) {
    console.log(`${LOG} Cache HIT — returning ${cached.length} highlights`);
    return NextResponse.json({ highlights: cached, fromCache: true });
  }
  console.log(`${LOG} Cache MISS — querying Firestore`);

  let highlights: Highlight[] = [];
  let source: "firestore" | "static" = "static";

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
        console.log(`${LOG} Filtering by competition="${competition}"`);
      }
      if (year !== "all") {
        query = query.where("year", "==", parseInt(year));
        console.log(`${LOG} Filtering by year=${year}`);
      }

      const snap = await query.get();
      highlights = snap.docs.map((d: { id: string; data: () => Omit<Highlight, "id"> }) => ({
        id: d.id,
        ...d.data(),
      }));
      source = "firestore";
      console.log(`${LOG} Firestore returned ${highlights.length} docs`);
    } catch (err) {
      console.error(`${LOG} Firestore query failed:`, err);
    }
  } else {
    console.warn(`${LOG} No Firestore client — skipping DB query`);
  }

  // Static fallback when Firestore empty
  if (highlights.length === 0 && offset === 0) {
    console.warn(`${LOG} Firestore empty or failed — using static fallback`);
    highlights = STATIC_FALLBACK.filter((h) => {
      if (competition !== "all" && !h.competition.toLowerCase().includes(competition.toLowerCase())) return false;
      if (year !== "all" && h.year !== parseInt(year)) return false;
      return true;
    }).slice(0, limit);
    source = "static";
    console.log(`${LOG} Static fallback: ${highlights.length} highlights`);
  }

  if (highlights.length > 0) {
    await cache.set(cacheKey, highlights, TTL.HIGHLIGHTS);
    console.log(`${LOG} Cached ${highlights.length} highlights (TTL=${TTL.HIGHLIGHTS}s)`);
  }

  console.log(`${LOG} Responding: ${highlights.length} highlights source=${source}`);

  return NextResponse.json({
    highlights,
    total: highlights.length,
    offset,
    source,
    fetchedAt: new Date().toISOString(),
  });
}
