"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NormalizedStanding, StandingEntry } from "@/types";

const FEATURED_COMPETITIONS = [
  { id: "fifa-world-cup-2026", label: "FIFA World Cup 2026", icon: "🏆", featured: true },
  { id: "champions-league",    label: "UEFA Champions League", icon: "⭐" },
  { id: "premier-league",      label: "Premier League", icon: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "la-liga",             label: "La Liga", icon: "🇪🇸" },
  { id: "bundesliga",          label: "Bundesliga", icon: "🇩🇪" },
  { id: "serie-a",             label: "Serie A", icon: "🇮🇹" },
  { id: "ligue-1",             label: "Ligue 1", icon: "🇫🇷" },
];

export default function CompetitionsPage() {
  const [selected, setSelected] = useState("fifa-world-cup-2026");
  const comp = FEATURED_COMPETITIONS.find((c) => c.id === selected);

  const { data: standings = [], isLoading } = useQuery<NormalizedStanding[]>({
    queryKey: ["standings", selected],
    queryFn: async () => {
      const res = await fetch(`/api/standings?competition=${selected}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.standings ?? [];
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-pitch-green/10 border border-pitch-green/20 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-pitch-green" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-pitch-text-primary">Competitions</h1>
          <p className="text-xs text-pitch-text-muted">Live tables & group standings</p>
        </div>
      </div>

      {/* Competition selector */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {FEATURED_COMPETITIONS.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 transition-all border",
              selected === c.id
                ? "bg-pitch-green/10 border-pitch-green/25 text-pitch-green"
                : "bg-pitch-muted/20 border-pitch-border/40 text-pitch-text-secondary hover:text-pitch-text-primary hover:border-pitch-border",
            )}
          >
            <span>{c.icon}</span>
            <span className="hidden sm:inline">{c.label}</span>
          </button>
        ))}
      </div>

      {/* Standings */}
      {isLoading ? (
        <StandingsSkeleton />
      ) : standings.length === 0 ? (
        <EmptyStandings />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            {standings.map((group, i) => (
              <StandingGroup key={`${group.group ?? i}`} standing={group} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function StandingGroup({ standing, index }: { standing: NormalizedStanding; index: number }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass rounded-2xl border border-pitch-border/60 overflow-hidden"
    >
      {/* Group header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-pitch-muted/10 transition-colors"
      >
        <span className="text-sm font-bold text-pitch-text-primary">
          {standing.group ? `Group ${standing.group}` : "Standings"}
        </span>
        <motion.div animate={{ rotate: collapsed ? -90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-pitch-text-muted" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            {/* Column headers */}
            <div className="px-4 pb-1 grid grid-cols-[1fr_repeat(6,_auto)] gap-2 text-[10px] font-semibold text-pitch-text-muted uppercase tracking-wider border-t border-pitch-border/30">
              <span>Team</span>
              <span className="w-6 text-center">P</span>
              <span className="w-6 text-center">W</span>
              <span className="w-6 text-center">D</span>
              <span className="w-6 text-center">L</span>
              <span className="w-8 text-center">GD</span>
              <span className="w-8 text-center font-bold text-pitch-text-primary">Pts</span>
            </div>

            <div className="divide-y divide-pitch-border/20">
              {standing.entries.map((entry, i) => (
                <StandingRow key={entry.team.id} entry={entry} rank={i + 1} total={standing.entries.length} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StandingRow({ entry, rank, total }: { entry: StandingEntry; rank: number; total: number }) {
  const isQualified = rank <= 2; // top 2 from each group advance in WC
  const isEliminated = rank === total;

  const formChars = entry.form?.slice(-5).split("") ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "px-4 py-2.5 grid grid-cols-[1fr_repeat(6,_auto)] gap-2 items-center transition-colors hover:bg-pitch-muted/10",
        isQualified && "border-l-2 border-pitch-green",
        isEliminated && "opacity-60",
      )}
    >
      {/* Team */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn(
          "text-xs font-bold w-4 shrink-0 tabular-nums",
          isQualified ? "text-pitch-green" : "text-pitch-text-muted",
        )}>
          {rank}
        </span>
        <span className="text-sm shrink-0">{(entry.team as any).flag ?? "🏳️"}</span>
        <span className="text-sm font-medium text-pitch-text-primary truncate">
          {entry.team.shortName || entry.team.name}
        </span>
        {/* Form */}
        <div className="hidden sm:flex gap-0.5 ml-1">
          {formChars.map((f, i) => (
            <span key={i} className={cn(
              "w-3.5 h-3.5 rounded-sm text-[9px] font-bold flex items-center justify-center",
              f === "W" ? "bg-pitch-green/20 text-pitch-green" :
              f === "D" ? "bg-pitch-text-muted/20 text-pitch-text-muted" :
              "bg-pitch-red/20 text-pitch-red",
            )}>
              {f}
            </span>
          ))}
        </div>
      </div>

      <span className="w-6 text-center text-xs text-pitch-text-secondary tabular-nums">{entry.played}</span>
      <span className="w-6 text-center text-xs text-pitch-text-secondary tabular-nums">{entry.win}</span>
      <span className="w-6 text-center text-xs text-pitch-text-secondary tabular-nums">{entry.draw}</span>
      <span className="w-6 text-center text-xs text-pitch-text-secondary tabular-nums">{entry.lose}</span>
      <span className={cn(
        "w-8 text-center text-xs tabular-nums font-medium",
        entry.goalDifference > 0 ? "text-pitch-green" : entry.goalDifference < 0 ? "text-pitch-red" : "text-pitch-text-muted",
      )}>
        {entry.goalDifference > 0 ? "+" : ""}{entry.goalDifference}
      </span>
      <span className="w-8 text-center text-sm font-bold text-pitch-text-primary tabular-nums">
        {entry.points}
      </span>
    </motion.div>
  );
}

function StandingsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass rounded-2xl border border-pitch-border/60 overflow-hidden">
          <div className="h-12 skeleton" />
          <div className="divide-y divide-pitch-border/20">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-10 px-4 flex items-center">
                <div className="w-full h-4 rounded skeleton" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyStandings() {
  return (
    <div className="glass rounded-2xl border border-pitch-border/60 px-6 py-12 flex flex-col items-center gap-3 text-center">
      <Trophy className="w-8 h-8 text-pitch-text-muted" />
      <p className="text-sm font-medium text-pitch-text-secondary">No standings available yet</p>
      <p className="text-xs text-pitch-text-muted">Standings will appear once matches begin</p>
    </div>
  );
}
