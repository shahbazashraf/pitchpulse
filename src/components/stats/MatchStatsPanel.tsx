"use client";

import { motion } from "framer-motion";
import { useMatchStats } from "@/hooks/useMatches";
import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NormalizedMatchStats, NormalizedMatch } from "@/types";

interface MatchStatsPanelProps {
  matchId: string;
  isLive: boolean;
  match: NormalizedMatch;
}

interface StatRow {
  label: string;
  key: keyof NormalizedMatchStats;
  format?: (v: number) => string;
  isPercentage?: boolean;
  highlight?: boolean;
}

const STAT_ROWS: StatRow[] = [
  { label: "Possession", key: "ballPossession", isPercentage: true, highlight: true, format: (v) => `${v}%` },
  { label: "Expected Goals (xG)", key: "expectedGoals", highlight: true, format: (v) => v.toFixed(2) },
  { label: "Total Shots", key: "totalShots" },
  { label: "Shots on Target", key: "shotsOnGoal" },
  { label: "Shots off Target", key: "shotsOffGoal" },
  { label: "Blocked Shots", key: "blockedShots" },
  { label: "Corner Kicks", key: "cornerKicks" },
  { label: "Fouls", key: "fouls" },
  { label: "Offsides", key: "offsides" },
  { label: "Yellow Cards", key: "yellowCards" },
  { label: "Red Cards", key: "redCards" },
  { label: "Goalkeeper Saves", key: "goalkeeperSaves" },
  { label: "Total Passes", key: "totalPasses" },
  { label: "Pass Accuracy", key: "passAccuracy", isPercentage: true, format: (v) => `${v}%` },
];

export function MatchStatsPanel({ matchId, isLive, match }: MatchStatsPanelProps) {
  const { data: stats, isLoading } = useMatchStats(matchId, isLive);

  if (isLoading) return <StatsSkeleton />;

  if (!stats?.length) {
    return (
      <div className="glass rounded-2xl border border-pitch-border/60 px-6 py-10 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-pitch-muted/40 border border-pitch-border flex items-center justify-center">
          <BarChart2 className="w-6 h-6 text-pitch-text-muted" />
        </div>
        <p className="text-sm font-medium text-pitch-text-secondary">
          {isLive ? "Stats loading…" : "Stats not available"}
        </p>
      </div>
    );
  }

  const homeStat = stats.find((s) => s.side === "home");
  const awayStat = stats.find((s) => s.side === "away");

  return (
    <div className="glass rounded-2xl border border-pitch-border/60 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-pitch-border/40 grid grid-cols-3 items-center">
        <span className="text-sm font-bold text-pitch-green text-left">
          {match.homeTeam.shortName}
        </span>
        <span className="text-[10px] text-pitch-text-muted uppercase tracking-wider text-center">
          Statistics
        </span>
        <span className="text-sm font-bold text-pitch-blue text-right">
          {match.awayTeam.shortName}
        </span>
      </div>

      {/* Stat rows */}
      <div className="px-4 py-3 space-y-4">
        {STAT_ROWS.map((row, i) => {
          const homeVal = homeStat?.[row.key] as number | null ?? null;
          const awayVal = awayStat?.[row.key] as number | null ?? null;
          if (homeVal === null && awayVal === null) return null;

          return (
            <StatRowItem
              key={row.key}
              row={row}
              homeVal={homeVal}
              awayVal={awayVal}
              index={i}
            />
          );
        }).filter(Boolean)}
      </div>
    </div>
  );
}

function StatRowItem({
  row,
  homeVal,
  awayVal,
  index,
}: {
  row: StatRow;
  homeVal: number | null;
  awayVal: number | null;
  index: number;
}) {
  const hv = homeVal ?? 0;
  const av = awayVal ?? 0;
  const total = hv + av;

  // For percentage stats (possession), bar width IS the value
  const homeWidth = row.isPercentage ? hv : (total > 0 ? (hv / total) * 100 : 50);
  const awayWidth = row.isPercentage ? av : (total > 0 ? (av / total) * 100 : 50);

  const fmt = row.format ?? String;
  const homeDisplay = homeVal !== null ? fmt(hv) : "–";
  const awayDisplay = awayVal !== null ? fmt(av) : "–";

  const homeLeads = hv > av;
  const awayLeads = av > hv;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="space-y-1.5"
    >
      {/* Values + label */}
      <div className="flex items-center justify-between text-sm">
        <span className={cn(
          "font-bold tabular-nums w-12",
          homeLeads && row.highlight ? "text-pitch-green" : "text-pitch-text-primary",
        )}>
          {homeDisplay}
        </span>
        <span className="text-[11px] text-pitch-text-muted font-medium">{row.label}</span>
        <span className={cn(
          "font-bold tabular-nums w-12 text-right",
          awayLeads && row.highlight ? "text-pitch-blue" : "text-pitch-text-primary",
        )}>
          {awayDisplay}
        </span>
      </div>

      {/* Bar */}
      <div className="flex gap-1 items-center h-1.5">
        {/* Home bar (right-aligned) */}
        <div className="flex-1 flex justify-end">
          <motion.div
            className={cn(
              "h-1.5 rounded-full",
              homeLeads ? "bg-pitch-green" : "bg-pitch-text-muted/40",
            )}
            initial={{ width: 0 }}
            animate={{ width: `${homeWidth}%` }}
            transition={{ duration: 0.8, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
            style={{ maxWidth: "100%" }}
          />
        </div>
        <div className="w-px h-2.5 bg-pitch-border shrink-0" />
        {/* Away bar (left-aligned) */}
        <div className="flex-1">
          <motion.div
            className={cn(
              "h-1.5 rounded-full",
              awayLeads ? "bg-pitch-blue" : "bg-pitch-text-muted/40",
            )}
            initial={{ width: 0 }}
            animate={{ width: `${awayWidth}%` }}
            transition={{ duration: 0.8, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
            style={{ maxWidth: "100%" }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function StatsSkeleton() {
  return (
    <div className="glass rounded-2xl border border-pitch-border/60 overflow-hidden">
      <div className="h-12 border-b border-pitch-border/40 skeleton" />
      <div className="px-4 py-4 space-y-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 skeleton rounded" />
            <div className="h-1.5 skeleton rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
