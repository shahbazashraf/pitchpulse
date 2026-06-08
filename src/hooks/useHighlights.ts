"use client";

import { useQuery } from "@tanstack/react-query";
import { Highlight } from "@/types";

export function useHighlights(
  competition?: string,
  year?: number,
  limit = 12,
  offset = 0
) {
  return useQuery<Highlight[]>({
    queryKey: ["highlights", competition ?? "all", year ?? "all", limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (competition) params.set("competition", competition);
      if (year) params.set("year", String(year));
      params.set("limit", String(limit));
      if (offset > 0) params.set("offset", String(offset));
      const res = await fetch(`/api/highlights?${params}`);
      if (!res.ok) return [];
      const data = await res.json();
      // Handle both { highlights: [] } and a bare array defensively
      const list = Array.isArray(data) ? data : (data.highlights ?? []);
      return list as Highlight[];
    },
    staleTime: 15 * 60_000,
  });
}
