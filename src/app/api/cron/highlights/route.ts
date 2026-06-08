import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { Highlight } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 10;

const UA = "PitchPulse/1.0 (+https://pitchpulse.app)";

// ─── YouTube RSS channels ─────────────────────────────────────────────────────

const YT_CHANNELS = [
  { id: "UCpc3RNxuN1vFMJxNwBlv8QA", provider: "FIFA",       competition: "FIFA World Cup" },
  { id: "UCj5RwDivLksanrNvkG2XLFA", provider: "Fox Soccer",  competition: "FIFA World Cup" },
  { id: "UCNAf1k0yIjyGu3k9BwAg3lg", provider: "ESPN FC",     competition: "Football" },
  { id: "UCi-hE8Exdg4PbrHJx4jnHcQ", provider: "BBC Sport",   competition: "Football" },
  { id: "UCBi2mrWuNuyYy4gbM6fU18Q", provider: "UEFA",        competition: "UEFA Champions League" },
];

const HIGHLIGHT_KEYWORDS = /highlight|goal|match|final|semi|quarter|vs\b|v\./i;

function stableId(source: string, sourceId: string): string {
  return createHash("sha256").update(`${source}:${sourceId}`).digest("hex").slice(0, 20);
}

function guessYear(text: string): number {
  const m = text.match(/20(2[2-9]|3[0-9])/);
  return m ? parseInt(m[0]) : new Date().getUTCFullYear();
}

function extractXml(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
}

async function scrapeYouTubeRSS(): Promise<Highlight[]> {
  const results: Highlight[] = [];
  await Promise.allSettled(
    YT_CHANNELS.map(async (ch) => {
      try {
        const res = await fetch(
          `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`,
          { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) }
        );
        if (!res.ok) return;
        const xml = await res.text();
        const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
        for (const [, entry] of entries.slice(0, 15)) {
          const title = extractXml(entry, "title");
          if (!HIGHLIGHT_KEYWORDS.test(title)) continue;
          const videoIdMatch = entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/);
          if (!videoIdMatch) continue;
          const videoId = videoIdMatch[1].trim();
          const published = extractXml(entry, "published") || new Date().toISOString();
          results.push({
            id: stableId("youtube", videoId),
            matchId: null,
            title,
            competition: ch.competition,
            year: guessYear(title + published),
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration: null,
            source: "youtube",
            provider: ch.provider,
            videoUrl: null,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            publishedAt: published,
            verified: true,
          });
        }
      } catch { /* skip failed channel */ }
    })
  );
  return results;
}

// ─── Reddit r/footballhighlights ─────────────────────────────────────────────

async function scrapeReddit(): Promise<Highlight[]> {
  try {
    const res = await fetch(
      "https://www.reddit.com/r/footballhighlights/.json?limit=25&sort=new",
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const posts: any[] = json?.data?.children ?? [];
    const results: Highlight[] = [];

    for (const { data: post } of posts) {
      const url: string = post.url ?? "";
      const title: string = post.title ?? "";
      if (!url || url.includes("reddit.com/r/")) continue;

      // Extract embed URL
      let embedUrl: string | null = null;
      let videoUrl: string | null = null;

      const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      const streamableMatch = url.match(/streamable\.com\/([A-Za-z0-9]+)/);

      if (ytMatch) {
        embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
      } else if (streamableMatch) {
        embedUrl = `https://streamable.com/e/${streamableMatch[1]}`;
      } else if (post.media?.reddit_video?.fallback_url) {
        videoUrl = post.media.reddit_video.fallback_url;
      } else {
        continue; // no usable video
      }

      const thumb: string = post.thumbnail ?? "";
      const thumbnail = ["self", "default", "nsfw", "spoiler", ""].includes(thumb)
        ? null
        : thumb;

      const created = new Date((post.created_utc ?? Date.now() / 1000) * 1000).toISOString();

      results.push({
        id: stableId("reddit", post.id ?? url),
        matchId: null,
        title,
        competition: "Football",
        year: guessYear(title + created),
        thumbnail,
        duration: null,
        source: "reddit",
        provider: "Reddit r/footballhighlights",
        videoUrl,
        embedUrl,
        publishedAt: created,
        verified: false,
      });
    }
    return results;
  } catch {
    return [];
  }
}

// ─── footballhighlights-video.com RSS ────────────────────────────────────────

async function scrapeFootballHighlightsRSS(): Promise<Highlight[]> {
  try {
    const res = await fetch("https://footballhighlights-video.com/feed/", {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15);
    const results: Highlight[] = [];

    for (const [, item] of items) {
      const title = extractXml(item, "title");
      const link = extractXml(item, "link");
      const pubDate = extractXml(item, "pubDate");
      const thumb = item.match(/url="(https?:\/\/[^"]+\.(?:jpg|png|webp))"/)?.[1] ?? null;
      const ytId = item.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/)?.[1]
        ?? item.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/)?.[1]
        ?? null;

      if (!ytId && !link) continue;

      const published = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
      const sourceId = ytId ?? link;

      results.push({
        id: stableId("fhv", sourceId),
        matchId: null,
        title: title || "Football Highlights",
        competition: "Football",
        year: guessYear(title + published),
        thumbnail: thumb ?? (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null),
        duration: null,
        source: "footballhighlights-video",
        provider: "Football Highlights Video",
        videoUrl: null,
        embedUrl: ytId ? `https://www.youtube.com/embed/${ytId}` : null,
        publishedAt: published,
        verified: false,
      });
    }
    return results;
  } catch {
    return [];
  }
}

// ─── Firestore writer ─────────────────────────────────────────────────────────

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

async function writeToFirestore(db: any, highlights: Highlight[]): Promise<number> {
  if (!highlights.length) return 0;
  let batch = db.batch();
  let count = 0;
  let batchCount = 0;
  for (const h of highlights) {
    batch.set(db.collection("highlights").doc(h.id), h, { merge: true });
    count++;
    batchCount++;
    if (batchCount === 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();
  return count;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth
  const secret = req.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Scrape all sources in parallel
  const [ytResults, redditResults, rssResults] = await Promise.all([
    scrapeYouTubeRSS(),
    scrapeReddit(),
    scrapeFootballHighlightsRSS(),
  ]);

  const all = [...ytResults, ...redditResults, ...rssResults];

  // Dedup within this batch (keep first occurrence by id)
  const seen = new Set<string>();
  const deduped = all.filter((h) => {
    if (seen.has(h.id)) return false;
    seen.add(h.id);
    return true;
  });

  // Write to Firestore
  const db = getFirebaseAdmin();
  let inserted = 0;
  if (db) {
    inserted = await writeToFirestore(db, deduped);
  }

  return NextResponse.json({
    inserted,
    skipped: deduped.length - inserted,
    total: deduped.length,
    sources: {
      youtube: ytResults.length,
      reddit: redditResults.length,
      rss: rssResults.length,
    },
    noFirebase: !db,
    timestamp: new Date().toISOString(),
  });
}
