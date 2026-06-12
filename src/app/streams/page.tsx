"use client";

import { motion } from "framer-motion";
import { Radio, Wifi, WifiOff, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrapedMatches, type ScrapedMatch } from "@/hooks/useScrapedMatches";

const CDN = "https://cdn.kora-api.space/uploads";
const LOGO_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44'%3E%3Crect fill='%231a2332' width='44' height='44' rx='8'/%3E%3Ctext x='50%25' y='54%25' text-anchor='middle' dominant-baseline='middle' font-size='22'%3E%E2%9A%BD%3C/text%3E%3C/svg%3E";

export default function StreamsPage() {
  const { data, isLoading } = useScrapedMatches();

  const live     = data?.grouped.live ?? [];
  const upcoming = data?.grouped.upcoming ?? [];
  const finished = data?.grouped.finished ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 space-y-6">
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
        <div className="space-y-8">
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((match, i) => (
          <MatchCard key={match.id} match={match} index={i} />
        ))}
      </div>
    </div>
  );
}

function TeamLogo({ filename, alt }: { filename: string | null; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={filename ? `${CDN}/team/${filename}` : LOGO_FALLBACK}
      alt={alt}
      width={44}
      height={44}
      className="w-11 h-11 object-contain"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = LOGO_FALLBACK;
      }}
    />
  );
}

function LeagueLogo({ filename, alt }: { filename: string | null; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={filename ? `${CDN}/league/${filename}` : LOGO_FALLBACK}
      alt={alt}
      width={18}
      height={18}
      className="w-[18px] h-[18px] object-contain rounded-sm"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = LOGO_FALLBACK;
      }}
    />
  );
}

function MatchCard({ match, index }: { match: ScrapedMatch; index: number }) {
  const isLive     = match.status === "LIVE";
  const isUpcoming = match.status === "NS";
  const isFinished = match.status === "FT";
  const isClickable = isLive && match.streams.length > 0;
  const streamUrl = isClickable ? match.streams[0].url : undefined;

  const kickoffTime =
    match.startTime
      ? new Date(match.startTime).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "UTC",
        })
      : null;

  const scoreStr = match.score
    ? `${match.score.home} - ${match.score.away}`
    : null;

  const cardInner = (
    <>
      {/* Card head — league + badge */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-pitch-border/40 bg-pitch-surface/50">
        <div className="flex items-center gap-1.5 min-w-0">
          <LeagueLogo filename={match.leagueLogo} alt={match.competition} />
          <span className="text-[11px] font-semibold text-pitch-text-muted truncate">
            {match.competition}
          </span>
        </div>
        {isLive && (
          <span className="flex items-center gap-1 text-[10px] bg-pitch-red text-white px-2 py-0.5 rounded-full font-bold shrink-0">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </span>
        )}
        {isUpcoming && (
          <span className="text-[10px] text-pitch-blue font-bold bg-pitch-blue/10 border border-pitch-blue/20 px-2 py-0.5 rounded-full shrink-0">
            UPCOMING
          </span>
        )}
        {isFinished && (
          <span className="text-[10px] text-pitch-text-muted font-semibold bg-pitch-muted/20 border border-pitch-border/30 px-2 py-0.5 rounded-full shrink-0">
            FINISHED
          </span>
        )}
      </div>

      {/* Card body — teams + score/time */}
      <div className="px-3 py-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* Home team */}
          <div className="flex flex-col items-center gap-1.5">
            <TeamLogo filename={match.homeLogo} alt={match.homeTeam} />
            <span className="text-[11px] font-bold text-pitch-text-primary text-center leading-tight line-clamp-2">
              {match.homeTeam}
            </span>
          </div>

          {/* Center — score or time */}
          <div className="flex flex-col items-center gap-0.5 min-w-[48px] sm:min-w-[64px]">
            {isLive && scoreStr ? (
              <span className="text-xl font-black text-pitch-green tabular-nums">
                {scoreStr}
              </span>
            ) : isFinished && scoreStr ? (
              <span className="text-xl font-black text-pitch-text-primary tabular-nums">
                {scoreStr}
              </span>
            ) : isUpcoming && kickoffTime ? (
              <>
                <span className="text-lg font-black text-pitch-blue tabular-nums">
                  {kickoffTime}
                </span>
                <span className="text-[9px] font-semibold text-pitch-text-muted uppercase tracking-wider">
                  Kick-off
                </span>
              </>
            ) : (
              <span className="text-sm font-bold text-pitch-text-muted">vs</span>
            )}
          </div>

          {/* Away team */}
          <div className="flex flex-col items-center gap-1.5">
            <TeamLogo filename={match.awayLogo} alt={match.awayTeam} />
            <span className="text-[11px] font-bold text-pitch-text-primary text-center leading-tight line-clamp-2">
              {match.awayTeam}
            </span>
          </div>
        </div>
      </div>

      {/* Watch footer — live only */}
      {isLive && (
        <div className="border-t border-pitch-green/20 bg-gradient-to-r from-pitch-green/10 to-pitch-blue/10 px-3 py-2 flex items-center justify-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <polygon points="1,0 10,5 1,10" fill="#00E676" />
          </svg>
          <span className="text-[11px] font-bold text-pitch-green">Watch Live</span>
        </div>
      )}
    </>
  );

  const motionProps = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  };

  if (isClickable && streamUrl) {
    return (
      <motion.a
        href={streamUrl}
        target="_blank"
        rel="noopener noreferrer"
        {...motionProps}
        className="glass rounded-2xl border border-pitch-green/30 overflow-hidden block hover:-translate-y-0.5 transition-transform"
      >
        {cardInner}
      </motion.a>
    );
  }

  return (
    <motion.div
      {...motionProps}
      className={cn(
        "glass rounded-2xl border border-pitch-border/50 overflow-hidden cursor-default",
        isFinished && "opacity-60",
      )}
    >
      {cardInner}
    </motion.div>
  );
}

function StreamsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 rounded-2xl skeleton" />
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
