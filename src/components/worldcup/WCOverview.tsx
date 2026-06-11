"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { WC_FIXTURES, WC_TEAMS } from "@/lib/worldcup2026/data";
import { formatKickoff } from "@/lib/utils";

interface WCMeta {
  nextMatches: Array<{
    id: string; homeTeamCode: string; awayTeamCode: string;
    kickoffUtc: string; venue: string; city: string; country: string;
    homeTeam: typeof WC_TEAMS[string];
    awayTeam: typeof WC_TEAMS[string];
  }>;
  todayFixtureCount: number;
  daysUntilFinal: number;
  totalTeams: number;
  totalMatches: number;
  hostCities: number;
}

const STATS = [
  { key: "totalTeams",    label: "Teams",         icon: "🌍" },
  { key: "totalMatches",  label: "Matches",       icon: "⚽" },
  { key: "hostCities",    label: "Host Cities",   icon: "🏟️" },
  { key: "daysUntilFinal", label: "Days to Final", icon: "🏆" },
] as const;

export function WCOverview() {
  const { data } = useQuery<WCMeta>({
    queryKey: ["wc-overview"],
    queryFn: async () => {
      const res = await fetch("/api/world-cup");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    staleTime: 60_000,
  });

  const meta = data ?? {
    totalTeams: 48, totalMatches: 104, hostCities: 16, daysUntilFinal: 0,
    todayFixtureCount: 0, nextMatches: [],
  };

  // Fallback: first upcoming fixture from static data
  const now = new Date();
  const nextStaticFixture = WC_FIXTURES.find((f) => new Date(f.kickoffUtc) > now);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
            className="glass-card flex flex-col items-center justify-center gap-1 text-center py-6"
          >
            <span className="text-2xl">{stat.icon}</span>
            <span className="text-3xl font-bold text-pitch-green tabular-nums">
              {meta[stat.key]}
            </span>
            <span className="text-xs text-pitch-text-muted uppercase tracking-wide">
              {stat.label}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Next fixtures */}
      {(meta.nextMatches.length > 0 || nextStaticFixture) && (
        <div className="glass-card space-y-3">
          <h3 className="text-sm font-bold text-pitch-text-secondary uppercase tracking-wider">
            Upcoming Fixtures
          </h3>
          {(meta.nextMatches.length > 0
            ? meta.nextMatches
            : nextStaticFixture
              ? [{
                  ...nextStaticFixture,
                  homeTeam: WC_TEAMS[nextStaticFixture.homeTeamCode],
                  awayTeam: WC_TEAMS[nextStaticFixture.awayTeamCode],
                }]
              : []
          ).map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2 border-b border-pitch-border/20 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-xl">{f.homeTeam?.flag ?? "🏳️"}</span>
                <span className="text-sm font-semibold text-pitch-text-primary">
                  {f.homeTeam?.shortName ?? f.homeTeamCode}
                </span>
                <span className="text-xs text-pitch-text-muted font-bold">vs</span>
                <span className="text-sm font-semibold text-pitch-text-primary">
                  {f.awayTeam?.shortName ?? f.awayTeamCode}
                </span>
                <span className="text-xl">{f.awayTeam?.flag ?? "🏳️"}</span>
              </div>
              <div suppressHydrationWarning className="text-right">
                <div suppressHydrationWarning className="text-sm font-mono font-bold text-pitch-green">
                  {formatKickoff(f.kickoffUtc)}
                </div>
                <div className="text-xs text-pitch-text-muted">{f.city}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <Link href="/competitions" className="glass glass-hover rounded-xl px-4 py-2 text-sm font-semibold text-pitch-text-secondary border border-pitch-border/40 transition">
          📊 View Standings
        </Link>
        <Link href="/streams" className="glass glass-hover rounded-xl px-4 py-2 text-sm font-semibold text-pitch-text-secondary border border-pitch-border/40 transition">
          📺 Watch Streams
        </Link>
        <Link href="/news" className="glass glass-hover rounded-xl px-4 py-2 text-sm font-semibold text-pitch-text-secondary border border-pitch-border/40 transition">
          📰 Latest News
        </Link>
      </div>
    </div>
  );
}
