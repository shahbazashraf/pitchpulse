"use client";

import { useQuery } from "@tanstack/react-query";
import { Highlight } from "@/types";

const LOG = "[useHighlights]";

export function useHighlights(
  competition?: string,
  year?: number,
  limit = 12,
  offset = 0,
  filterType?: "officialOnly" | "excludeOfficial"
) {
  return useQuery<Highlight[]>({
    queryKey: ["highlights", competition ?? "all", year ?? "all", limit, offset, filterType ?? "none"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (competition) params.set("competition", competition);
      if (year) params.set("year", String(year));
      if (filterType === "excludeOfficial") params.set("excludeOfficial", "true");
      if (filterType === "officialOnly") params.set("officialOnly", "true");
      params.set("limit", String(limit));
      if (offset > 0) params.set("offset", String(offset));

      const url = `/api/highlights?${params}`;
      console.log(`${LOG} Fetching competition=${competition ?? "all"} limit=${limit} filterType=${filterType ?? "none"}`, url);

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
