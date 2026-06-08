"use client";

import { useQuery } from "@tanstack/react-query";
import { Highlight } from "@/types";

const HOOFOOT_HOME = "https://hoofoot.com/";
const HOOFOOT_VIDEOS = "https://hoofoot.com/videos.php";

interface RawMatch {
  id: string;
  thumbId: string;
  matchUrl: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  competition: string;
}

async function fetchHoofootList(): Promise<RawMatch[]> {
  const res = await fetch(HOOFOOT_HOME, { credentials: "omit" });
  const html = await res.text();

  const ids = [...html.matchAll(/id="drut(\d+)"/g)].map((m) => m[1]);
  const thumbMatches = [...html.matchAll(/src="https:\/\/th\.hoofoot\.com\/pics\/(\d+)\.jpg"/g)];
  const thumbIds = thumbMatches.map((m) => m[1]);
  const urlMatches = [...html.matchAll(/href="(https:\/\/hoofoot\.com\/\?match=([^"]+))"/g)];
  const matchUrls = urlMatches.map((m) => m[1]);
  const compMatches = [...html.matchAll(/hoofoot\.com\/x\/([^"]+?)(?:\.jpg|")/g)];
  const comps = compMatches.map((m) => m[1].replace(/\+/g, " ").replace(/_/g, " "));

  const results: RawMatch[] = [];
  for (let i = 0; i < Math.min(ids.length, matchUrls.length); i++) {
    const urlParam = matchUrls[i].replace("https://hoofoot.com/?match=", "");
    const dateMatch = urlParam.match(/_(\d{4})_(\d{2})_(\d{2})$/);
    if (!dateMatch) continue;
    const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    const teamsRaw = urlParam.replace(`_${dateMatch[1]}_${dateMatch[2]}_${dateMatch[3]}`, "");
    const parts = teamsRaw.split("_v_");
    results.push({
      id: ids[i],
      thumbId: thumbIds[i] ?? "",
      matchUrl: matchUrls[i],
      homeTeam: (parts[0] ?? "Home").replace(/_/g, " "),
      awayTeam: (parts[1] ?? "Away").replace(/_/g, " "),
      date,
      competition: comps[i] ?? "Football",
    });
  }
  return results;
}

async function fetchVideoEmbed(id: string): Promise<{ embedHash: string; thumbnailUrl: string } | null> {
  try {
    const res = await fetch(HOOFOOT_VIDEOS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Referer": HOOFOOT_HOME },
      body: `vv=${id}`,
      credentials: "omit",
    });
    const html = await res.text();
    const hashMatch = html.match(/vibedailyhighlights\.com\/embed\/([A-Za-z0-9_-]+)/);
    if (!hashMatch) return null;
    const embedHash = hashMatch[1];
    return {
      embedHash,
      thumbnailUrl: `https://hoohfooha.vibedailyhighlights.com/embed/image/${embedHash}`,
    };
  } catch {
    return null;
  }
}

export function useHoofootHighlights(limit = 24) {
  return useQuery<Highlight[]>({
    queryKey: ["hoofoot-highlights", limit],
    queryFn: async () => {
      const matches = await fetchHoofootList();
      const top = matches.slice(0, limit);

      const highlights = await Promise.all(
        top.map(async (m): Promise<Highlight | null> => {
          const embed = await fetchVideoEmbed(m.id);
          if (!embed) return null;
          return {
            id: `hoofoot:${m.id}`,
            matchId: null,
            title: `${m.homeTeam} vs ${m.awayTeam} – Highlights`,
            competition: m.competition,
            year: parseInt(m.date.slice(0, 4)),
            thumbnail: embed.thumbnailUrl,
            duration: null,
            source: "hoofoot",
            provider: "HooFoot",
            videoUrl: null,
            embedUrl: `https://hoohfooha.vibedailyhighlights.com/embed/${embed.embedHash}`,
            publishedAt: m.date + "T12:00:00Z",
            verified: false,
          };
        })
      );

      const valid = highlights.filter((h): h is Highlight => h !== null);

      // Write-back to Firestore via ingest endpoint (fire and forget)
      // This caches hoofoot data server-side so other users get it from Firestore
      if (valid.length > 0) {
        fetch("/api/highlights/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ highlights: valid.slice(0, 20) }),
        }).catch(() => { /* ignore failures */ });
      }

      return valid;
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}
