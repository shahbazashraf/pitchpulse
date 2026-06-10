"use client";

import { motion } from "framer-motion";
import { Radio, Wifi, WifiOff, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrapedMatches, type ScrapedMatch } from "@/hooks/useScrapedMatches";

export default function StreamsPage() {
  const { data, isLoading } = useScrapedMatches();

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
          <p className="text-xs text-pitch-text-muted">Click a live match to watch in a new tab</p>
        </div>
        {live.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-pitch-red font-semibold px-2.5 py-1 rounded-full bg-pitch-red/10 border border-pitch-red/20">
            <span className="w-1.5 h-1.5 bg-pitch-red rounded-full animate-pulse-live" />
            {live.length} live now
          </div>
        )}
      </div>

      {isLoading ? (
        <StreamsSkeleton />
      ) : (
        <div className="space-y-6">
          {live.length > 0 && (
            <MatchSection
              title="Live Now"
              icon={<Wifi className="w-4 h-4 text-pitch-green" />}
              matches={live}
            />
          )}
          {upcoming.length > 0 && (
            <MatchSection
              title="Upcoming Today"
              icon={<Clock className="w-4 h-4 text-pitch-text-muted" />}
              matches={upcoming}
              dimmed
            />
          )}
          {finished.length > 0 && (
            <MatchSection
              title="Finished"
              icon={<CheckCircle2 className="w-4 h-4 text-pitch-text-muted" />}
              matches={finished}
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
  title,
  icon,
  matches,
  dimmed = false,
}: {
  title: string;
  icon: React.ReactNode;
  matches: ScrapedMatch[];
  dimmed?: boolean;
}) {
  return (
    <div className={cn("space-y-3", dimmed && "opacity-60")}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-bold text-pitch-text-primary">{title}</span>
        <span className="text-xs text-pitch-text-muted">({matches.length})</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {matches.map((match, i) => (
          <MatchCard key={match.id} match={match} index={i} />
        ))}
      </div>
    </div>
  );
}

function MatchCard({ match, index }: { match: ScrapedMatch; index: number }) {
  const scoreStr = match.score
    ? `${match.score.home} - ${match.score.away}`
    : match.status === "NS"
    ? "vs"
    : "- : -";

  const isClickable = match.status === "LIVE" && match.streams.length > 0;
  const streamUrl = isClickable ? match.streams[0].url : undefined;

  const inner = (
    <div className="px-4 py-3 space-y-2">
      {/* Competition + status badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-pitch-text-muted truncate">{match.competition}</span>
        {match.status === "LIVE" && (
          <span className="flex items-center gap-1 text-[10px] bg-pitch-red text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">
            <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
            LIVE
          </span>
        )}
        {match.status === "FT" && (
          <span className="text-[10px] text-pitch-text-muted bg-pitch-muted/30 border border-pitch-border/40 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
            FT
          </span>
        )}
        {match.status === "NS" && match.startTime && (
          <span className="text-[10px] text-pitch-blue font-semibold shrink-0">
            {new Date(match.startTime).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
        {match.status === "NS" && !match.startTime && (
          <span className="text-[10px] text-pitch-blue font-semibold shrink-0 bg-pitch-blue/10 border border-pitch-blue/20 px-1.5 py-0.5 rounded-full">
            Upcoming
          </span>
        )}
      </div>

      {/* Teams + score */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-pitch-text-primary truncate flex-1">
          {match.homeTeam}
        </span>
        <span
          className={cn(
            "text-base font-bold shrink-0 tabular-nums",
            match.status === "LIVE" ? "text-pitch-green" : "text-pitch-text-primary",
          )}
        >
          {scoreStr}
        </span>
        <span className="text-sm font-semibold text-pitch-text-primary truncate flex-1 text-right">
          {match.awayTeam}
        </span>
      </div>

      {/* Watch CTA — only on live */}
      {isClickable && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="flex items-center gap-1 text-[10px] bg-pitch-green/10 text-pitch-green border border-pitch-green/20 px-1.5 py-0.5 rounded-full font-semibold">
            <ExternalLink className="w-2.5 h-2.5" />
            Watch stream
          </span>
        </div>
      )}
    </div>
  );

  if (isClickable && streamUrl) {
    return (
      <motion.a
        href={streamUrl}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="glass rounded-2xl border border-pitch-border/60 glass-hover overflow-hidden block"
      >
        {inner}
      </motion.a>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="glass rounded-2xl border border-pitch-border/60 overflow-hidden cursor-default"
    >
      {inner}
    </motion.div>
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
      <p className="text-sm font-medium text-pitch-text-secondary">No matches available right now</p>
      <p className="text-xs text-pitch-text-muted">Check back during match times</p>
    </div>
  );
}
