"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMatchesByDate, useLiveMatches } from "@/hooks/useMatches";
import { MatchCard } from "./MatchCard";
import { cn, formatMatchDate, getDateString } from "@/lib/utils";
import { Loader2, RefreshCw, Radio } from "lucide-react";
import type { NormalizedMatch } from "@/types";

const DATE_TABS = [
  { offset: -1, label: "Yesterday" },
  { offset: 0, label: "Today" },
  { offset: 1, label: "Tomorrow" },
  { offset: 2, label: "+2" },
  { offset: 3, label: "+3" },
];

function groupByCompetition(matches: NormalizedMatch[]): Record<string, NormalizedMatch[]> {
  return matches.reduce((acc, m) => {
    const key = m.competitionId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {} as Record<string, NormalizedMatch[]>);
}

export function ScoresDashboard() {
  const [selectedOffset, setSelectedOffset] = useState(0);
  const selectedDate = getDateString(selectedOffset);
  const isToday = selectedOffset === 0;

  const { data: liveMatches = [], isRefetching: liveRefetching } = useLiveMatches();
  const { data: dayMatches = [], isLoading, isFetching } = useMatchesByDate(selectedDate);

  // For "Today" tab: merge live matches (higher frequency) with day matches
  const allMatches: NormalizedMatch[] = isToday
    ? mergeMatches(liveMatches, dayMatches)
    : dayMatches;

  const liveCount = allMatches.filter((m) =>
    ["1H", "2H", "HT", "ET", "P"].includes(m.status),
  ).length;

  const grouped = groupByCompetition(allMatches);

  return (
    <div className="space-y-4">
      {/* Date tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {DATE_TABS.map(({ offset, label }) => {
          const date = getDateString(offset);
          const isActive = offset === selectedOffset;
          return (
            <button
              key={offset}
              onClick={() => setSelectedOffset(offset)}
              className={cn(
                "relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0",
                isActive
                  ? "text-pitch-green bg-pitch-green/10 border border-pitch-green/25"
                  : "text-pitch-text-secondary hover:text-pitch-text-primary hover:bg-pitch-muted/40 border border-transparent",
              )}
            >
              {label}
              {isActive && isToday && liveCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] bg-pitch-red/20 text-pitch-red px-1.5 py-0.5 rounded-full font-semibold">
                  <span className="w-1 h-1 bg-pitch-red rounded-full animate-pulse-live" />
                  {liveCount}
                </span>
              )}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {(isFetching || liveRefetching) && (
            <RefreshCw className="w-3.5 h-3.5 text-pitch-text-muted animate-spin" />
          )}
          {isToday && liveCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-pitch-red font-medium px-2 py-1 rounded-lg bg-pitch-red/10 border border-pitch-red/20">
              <Radio className="w-3 h-3" />
              {liveCount} live
            </div>
          )}
        </div>
      </div>

      {/* Match list */}
      {isLoading ? (
        <MatchListSkeleton />
      ) : allMatches.length === 0 ? (
        <EmptyState date={selectedDate} />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedDate}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            {Object.entries(grouped).map(([compId, matches]) => (
              <CompetitionGroup key={compId} matches={matches} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function CompetitionGroup({ matches }: { matches: NormalizedMatch[] }) {
  const first = matches[0];
  return (
    <div className="space-y-1.5">
      {/* Competition header */}
      <div className="flex items-center gap-2 px-1">
        {first.homeTeam && (
          <span className="text-xs font-semibold text-pitch-text-secondary uppercase tracking-wider">
            {first.competitionId.replace(/^[^:]+:/, "")} — {first.season}
          </span>
        )}
        <div className="flex-1 h-px bg-pitch-border/50" />
      </div>

      {/* Match cards */}
      <div className="space-y-1.5">
        {matches.map((match, i) => (
          <motion.div
            key={match.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <MatchCard match={match} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function MatchListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, g) => (
        <div key={g} className="space-y-1.5">
          <div className="h-4 w-32 rounded skeleton" />
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[76px] rounded-2xl skeleton" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ date }: { date: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center gap-3"
    >
      <div className="w-12 h-12 rounded-2xl bg-pitch-muted/40 border border-pitch-border flex items-center justify-center">
        <Radio className="w-6 h-6 text-pitch-text-muted" />
      </div>
      <div>
        <p className="text-pitch-text-secondary font-medium">No matches found</p>
        <p className="text-pitch-text-muted text-sm mt-1">No fixtures scheduled for {date}</p>
      </div>
    </motion.div>
  );
}

function mergeMatches(live: NormalizedMatch[], day: NormalizedMatch[]): NormalizedMatch[] {
  const liveIds = new Set(live.map((m) => m.id));
  // Replace day match with live match where they overlap (live has fresher data)
  const merged = day.map((m) => liveIds.has(m.id) ? live.find((l) => l.id === m.id)! : m);
  // Add any live matches not in the day list
  const dayIds = new Set(day.map((m) => m.id));
  const extraLive = live.filter((m) => !dayIds.has(m.id));
  return [...extraLive, ...merged];
}
