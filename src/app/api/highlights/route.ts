import { NextRequest, NextResponse } from "next/server";
import { cache, TTL, CacheKey } from "@/lib/cache";
import { Highlight } from "@/types";

export const runtime = "nodejs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const HOOFOOT_HOME = "https://hoofoot.com/";
const HOOFOOT_VIDEOS = "https://hoofoot.com/videos.php";

// ─── Hoofoot scraper ─────────────────────────────────────────────────────────

interface HoofootMatch {
  id: string;         // hoofoot internal numeric ID e.g. "37766"
  thumbId: string;    // thumbnail pic ID e.g. "37594"
  matchUrl: string;   // https://hoofoot.com/?match=Argentina_v_Honduras_2026_06_07
  homeTeam: string;
  awayTeam: string;
  date: string;       // YYYY-MM-DD
  competition: string;
}

async function fetchHoofootList(): Promise<HoofootMatch[]> {
  const html = await fetch(HOOFOOT_HOME, {
    headers: { "User-Agent": UA },
    next: { revalidate: 0 },
  }).then((r) => r.text());

  // Extract numeric IDs (onclick="recargar('XXXXX')")
  const ids = [...html.matchAll(/id="drut(\d+)"/g)].map((m) => m[1]);

  // Extract thumbnail pic IDs (src="https://th.hoofoot.com/pics/XXXXX.jpg")
  const thumbMatches = [...html.matchAll(/src="https:\/\/th\.hoofoot\.com\/pics\/(\d+)\.jpg"/g)];
  const thumbIds = thumbMatches.map((m) => m[1]);

  // Extract match URLs
  const urlMatches = [...html.matchAll(/href="(https:\/\/hoofoot\.com\/\?match=([^"]+))"/g)];
  const matchUrls = urlMatches.map((m) => m[1]);

  // Extract competition labels
  const compMatches = [...html.matchAll(/hoofoot\.com\/x\/([^"]+?)(?:\.jpg|")/g)];
  const comps = compMatches.map((m) => decodeURIComponent(m[1].replace(/\+/g, " ")));

  const results: HoofootMatch[] = [];
  for (let i = 0; i < Math.min(ids.length, matchUrls.length); i++) {
    const urlParam = matchUrls[i].replace("https://hoofoot.com/?match=", "");
    // Pattern: HomeTeam_v_AwayTeam_YYYY_MM_DD
    const dateMatch = urlParam.match(/_(\d{4})_(\d{2})_(\d{2})$/);
    if (!dateMatch) continue;
    const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    const teamsRaw = urlParam.replace(`_${dateMatch[1]}_${dateMatch[2]}_${dateMatch[3]}`, "");
    const parts = teamsRaw.split("_v_");
    const homeTeam = parts[0]?.replace(/_/g, " ") ?? "Unknown";
    const awayTeam = parts[1]?.replace(/_/g, " ") ?? "Unknown";

    results.push({
      id: ids[i],
      thumbId: thumbIds[i] ?? "",
      matchUrl: matchUrls[i],
      homeTeam,
      awayTeam,
      date,
      competition: comps[i] ?? "Football",
    });
  }
  return results;
}

async function fetchVideoEmbed(id: string): Promise<{ embedHash: string; thumbnailUrl: string } | null> {
  try {
    const html = await fetch(HOOFOOT_VIDEOS, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": HOOFOOT_HOME,
      },
      body: `vv=${id}`,
      next: { revalidate: 0 },
    }).then((r) => r.text());

    // Extract embed hash from vibedailyhighlights URL
    const hashMatch = html.match(/vibedailyhighlights\.com\/embed\/([A-Za-z0-9_-]+)/);
    if (!hashMatch) return null;
    const embedHash = hashMatch[1];
    // Thumbnail from embed image endpoint (redirects to actual PNG)
    const thumbnailUrl = `https://hoohfooha.vibedailyhighlights.com/embed/image/${embedHash}`;
    return { embedHash, thumbnailUrl };
  } catch {
    return null;
  }
}

