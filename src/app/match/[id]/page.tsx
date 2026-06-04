"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMatch, useMatchStreams, useMatchEvents, useMatchStats, useMatchLineups } from "@/hooks/useMatches";
import { cn, isLiveStatus, formatMatchTime, formatKickoff } from "@/lib/utils";
import { Play, MessageSquare, Users, BarChart2, Calendar, MapPin, ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { StreamPlayer } from "@/components/stream/StreamPlayer";
import { LiveCommentaryFeed } from "@/components/live/LiveCommentaryFeed";
import { LineupPitch } from "@/components/lineup/LineupPitch";
import { MatchStatsPanel } from "@/components/stats/MatchStatsPanel";
import { MatchEvents } from "@/components/match/MatchEvents";

type Tab = "stream" | "events" | "lineup" | "stats" | "commentary";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "stream",     label: "Stream",      icon: Play },
  { id: "events",     label: "Events",      icon: Calendar },
  { id: "lineup",     label: "Lineup",      icon: Users },
  { id: "stats",      label: "Stats",       icon: BarChart2 },
  { id: "commentary", label: "Commentary",  icon: MessageSquare },
];

interface Props {
  params: { id: string };
}

export default function MatchPage({ params }: Props) {
  const [tab, setTab] = useState<Tab>("stream");
  const isLive = true; // will derive from match

  const { data: match, isLoading } = useMatch(params.id, { include: ["events"] });
  const matchIsLive = match ? isLiveStatus(match.status) : false;

  if (isLoading) return <MatchPageSkeleton />;
  if (!match) return <MatchNotFound />;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Back nav */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-pitch-text-secondary hover:text-pitch-text-primary transition-colors">
        <ChevronLeft className="w-4 h-4" />
        All matches
      </Link>

      {/* Match header */}
      <MatchHeader match={match} />

      {/* Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 border-b border-pitch-border pb-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors",
              tab === id
                ? "text-pitch-green"
                : "text-pitch-text-secondary hover:text-pitch-text-primary",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {tab === id && (
              <motion.div
                layoutId="match-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-pitch-green rounded-full"
                transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <TabContent tab={tab} matchId={match.id} isLive={matchIsLive} match={match} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TabContent({ tab, matchId, isLive, match }: { tab: Tab; matchId: string; isLive: boolean; match: any }) {
  switch (tab) {
    case "stream":     return <StreamPlayer matchId={matchId} isLive={isLive} />;
    case "events":     return <MatchEvents matchId={matchId} isLive={isLive} match={match} />;
    case "lineup":     return <LineupPitch matchId={matchId} match={match} />;
    case "stats":      return <MatchStatsPanel matchId={matchId} isLive={isLive} match={match} />;
    case "commentary": return <LiveCommentaryFeed matchId={matchId} isLive={isLive} />;
    default:           return null;
  }
}

function MatchHeader({ match }: { match: any }) {
  const isLive = isLiveStatus(match.status);
  const isFinished = ["FT", "AET", "PEN"].includes(match.status);

  return (
    <div className="glass rounded-2xl border border-pitch-border/60 overflow-hidden">
      {isLive && (
        <div className="h-0.5 bg-gradient-to-r from-transparent via-pitch-green to-transparent" />
      )}
      <div className="px-6 py-5">
        {/* Competition */}
        <div className="text-center mb-4">
          <span className="text-xs text-pitch-text-muted uppercase tracking-wider">
            {match.competitionId?.replace(/^[^:]+:/, "")} · {match.round}
          </span>
        </div>

        {/* Scoreline */}
        <div className="flex items-center justify-between gap-4">
          {/* Home team */}
          <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
            <span className="text-4xl leading-none">{(match.homeTeam as any).flag ?? "🏳️"}</span>
            <span className="text-sm font-semibold text-pitch-text-primary text-center leading-tight">
              {match.homeTeam.name}
            </span>
          </div>

          {/* Score / time */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {isLive || isFinished ? (
              <>
                <div className="flex items-center gap-2">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={`home-${match.homeScore}`}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className="text-5xl font-black text-pitch-text-primary tabular-nums"
                    >
                      {match.homeScore ?? 0}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-3xl font-light text-pitch-text-muted">–</span>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={`away-${match.awayScore}`}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className="text-5xl font-black text-pitch-text-primary tabular-nums"
                    >
                      {match.awayScore ?? 0}
                    </motion.span>
                  </AnimatePresence>
                </div>
                {isLive ? (
                  <div className="flex items-center gap-1.5 text-pitch-red text-sm font-bold">
                    <span className="w-1.5 h-1.5 bg-pitch-red rounded-full animate-pulse-live" />
                    {formatMatchTime(match.status, match.minute)}
                  </div>
                ) : (
                  <span className="text-pitch-text-muted text-xs font-medium">Full Time</span>
                )}
                {match.homeScoreHT !== null && (
                  <span className="text-pitch-text-muted text-xs">
                    HT: {match.homeScoreHT} – {match.awayScoreHT}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-2xl font-bold text-pitch-text-primary">
                  {formatKickoff(match.startTime)}
                </span>
                <span className="text-xs text-pitch-text-muted">Kick-off</span>
              </>
            )}
          </div>

          {/* Away team */}
          <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
            <span className="text-4xl leading-none">{(match.awayTeam as any).flag ?? "🏳️"}</span>
            <span className="text-sm font-semibold text-pitch-text-primary text-center leading-tight">
              {match.awayTeam.name}
            </span>
          </div>
        </div>

        {/* Venue */}
        {match.venue && (
          <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-pitch-text-muted">
            <MapPin className="w-3 h-3" />
            {match.venue.name}{match.venue.city ? `, ${match.venue.city}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchPageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
      <div className="h-5 w-28 rounded skeleton" />
      <div className="h-40 rounded-2xl skeleton" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-20 rounded skeleton" />
        ))}
      </div>
      <div className="h-64 rounded-2xl skeleton" />
    </div>
  );
}

function MatchNotFound() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <p className="text-pitch-text-secondary font-medium">Match not found</p>
      <Link href="/" className="mt-4 inline-flex text-pitch-green text-sm hover:underline">
        Back to scores
      </Link>
    </div>
  );
}
