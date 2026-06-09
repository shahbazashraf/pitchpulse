"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Wifi, WifiOff, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrapedMatches, type ScrapedMatch } from "@/hooks/useScrapedMatches";
import { StreamPlayer } from "@/components/stream/StreamPlayer";

export default function StreamsPage() {
  const { data, isLoading } = useScrapedMatches();
  const [activeMatch, setActiveMatch] = useState<ScrapedMatch | null>(null);

  const live     = data?.grouped.live ?? [];
  const upcoming = data?.grouped.upcoming ?? [];
  const finished = data?.grouped.finished ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-pitch-red/10 border border-pitch-red/20 flex items-center justify-center">
          <Radio className="w-5 h-5 text-pitch-red" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-pitch-text-primary">Live Streams</h1>
          <p className="text-xs text-pitch-text-muted">Click a match to watch</p>
        </div>
        {live.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-pitch-red font-semibold px-2.5 py-1 rounded-full bg-pitch-red/10 border border-pitch-red/20">
            <span className="w-1.5 h-1.5 bg-pitch-red rounded-full animate-pulse-live" />
            {live.length} live now
          </div>
        )}
      </div>

      {/* Inline stream player */}
      <AnimatePresence>
        {activeMatch && (
          <motion.div
            key={activeMatch.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-2xl border border-pitch-green/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activeMatch.status === "LIVE" && (
                    <span className="flex items-center gap-1 text-[10px] bg-pitch-red text-white px-2 py-0.5 rounded-full font-bold">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      LIVE {activeMatch.minute && `· ${activeMatch.minute}'`}
                    </span>
                  )}
                  <span className="text-sm font-bold text-pitch-text-primary">{activeMatch.title}</span>
                </div>
                <button
                  onClick={() => setActiveMatch(null)}
                  className="text-xs text-pitch-text-muted hover:text-pitch-text-secondary transition-colors px-2 py-1 rounded-lg hover:bg-pitch-muted/30"
                >
                  Close ✕
                </button>
              </div>
              <StreamPlayer
                matchId={activeMatch.id}
                isLive={activeMatch.isLive}
                streams={activeMatch.streams}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <StreamsSkeleton />
      ) : (
        <div className="space-y-6">
          {live.length > 0 && (
            <MatchSection
              title="Live Now"
              icon={<Wifi className="w-4 h-4 text-pitch-green" />}
              matches={live}
              activeId={activeMatch?.id}
              onSelect={setActiveMatch}
            />
          )}
          {upcoming.length > 0 && (
            <MatchSection
              title="Upcoming Today"
              icon={<Clock className="w-4 h-4 text-pitch-text-muted" />}
              matches={upcoming}
              activeId={activeMatch?.id}
              onSelect={setActiveMatch}
              dimmed
            />
          )}
          {finished.length > 0 && (
            <MatchSection
              title="Finished"
              icon={<CheckCircle2 className="w-4 h-4 text-pitch-text-muted" />}
              matches={finished}
              activeId={activeMatch?.id}
              onSelect={setActiveMatch}
              dimmed
            />
          )}
          {!live.length && !upcoming.length && !finished.length && <NoMatches />}
        </div>
      )}
    </div>
  );
}

function MatchSection({
  title, icon, matches, activeId, onSelect, dimmed = false,
}: {
  title: string;
  icon: React.ReactNode;
  matches: ScrapedMatch[];
  activeId?: string;
  onSelect: (m: ScrapedMatch) => void;
  dimmed?: boolean;
}) {
  return (
    <div className={cn("space-y-3", dimmed && "opacity-70")}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-bold text-pitch-text-primary">{title}</span>
        <span className="text-xs text-pitch-text-muted">({matches.length})</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {matches.map((match, i) => (
          <MatchCard
            key={match.id}
            match={match}
            index={i}
            isActive={activeId === match.id}
            onClick={() => onSelect(match)}
          />
        ))}
      </div>
    </div>
  );
}

function MatchCard({
  match, index, isActive, onClick,
}: {
  match: ScrapedMatch;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const scoreStr = match.score
    ? `${match.score.home} - ${match.score.away}`
    : match.status === "NS" ? "vs" : "- : -";

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group glass rounded-2xl border overflow-hidden text-left transition-all w-full",
        isActive
          ? "border-pitch-green/40 bg-pitch-green/5"
          : "border-pitch-border/60 glass-hover",
      )}
    >
      <div className="px-4 py-3 space-y-2">
        {/* Competition + status */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-pitch-text-muted truncate">{match.competition}</span>
          {match.status === "LIVE" && (
            <span className="flex items-center gap-1 text-[10px] bg-pitch-red text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">
              <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
              LIVE{match.minute ? ` ${match.minute}'` : ""}
            </span>
          )}
          {match.status === "FT" && (
            <span className="text-[10px] text-pitch-text-muted bg-pitch-muted/30 border border-pitch-border/40 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
              FT
            </span>
          )}
          {match.status === "NS" && match.startTime && (
            <span className="text-[10px] text-pitch-blue font-semibold shrink-0">
              {new Date(match.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Teams + score */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-pitch-text-primary truncate flex-1">
            {match.homeTeam}
          </span>
          <span className={cn(
            "text-base font-bold shrink-0 tabular-nums",
            match.status === "LIVE" ? "text-pitch-green" : "text-pitch-text-primary",
          )}>
            {scoreStr}
          </span>
          <span className="text-sm font-semibold text-pitch-text-primary truncate flex-1 text-right">
            {match.awayTeam}
          </span>
        </div>

        {/* Streams badge */}
        {match.streams.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] bg-pitch-green/10 text-pitch-green border border-pitch-green/20 px-1.5 py-0.5 rounded-full font-semibold">
              ▶ {match.streams.length} stream{match.streams.length !== 1 ? "s" : ""}
            </span>
            {isActive && (
              <span className="text-[10px] text-pitch-green font-semibold">watching</span>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
}

function StreamsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl skeleton" />
        ))}
      </div>
    </div>
  );
}

function NoMatches() {
  return (
    <div className="glass rounded-2xl border border-pitch-border/60 px-6 py-12 flex flex-col items-center gap-3 text-center">
      <WifiOff className="w-8 h-8 text-pitch-text-muted" />
      <p className="text-sm font-medium text-pitch-text-secondary">No streams available right now</p>
      <p className="text-xs text-pitch-text-muted">Run the scraper to populate match data</p>
    </div>
  );
}
