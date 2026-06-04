"use client";

import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";

export function LiveTicker() {
  const { data } = useQuery({
    queryKey: ["live-matches-ticker"],
    queryFn: async () => {
      const res = await fetch("/api/matches/live");
      if (!res.ok) return [];
      const json = await res.json();
      return json.matches ?? [];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const liveMatches: string[] = (data ?? [])
    .filter((m: any) => ["1H", "2H", "HT", "ET", "P"].includes(m.status))
    .map((m: any) => {
      const min = m.minute ? `${m.minute}'` : m.status;
      return `${m.homeTeamName} ${m.homeScore ?? 0}–${m.awayScore ?? 0} ${m.awayTeamName} (${min})`;
    });

  if (!liveMatches.length) return null;

  // Duplicate for seamless loop
  const items = [...liveMatches, ...liveMatches];

  return (
    <div className="h-7 bg-pitch-red/10 border-b border-pitch-red/20 flex items-center overflow-hidden shrink-0">
      <div className="flex items-center gap-2 px-3 shrink-0 border-r border-pitch-red/20 h-full bg-pitch-red/15">
        <span className="live-dot" />
        <Radio className="w-3 h-3 text-pitch-red" />
        <span className="text-pitch-red text-xs font-semibold uppercase tracking-wider">Live</span>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div
          className="flex gap-8 whitespace-nowrap text-xs text-pitch-text-secondary font-medium"
          style={{ animation: `ticker ${Math.max(items.length * 4, 20)}s linear infinite` }}
        >
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-pitch-red/60 shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
