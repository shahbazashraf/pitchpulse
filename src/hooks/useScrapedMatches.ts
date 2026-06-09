"use client";

import { useQuery } from "@tanstack/react-query";
import type { ScrapedMatch } from "@/app/api/scraped-matches/route";

export type { ScrapedMatch };

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

export function useScrapedMatches(status?: "LIVE" | "NS" | "FT") {
  return useQuery<ScrapedMatchesResponse>({
    queryKey: ["scraped-matches", status ?? "all"],
    queryFn: async () => {
      const params = status ? `?status=${status}` : "";
      const res = await fetch(`/api/scraped-matches${params}`);
      if (!res.ok) return { matches: [], grouped: { live: [], upcoming: [], finished: [] }, total: 0, fetchedAt: "" };
      return res.json();
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
