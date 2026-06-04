"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { Play, ChevronRight, Radio } from "lucide-react";
import { cn, formatMatchTime, formatKickoff, isLiveStatus } from "@/lib/utils";
import { usePrefetchMatch } from "@/hooks/useMatches";
import type { NormalizedMatch, NormalizedMatchEvent } from "@/types";

interface MatchCardProps {
  match: NormalizedMatch;
}

const EVENT_ICON: Record<string, string> = {
  Goal: "⚽",
  "Own Goal": "⚽",
  "Penalty Goal": "⚽",
  "Yellow Card": "🟨",
  "Red Card": "🟥",
  "Yellow Red Card": "🟥",
  Substitution: "🔄",
  VAR: "📺",
};

export function MatchCard({ match }: MatchCardProps) {
  const isLive = isLiveStatus(match.status);
  const isFinished = ["FT", "AET", "PEN"].includes(match.status);
  const isScheduled = match.status === "NS";
  const prefetch = usePrefetchMatch(match.id);

  const recentGoals = match.events
    .filter((e) => ["Goal", "Penalty Goal", "Own Goal"].includes(e.type))
    .slice(-2);

  return (
    <Link
      href={`/match/${match.id}`}
      onMouseEnter={prefetch}
      className={cn(
        "group relative block rounded-2xl overflow-hidden transition-all duration-200",
        "glass glass-hover border",
        isLive
          ? "border-pitch-green/20 glow-green animate-glow-pulse"
          : "border-pitch-border/60",
      )}
    >
      {/* Live bar */}
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-pitch-green to-transparent" />
      )}

      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Status / time */}
          <div className="w-14 shrink-0 text-center">
            {isLive ? (
              <div className="space-y-0.5">
                <div className="flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 bg-pitch-red rounded-full animate-pulse-live" />
                  <span className="text-pitch-red text-xs font-bold tabular-nums">
                    {formatMatchTime(match.status, match.minute)}
                  </span>
                </div>
                {match.injuryTime && (
                  <span className="text-[10px] text-pitch-text-muted">+{match.injuryTime}</span>
                )}
              </div>
            ) : isFinished ? (
              <span className="text-pitch-text-muted text-xs font-medium">FT</span>
            ) : (
              <span className="text-pitch-text-secondary text-xs font-medium">
                {formatKickoff(match.startTime)}
              </span>
            )}
          </div>

          {/* Teams + scores */}
          <div className="flex-1 min-w-0">
            <TeamRow
              team={match.homeTeam}
              score={match.homeScore}
              isLive={isLive || isFinished}
              events={match.events.filter((e) => e.teamSide === "home")}
              isWinner={
                match.homeScore !== null &&
                match.awayScore !== null &&
                match.homeScore > match.awayScore
              }
            />
            <TeamRow
              team={match.awayTeam}
              score={match.awayScore}
              isLive={isLive || isFinished}
              events={match.events.filter((e) => e.teamSide === "away")}
              isWinner={
                match.homeScore !== null &&
                match.awayScore !== null &&
                match.awayScore > match.homeScore
              }
            />
          </div>

          {/* Right: action icons */}
          <div className="shrink-0 flex items-center gap-2">
            {isLive && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-pitch-green/10 border border-pitch-green/20">
                <Play className="w-3 h-3 text-pitch-green fill-pitch-green" />
                <span className="text-pitch-green text-[10px] font-semibold">Stream</span>
              </div>
            )}
            <ChevronRight className="w-4 h-4 text-pitch-text-muted group-hover:text-pitch-text-secondary transition-colors" />
          </div>
        </div>

        {/* Recent goal scorers */}
        {recentGoals.length > 0 && (
          <div className="mt-2 ml-14 flex flex-wrap gap-2">
            {recentGoals.map((e) => (
              <span key={e.id} className="text-[11px] text-pitch-text-muted flex items-center gap-1">
                ⚽ {e.playerName} {e.minute}'
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

interface TeamRowProps {
  team: NormalizedMatch["homeTeam"];
  score: number | null;
  isLive: boolean;
  events: NormalizedMatchEvent[];
  isWinner: boolean;
}

function TeamRow({ team, score, isLive, events, isWinner }: TeamRowProps) {
  const yellowCards = events.filter((e) => e.type === "Yellow Card").length;
  const redCards = events.filter((e) => ["Red Card", "Yellow Red Card"].includes(e.type)).length;
  const goals = events.filter((e) => ["Goal", "Penalty Goal"].includes(e.type));

  return (
    <div className="flex items-center gap-2 py-0.5">
      {/* Flag */}
      <span className="text-base leading-none">{(team as any).flag ?? "🏳️"}</span>

      {/* Name */}
      <span
        className={cn(
          "flex-1 text-sm truncate transition-colors",
          isWinner ? "text-pitch-text-primary font-semibold" : "text-pitch-text-secondary",
        )}
      >
        {team.shortName || team.name}
      </span>

      {/* Cards + events */}
      <div className="flex items-center gap-1">
        {yellowCards > 0 && (
          <span className="text-[10px] bg-pitch-gold/20 text-pitch-gold px-1 rounded font-medium">
            {yellowCards > 1 ? yellowCards : ""}{" "}🟨
          </span>
        )}
        {redCards > 0 && (
          <span className="text-[10px] bg-pitch-red/20 text-pitch-red px-1 rounded font-medium">
            🟥
          </span>
        )}
      </div>

      {/* Score */}
      {isLive && score !== null ? (
        <AnimatePresence mode="wait">
          <motion.span
            key={score}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className={cn(
              "w-6 text-center text-sm font-bold tabular-nums",
              isWinner ? "text-pitch-text-primary" : "text-pitch-text-secondary",
            )}
          >
            {score}
          </motion.span>
        </AnimatePresence>
      ) : (
        <span className="w-6 text-center text-sm text-pitch-text-muted">
          {score ?? "-"}
        </span>
      )}
    </div>
  );
}
