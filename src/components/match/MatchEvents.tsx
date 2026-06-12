"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMatchEvents } from "@/hooks/useMatches";
import { cn } from "@/lib/utils";
import type { NormalizedMatch, NormalizedMatchEvent } from "@/types";
import { Calendar } from "lucide-react";

interface MatchEventsProps {
  matchId: string;
  isLive: boolean;
  match: NormalizedMatch;
}

const EVENT_CONFIG: Record<
  string,
  { icon: string; label: string; homeColor: string; awayColor: string }
> = {
  "Goal":           { icon: "⚽", label: "Goal",          homeColor: "text-pitch-green",  awayColor: "text-pitch-green" },
  "Penalty Goal":   { icon: "⚽", label: "Penalty",       homeColor: "text-pitch-green",  awayColor: "text-pitch-green" },
  "Own Goal":       { icon: "⚽", label: "Own Goal",      homeColor: "text-pitch-red",    awayColor: "text-pitch-red" },
  "Penalty Missed": { icon: "❌", label: "Pen. Missed",   homeColor: "text-pitch-text-muted", awayColor: "text-pitch-text-muted" },
  "Yellow Card":    { icon: "🟨", label: "Yellow Card",   homeColor: "text-pitch-gold",   awayColor: "text-pitch-gold" },
  "Red Card":       { icon: "🟥", label: "Red Card",      homeColor: "text-pitch-red",    awayColor: "text-pitch-red" },
  "Yellow Red Card":{ icon: "🟥", label: "2nd Yellow",   homeColor: "text-pitch-red",    awayColor: "text-pitch-red" },
  "Substitution":   { icon: "🔄", label: "Sub",           homeColor: "text-pitch-blue",   awayColor: "text-pitch-blue" },
  "VAR":            { icon: "📺", label: "VAR",           homeColor: "text-purple-400",   awayColor: "text-purple-400" },
};

export function MatchEvents({ matchId, isLive, match }: MatchEventsProps) {
  const { data: events = [], isLoading } = useMatchEvents(matchId, isLive);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl skeleton" />
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="glass rounded-2xl border border-pitch-border/60 px-6 py-10 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-pitch-muted/40 border border-pitch-border flex items-center justify-center">
          <Calendar className="w-6 h-6 text-pitch-text-muted" />
        </div>
        <p className="text-sm font-medium text-pitch-text-secondary">
          {isLive ? "Waiting for match events…" : "No events recorded"}
        </p>
      </div>
    );
  }

  // Sort by minute desc (most recent first)
  const sorted = [...events].sort((a, b) => {
    const am = a.minute + (a.extraMinute ?? 0);
    const bm = b.minute + (b.extraMinute ?? 0);
    return bm - am;
  });

  // Group by period
  const secondHalf = sorted.filter((e) => e.minute > 45);
  const firstHalf  = sorted.filter((e) => e.minute <= 45);

  return (
    <div className="space-y-3">
      {secondHalf.length > 0 && (
        <PeriodGroup label="Second Half" events={secondHalf} match={match} />
      )}
      <PeriodDivider label="Half Time" />
      {firstHalf.length > 0 && (
        <PeriodGroup label="First Half" events={firstHalf} match={match} />
      )}
    </div>
  );
}

function PeriodGroup({
  label,
  events,
  match,
}: {
  label: string;
  events: NormalizedMatchEvent[];
  match: NormalizedMatch;
}) {
  return (
    <div className="glass rounded-2xl border border-pitch-border/60 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-pitch-border/40">
        <span className="text-xs font-semibold text-pitch-text-muted uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[calc(50%-0.5px)] top-0 bottom-0 w-px bg-pitch-border/40" />

        <div className="divide-y divide-pitch-border/30">
          <AnimatePresence initial={false}>
            {events.map((event, i) => (
              <EventRow key={event.id} event={event} match={match} index={i} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function EventRow({
  event,
  match,
  index,
}: {
  event: NormalizedMatchEvent;
  match: NormalizedMatch;
  index: number;
}) {
  const cfg = EVENT_CONFIG[event.type] ?? { icon: "•", label: event.type, homeColor: "text-pitch-text-muted", awayColor: "text-pitch-text-muted" };
  const isHome = event.teamSide === "home";
  const isGoal = ["Goal", "Penalty Goal", "Own Goal"].includes(event.type);

  const minuteStr = event.extraMinute
    ? `${event.minute}+${event.extraMinute}'`
    : `${event.minute}'`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 transition-colors",
        isGoal && "bg-pitch-green/4",
      )}
    >
      {/* Home side */}
      <div className={cn("flex flex-col items-end text-right", !isHome && "opacity-0")}>
        {isHome && (
          <>
            <span className={cn("text-sm font-semibold truncate", cfg.homeColor)}>
              {event.playerName}
            </span>
            {event.assistPlayerName && (
              <span className="text-[11px] text-pitch-text-muted">
                assist: {event.assistPlayerName}
              </span>
            )}
            {event.detail && !event.assistPlayerName && (
              <span className="text-[11px] text-pitch-text-muted">{event.detail}</span>
            )}
          </>
        )}
      </div>

      {/* Center: minute + icon */}
      <div className="flex flex-col items-center gap-1 z-10">
        <span className={cn(
          "text-[11px] font-bold tabular-nums",
          isGoal ? "text-pitch-green" : "text-pitch-text-muted",
        )}>
          {minuteStr}
        </span>
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-base border-2 shadow-sm",
          isGoal
            ? "border-pitch-green bg-pitch-green/10"
            : "border-pitch-border/60 bg-pitch-card",
        )}>
          {cfg.icon}
        </div>
        <span className="text-[9px] text-pitch-text-muted uppercase tracking-wider">
          {cfg.label}
        </span>
      </div>

      {/* Away side */}
      <div className={cn("flex flex-col items-start text-left", isHome && "opacity-0")}>
        {!isHome && (
          <>
            <span className={cn("text-sm font-semibold truncate", cfg.awayColor)}>
              {event.playerName}
            </span>
            {event.assistPlayerName && (
              <span className="text-[11px] text-pitch-text-muted">
                assist: {event.assistPlayerName}
              </span>
            )}
            {event.detail && !event.assistPlayerName && (
              <span className="text-[11px] text-pitch-text-muted">{event.detail}</span>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

function PeriodDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-pitch-border/40" />
      <span className="text-[11px] font-semibold text-pitch-text-muted uppercase tracking-wider px-3 py-1 rounded-full border border-pitch-border/40 bg-pitch-muted/20">
        {label}
      </span>
      <div className="flex-1 h-px bg-pitch-border/40" />
    </div>
  );
}
