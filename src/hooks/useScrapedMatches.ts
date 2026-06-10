"use client";

import { useQuery } from "@tanstack/react-query";
import type { ScrapedMatch, ScrapedStream } from "@/app/api/scraped-matches/route";

export type { ScrapedMatch };

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
  category: string;
}

interface ScrapedMatchesResponse {
  matches: ScrapedMatch[];
  grouped: {
    live: ScrapedMatch[];
    upcoming: ScrapedMatch[];
    finished: ScrapedMatch[];
  };
  total: number;
  fetchedAt: string;
}

function getToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function getTs(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function parseScore(raw: string): { home: number; away: number } | null {
  const m = raw?.match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  return { home: parseInt(m[1], 10), away: parseInt(m[2], 10) };
}

function mapStatus(s: number): "NS" | "LIVE" | "FT" {
  if (s === 1 || s === 3) return "LIVE";
  if (s === 2) return "FT";
  return "NS";
}

async function fetchKoraMatches(): Promise<ScrapedMatchesResponse> {
  const url = `https://ws.kora-api.space/api/matches/${getToday()}/1?t=${getTs()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`kora-api ${res.status}`);

  const data = (await res.json()) as { matches: KoraMatch[] };
  const now = new Date().toISOString();

  const matches: ScrapedMatch[] = (data.matches ?? [])
    .filter((m) => m.category === "Soccer" || m.category === "Football" || !m.category)
    .map((m): ScrapedMatch => {
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

  const live     = matches.filter((m) => m.status === "LIVE");
  const upcoming = matches.filter((m) => m.status === "NS");
  const finished = matches.filter((m) => m.status === "FT");

  return {
    matches,
    grouped: { live, upcoming, finished },
    total: matches.length,
    fetchedAt: now,
  };
}

export function useScrapedMatches(status?: "LIVE" | "NS" | "FT") {
  return useQuery<ScrapedMatchesResponse>({
    queryKey: ["scraped-matches", status ?? "all"],
    queryFn: async () => {
      const data = await fetchKoraMatches();
      if (status) {
        const filtered = data.matches.filter((m) => m.status === status);
        return {
          ...data,
          matches: filtered,
          grouped: {
            live: filtered.filter((m) => m.status === "LIVE"),
            upcoming: filtered.filter((m) => m.status === "NS"),
            finished: filtered.filter((m) => m.status === "FT"),
          },
          total: filtered.length,
        };
      }
      return data;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
