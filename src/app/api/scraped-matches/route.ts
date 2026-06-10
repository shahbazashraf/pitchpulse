import { NextRequest, NextResponse } from "next/server";
import { cache, TTL } from "@/lib/cache";

export const runtime = "nodejs";

export interface ScrapedStream {
  url: string;
  embed_url: string | null;
  quality: string;
  source: string;
  priority: number;
}

export interface ScrapedMatch {
  id: string;
  title: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  leagueLogo: string | null;
  competition: string;
  status: "NS" | "LIVE" | "FT";
  score: { home: number; away: number } | null;
  minute: string | null;
  startTime: string | null;
  isLive: boolean;
  streams: ScrapedStream[];
  scrapedAt: string;
}

interface KoraMatch {
  id: string;
  status: number;
  date: string;
  time: string;
  score: string;
  league_en: string;
  home_en: string;
  away_en: string;
  home_logo: string;
  away_logo: string;
  league_logo: string;
}

function today(): string {
  return new Date().toISOString().split("T")[0].replace(/-/g, "");
}

function ts(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function parseScore(raw: string): { home: number; away: number } | null {
  const m = raw.match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  return { home: parseInt(m[1], 10), away: parseInt(m[2], 10) };
}

function mapStatus(s: number): "NS" | "LIVE" | "FT" {
  if (s === 1 || s === 3) return "LIVE";
  if (s === 2) return "FT";
  return "NS";
}

async function fetchKoraMatches(): Promise<ScrapedMatch[]> {
  const url = `https://ws.kora-api.space/api/matches/${today()}/1?t=${ts()}`;
  const res = await fetch(url, {
    headers: {
      Referer: "https://hesgoal-live.fit/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`kora-api ${res.status}`);

  const data = (await res.json()) as { matches: KoraMatch[] };
  const now = new Date().toISOString();

  return (data.matches ?? []).map((m): ScrapedMatch => {
    const status = mapStatus(m.status);
    const isLive = status === "LIVE";
    const score = parseScore(m.score ?? "");
    const startTime = m.date && m.time ? `${m.date}T${m.time}:00Z` : null;
    const streams: ScrapedStream[] = isLive
      ? [
          {
            url: `https://xyzhesgoal-live-fit.panel001.com/?m=${m.id}&lang=en`,
            embed_url: null,
            quality: "HD",
            source: "hesgoals",
            priority: 1,
          },
        ]
      : [];

    return {
      id: String(m.id),
      title: `${m.home_en} vs ${m.away_en}`,
      homeTeam: m.home_en,
      awayTeam: m.away_en,
      homeLogo: m.home_logo || null,
      awayLogo: m.away_logo || null,
      leagueLogo: m.league_logo || null,
      competition: m.league_en || "Football",
      status,
      score,
      minute: null,
      startTime,
      isLive,
      streams,
      scrapedAt: now,
    };
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get("status");
  const cacheKey = `hesgoals-matches:${statusFilter ?? "all"}`;

  try {
    const data = await cache.getOrFetch<ScrapedMatch[]>(
      cacheKey,
      async () => {
        const matches = await fetchKoraMatches();
        return statusFilter
          ? matches.filter((m) => m.status === statusFilter)
          : matches;
      },
      TTL.LIVE_MATCH,
    );

    const live     = data.filter((m) => m.status === "LIVE");
    const upcoming = data.filter((m) => m.status === "NS");
    const finished = data.filter((m) => m.status === "FT");

    return NextResponse.json(
      {
        matches: data,
        grouped: { live, upcoming, finished },
        total: data.length,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${TTL.LIVE_MATCH}, stale-while-revalidate=30`,
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: String(err), matches: [], grouped: { live: [], upcoming: [], finished: [] } },
      { status: 503 },
    );
  }
}