async function scrapeHoofoot(limit: number): Promise<Highlight[]> {
  const matches = await fetchHoofootList();
  const top = matches.slice(0, limit);

  // Fetch video embeds in parallel (max 6 at a time to be polite)
  const BATCH = 6;
  const highlights: Highlight[] = [];

  for (let i = 0; i < top.length; i += BATCH) {
    const batch = top.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (m): Promise<Highlight> => {
        const embed = await fetchVideoEmbed(m.id);
        return {
          id: `hoofoot:${m.id}`,
          matchId: null,
          title: `${m.homeTeam} vs ${m.awayTeam} – Highlights`,
          competition: m.competition,
          year: parseInt(m.date.slice(0, 4)),
          thumbnail: embed?.thumbnailUrl ?? null,
          duration: null,
          source: "hoofoot",
          provider: "HooFoot",
          videoUrl: null,
          embedUrl: embed ? `https://hoohfooha.vibedailyhighlights.com/embed/${embed.embedHash}` : null,
          publishedAt: m.date + "T12:00:00Z",
          verified: false,
        };
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") highlights.push(r.value);
    }
  }
  return highlights.filter((h) => h.embedUrl !== null);
}

// ─── Fallback: open RSS feeds ────────────────────────────────────────────────
// footballhighlightsvideo.com and footyroom RSS have no rate limits

async function scrapeRssFallback(): Promise<Highlight[]> {
  // footballhighlights-video.com RSS  (open, no key needed)
  try {
    const xml = await fetch("https://footballhighlights-video.com/feed/", {
      headers: { "User-Agent": UA },
      next: { revalidate: 0 },
    }).then((r) => r.text());

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12);
    return items.map((m, i): Highlight => {
      const title = m[1].match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/)?.[1] ?? m[1].match(/<title>([^<]+)<\/title>/)?.[1] ?? "Football Highlights";
      const link = m[1].match(/<link>([^<]+)<\/link>/)?.[1] ?? "";
      const date = m[1].match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ?? "";
      const thumb = m[1].match(/url="(https?:\/\/[^"]+\.(?:jpg|png|webp))"/)?.[1] ?? null;
      // Extract YouTube embed if present
      const ytId = m[1].match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/)?.[1] ?? null;
      return {
        id: `rss:fhv:${i}`,
        matchId: null,
        title,
        competition: "Football",
        year: new Date(date).getFullYear() || new Date().getFullYear(),
        thumbnail: thumb,
        duration: null,
        source: "rss",
        provider: "Football Highlights Video",
        videoUrl: null,
        embedUrl: ytId ? `https://www.youtube.com/embed/${ytId}` : link || null,
        publishedAt: date ? new Date(date).toISOString() : new Date().toISOString(),
        verified: false,
      };
    }).filter((h) => h.embedUrl);
  } catch {
    return [];
  }
}

// ─── Firestore ───────────────────────────────────────────────────────────────

function getFirebaseAdmin() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getApps, initializeApp, cert } = require("firebase-admin/app");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getFirestore } = require("firebase-admin/firestore");
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccount) return null;
    if (!getApps().length) {
      initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
    }
    return getFirestore();
  } catch {
    return null;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const competition = searchParams.get("competition") ?? "all";
  const year = searchParams.get("year") ?? "all";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "12"), 50);

  const cacheKey = CacheKey.highlights(competition, year, limit);
  const cached = await cache.get<Highlight[]>(cacheKey);
  if (cached && Array.isArray(cached)) {
    return NextResponse.json({ highlights: cached, fromCache: true });
  }

  let highlights: Highlight[] = [];

  // 1. Try Firestore
  const db = getFirebaseAdmin();
  if (db) {
    try {
      let query = db.collection("highlights").orderBy("publishedAt", "desc").limit(limit);
      if (competition !== "all") query = query.where("competition", "==", competition);
      if (year !== "all") query = query.where("year", "==", parseInt(year));
      const snap = await query.get();
      highlights = snap.docs.map((d: { id: string; data: () => Omit<Highlight, "id"> }) => ({ id: d.id, ...d.data() }));
    } catch { /* fall through */ }
  }

  // 2. Scrape HooFoot
  if (highlights.length === 0) {
    try {
      highlights = await scrapeHoofoot(limit);
    } catch { /* fall through */ }
  }

  // 3. RSS fallback
  if (highlights.length === 0) {
    highlights = await scrapeRssFallback();
  }

  // Filter by year/competition if specified
  if (highlights.length > 0) {
    highlights = highlights.filter((h) => {
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
    source: highlights[0]?.source ?? "none",
    fetchedAt: new Date().toISOString(),
  });
}
