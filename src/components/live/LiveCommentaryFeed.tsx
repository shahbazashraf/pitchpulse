"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Commentary } from "@/types";

interface LiveCommentaryFeedProps {
  matchId: string;
  isLive: boolean;
}

const EVENT_STYLES: Record<string, string> = {
  Goal:           "border-l-4 border-pitch-green bg-pitch-green/8",
  "Penalty Goal": "border-l-4 border-pitch-green bg-pitch-green/8",
  "Own Goal":     "border-l-4 border-pitch-gold bg-pitch-gold/8",
  "Red Card":     "border-l-4 border-pitch-red bg-pitch-red/8",
  "Yellow Red Card": "border-l-4 border-pitch-red bg-pitch-red/8",
  "Yellow Card":  "border-l-4 border-pitch-gold bg-pitch-gold/8",
  VAR:            "border-l-4 border-purple-400 bg-purple-400/8",
  halftime:       "border-l-4 border-pitch-blue bg-pitch-blue/8",
  fulltime:       "border-l-4 border-pitch-blue bg-pitch-blue/8",
};

const EVENT_ICONS: Record<string, string> = {
  Goal: "⚽", "Penalty Goal": "⚽", "Own Goal": "⚽",
  "Yellow Card": "🟨", "Red Card": "🟥", "Yellow Red Card": "🟥",
  Substitution: "🔄", VAR: "📺",
  halftime: "⏸️", fulltime: "🏁",
};

export function LiveCommentaryFeed({ matchId, isLive }: LiveCommentaryFeedProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const prevLength = useRef(0);

  const { data: entries = [], isLoading } = useQuery<Commentary[]>({
    queryKey: ["commentary", matchId],
    queryFn: async () => {
      // Commentary lives in Firestore — fetch via a dedicated endpoint
      const res = await fetch(`/api/commentary/${matchId}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.commentary ?? [];
    },
    refetchInterval: isLive ? 12_000 : false,
    staleTime: isLive ? 8_000 : Infinity,
  });

  // Detect new entries while scrolled away
  useEffect(() => {
    if (entries.length > prevLength.current) {
      const added = entries.length - prevLength.current;
      if (!autoScroll) setNewCount((n) => n + added);
      prevLength.current = entries.length;
    }
  }, [entries.length, autoScroll]);

  // Auto-scroll to top (newest) when enabled
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [entries, autoScroll]);

  // Detect manual scroll away from top
  const handleScroll = () => {
    if (!feedRef.current) return;
    const atTop = feedRef.current.scrollTop < 40;
    if (atTop !== autoScroll) {
      setAutoScroll(atTop);
      if (atTop) setNewCount(0);
    }
  };

  const scrollToTop = () => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setAutoScroll(true);
    setNewCount(0);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl skeleton" />
        ))}
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="glass rounded-2xl border border-pitch-border/60 px-6 py-10 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-pitch-muted/40 border border-pitch-border flex items-center justify-center">
          <MessageSquare className="w-6 h-6 text-pitch-text-muted" />
        </div>
        <p className="text-sm font-medium text-pitch-text-secondary">
          {isLive ? "Commentary will appear here" : "No commentary available"}
        </p>
        <p className="text-xs text-pitch-text-muted">
          {isLive ? "Live commentary updates every few seconds" : "Check back during the match"}
        </p>
      </div>
    );
  }

  // Sort newest first
  const sorted = [...entries].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="relative">
      {/* New entries badge */}
      <AnimatePresence>
        {newCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={scrollToTop}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pitch-green text-pitch-black text-xs font-bold shadow-green-glow"
          >
            <ChevronDown className="w-3.5 h-3.5 rotate-180" />
            {newCount} new update{newCount !== 1 ? "s" : ""}
          </motion.button>
        )}
      </AnimatePresence>

      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="space-y-2 max-h-[60vh] sm:max-h-[520px] overflow-y-auto pr-1"
      >
        <AnimatePresence initial={false}>
          {sorted.map((entry, i) => (
            <CommentaryEntry key={entry.id} entry={entry} isNew={i < newCount} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CommentaryEntry({ entry, isNew }: { entry: Commentary; isNew: boolean }) {
  const eventStyle = entry.eventType ? EVENT_STYLES[entry.eventType] : "";
  const icon = entry.eventType ? EVENT_ICONS[entry.eventType] : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "glass rounded-xl px-4 py-3 transition-colors",
        entry.isHighlight ? eventStyle : "border border-pitch-border/50",
        isNew && "ring-1 ring-pitch-green/30",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Minute */}
        <div className="shrink-0 w-8 text-right">
          {entry.minute !== null && (
            <span className={cn(
              "text-xs font-bold tabular-nums",
              entry.isHighlight ? "text-pitch-green" : "text-pitch-text-muted",
            )}>
              {entry.minute}'
            </span>
          )}
        </div>

        {/* Icon */}
        {icon && (
          <span className="text-base leading-none shrink-0 mt-0.5">{icon}</span>
        )}

        {/* Text */}
        <p className={cn(
          "flex-1 text-sm leading-relaxed",
          entry.isHighlight ? "text-pitch-text-primary font-medium" : "text-pitch-text-secondary",
        )}>
          {entry.text}
        </p>
      </div>
    </motion.div>
  );
}
