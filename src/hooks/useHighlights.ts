"use client";

import { useQuery } from "@tanstack/react-query";
import { Highlight } from "@/types";

const LOG = "[useHighlights]";

export function useHighlights(
  competition?: string,
  year?: number,
  limit = 12,
  offset = 0,
  provider?: "official" | "others"
) {
  return useQuery<Highlight[]>({
    queryKey: ["highlights", competition ?? "all", year ?? "all", limit, offset, provider ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (competition) params.set("competition", competition);
      if (year) params.set("year", String(year));
      params.set("limit", String(limit));
      if (offset > 0) params.set("offset", String(offset));
      if (provider) params.set("provider", provider);

      const url = `/api/highlights?${params}`;
      console.log(`${LOG} Fetching competition=${competition ?? "all"} provider=${provider ?? "all"} limit=${limit}`, url);

      const res = await fetch(url);

      if (!res.ok) {
        console.error(`${LOG} HTTP ${res.status} from ${url}`);
        return [];
      }

      const data = await res.json();
      const list: Highlight[] = Array.isArray(data) ? data : (data.highlights ?? []);

      console.log(
        `${LOG} Got ${list.length} highlights` +
        (data.fromCache ? " (cached)" : "") +
        (data.source ? ` source=${data.source}` : "")
      );

      if (list.length === 0) {
        console.warn(`${LOG} Empty result — competition="${competition ?? "all"}" may have no data in Firestore yet`);
      }

      return list;
    },
    staleTime: 15 * 60_000,
  });
}
