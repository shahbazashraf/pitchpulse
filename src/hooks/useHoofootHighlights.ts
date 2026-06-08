"use client";

import { useQuery } from "@tanstack/react-query";
import { Highlight } from "@/types";

async function fetchWithProxy(url: string): Promise<string> {
  const proxies = [
    {
      build: (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
      extract: async (res: Response): Promise<string> => {
        const data = await res.json();
        return data.contents ?? "";
      },
    },
    {
      build: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      extract: async (res: Response): Promise<string> => res.text(),
    },
  ];

  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy.build(url), { cache: "no-store" });
      if (!res.ok) continue;
      const html = await proxy.extract(res);
      if (html && html.length > 500) return html;
    } catch {
      continue;
    }
  }
  throw new Error("All CORS proxies failed for: " + url);
}

function detectCompetition(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("world cup") || t.includes("worldcup") || t.includes("fifa wc")) return "FIFA World Cup";
  if (t.includes("champions league") || t.includes("ucl")) return "Champions League";
  if (t.includes("europa league") || t.includes("uel")) return "Europa League";
  if (t.includes("premier league") || t.includes("epl")) return "Premier League";
  if (t.includes("la liga") || t.includes("laliga")) return "La Liga";
  if (t.includes("serie a")) return "Serie A";
  if (t.includes("bundesliga")) return "Bundesliga";
  if (t.includes("ligue 1")) return "Ligue 1";
  if (t.includes("copa america")) return "Copa America";
  if (t.includes("euro 20") || t.includes("european championship")) return "Euro";
  if (t.includes("nations league")) return "Nations League";
  return "Football";
}

async function fetchHoofootHighlights(limit: number): Promise<Highlight[]> {
  const homeHtml = await fetchWithProxy("https://hoofoot.com/");

  // Primary: extract /videos/{id}-{slug} hrefs
  const slugRegex = /href="\/videos\/(\d+)-([^"]+)"/g;
  const ids: string[] = [];
  const titleMap = new Map<string, string>();
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = slugRegex.exec(homeHtml)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    const slug = m[2].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    titleMap.set(id, slug);
    if (ids.length >= limit) break;
  }

  // Fallback: data-id pattern if primary yields nothing
  if (ids.length === 0) {
    const dataIdRegex = /data-id="(\d+)"/g;
    while ((m = dataIdRegex.exec(homeHtml)) !== null) {
      const id = m[1];
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
      if (ids.length >= limit) break;
    }
  }

  if (ids.length === 0) return [];

  const results = await Promise.all(
    ids.map(async (id): Promise<Highlight | null> => {
      try {
        const videoHtml = await fetchWithProxy(`https://hoofoot.com/videos.php?vv=${id}`);
        const hashMatch = videoHtml.match(/vibedailyhighlights\.com\/embed\/([a-zA-Z0-9]+)/);
        if (!hashMatch) return null;

        const hash = hashMatch[1];
        const title = titleMap.get(id) ?? `Football Highlight ${id}`;
        const competition = detectCompetition(title);

        return {
          id: `hoofoot:${id}`,
          matchId: null,
          title,
          competition,
          year: new Date().getFullYear(),
          thumbnail: `https://hoohfooha.vibedailyhighlights.com/embed/image/${hash}`,
          duration: null,
          source: "hoofoot",
          provider: "HooFoot",
          videoUrl: null,
          embedUrl: `https://hoohfooha.vibedailyhighlights.com/embed/${hash}`,
          publishedAt: new Date().toISOString(),
          verified: false,
        };
      } catch {
        return null;
      }
    })
  );

  const valid = results.filter((h): h is Highlight => h !== null);

  valid.sort((a, b) => {
    const aNum = parseInt(a.id.replace("hoofoot:", ""));
    const bNum = parseInt(b.id.replace("hoofoot:", ""));
    return bNum - aNum;
  });

  if (valid.length > 0) {
    fetch("/api/highlights/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ highlights: valid.slice(0, 20) }),
    }).catch(() => {});
  }

  return valid;
}

export function useHoofootHighlights(limit = 24) {
  return useQuery<Highlight[]>({
    queryKey: ["hoofoot-highlights", limit],
    queryFn: () => fetchHoofootHighlights(limit),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 2,
    retryDelay: 1000,
  });
}
