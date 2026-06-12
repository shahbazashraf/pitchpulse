"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { NormalizedMatch } from "@/types";
import { ClientKickoffTime } from "@/components/match/ClientKickoffTime";
import clsx from "clsx";

interface MatchCardProps {
  match: NormalizedMatch;
  hasStreams?: boolean;
}

export default function MatchCard({ match, hasStreams = false }: MatchCardProps) {
  const home = match.homeTeam as NormalizedMatch["homeTeam"] & { flag?: string };
  const away = match.awayTeam as NormalizedMatch["awayTeam"] & { flag?: string };
  const status = match.status;
  const isLive = ["1H", "2H", "HT", "ET", "P"].includes(status);
  const isFinished = ["FT", "AET", "PEN"].includes(status);
  const isUpcoming = status === "NS";

  const score = isUpcoming ? null : `${match.homeScore ?? "-"} : ${match.awayScore ?? "-"}`;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <Link
        href={`/match/${match.id}`}
        className={clsx(
          "group block rounded-2xl border transition-all duration-200 cursor-pointer",
          "bg-glass-card shadow-glass hover:shadow-glass-hover",
          isLive
            ? "border-l-2 border-pitch-green/60 border-t-pitch-border/50 border-r-pitch-border/50 border-b-pitch-border/50 bg-pitch-green/[0.03]"
            : "border-pitch-border/50 hover:border-pitch-green/20"
        )}
      >
        <div className="flex items-center justify-between px-2 sm:px-3 py-2.5 gap-2">
          {/* Home team */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {home.flag && (
              <span className="text-base leading-none shrink-0">{home.flag}</span>
            )}
            {home.logoUrl && !home.flag && (
              <img src={home.logoUrl} alt={home.name} className="h-5 w-5 shrink-0 object-contain" />
            )}
            <span className="text-sm font-semibold text-pitch-text-primary truncate">{home.shortName}</span>
          </div>

          {/* Score / Time */}
          <div className="text-center shrink-0 min-w-[50px] sm:min-w-[60px]">
            {isUpcoming ? (
              <div className="flex flex-col items-center gap-0.5">
                <ClientKickoffTime isoDate={match.startTime} className="text-sm font-bold text-pitch-text-secondary" />
                {match.venue?.city && (
                  <span className="text-[10px] text-pitch-text-muted">{match.venue.city}</span>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className={clsx(
                    "text-xl font-black score-pop",
                    isLive ? "text-pitch-green" : isFinished ? "text-pitch-text-primary" : "text-pitch-text-secondary"
                  )}
                >
                  {score}
                </span>
                <div className="flex items-center justify-center gap-1">
                  {isLive ? (
                    <span className="flex items-center gap-1 text-[10px] text-pitch-red font-bold">
                      <span className="w-1.5 h-1.5 bg-pitch-red rounded-full animate-pulse" />
                      LIVE{match.minute ? ` ${match.minute}'` : ""}
                    </span>
                  ) : (
                    <span className="text-[10px] text-pitch-text-muted font-medium">{status}</span>
                  )}
                  {hasStreams && (
                    <span className="text-[10px] bg-pitch-green/10 text-pitch-green border border-pitch-green/20 px-1 py-px rounded-full font-semibold">
                      ▶
                    </span>
                  )}
                </div>
                {match.venue?.city && (
                  <span className="text-[10px] text-pitch-text-muted">{match.venue.city}</span>
                )}
              </div>
            )}
          </div>

          {/* Away team */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-sm font-semibold text-pitch-text-primary truncate">{away.shortName}</span>
            {away.flag && (
              <span className="text-base leading-none shrink-0">{away.flag}</span>
            )}
            {away.logoUrl && !away.flag && (
              <img src={away.logoUrl} alt={away.name} className="h-5 w-5 shrink-0 object-contain" />
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
