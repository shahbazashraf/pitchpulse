"use client";

import { motion } from "framer-motion";
import { Calendar, MapPin, Trophy, ChevronRight, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { WC_FIXTURES, WC_TEAMS } from "@/lib/worldcup2026/data";
import { formatKickoff } from "@/lib/utils";

const WORLD_CUP_START = new Date("2026-06-11T00:00:00-05:00");
const WORLD_CUP_END = new Date("2026-07-19T00:00:00-04:00");

function getCountdown() {
  const now = new Date();
  if (now >= WORLD_CUP_END) return null;
  if (now >= WORLD_CUP_START) {
    return { live: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const diff = WORLD_CUP_START.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { live: false, days, hours, minutes, seconds };
}

function getNextFixture() {
  const now = new Date();
  return WC_FIXTURES.find((f) => new Date(f.kickoffUtc) > now) ?? WC_FIXTURES[0];
}

function getTodayFixtureCount() {
  const today = new Date().toISOString().slice(0, 10);
  return WC_FIXTURES.filter((f) => f.kickoffUtc.startsWith(today)).length;
}

export function WorldCupHero() {
  // null on SSR — set only after mount to avoid hydration mismatch
  const [countdown, setCountdown] = useState<ReturnType<typeof getCountdown>>(null);
  const [nextFixture, setNextFixture] = useState<ReturnType<typeof getNextFixture> | null>(null);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    setNextFixture(getNextFixture());
    setTodayCount(getTodayFixtureCount());
    setCountdown(getCountdown());
    const id = setInterval(() => setCountdown(getCountdown()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!countdown) {
    // Skeleton while waiting for client hydration
    return (
      <div className="relative overflow-hidden rounded-3xl border border-pitch-green/20 bg-pitch-card h-48 skeleton" />
    );
  }

  const homeTeam = nextFixture ? WC_TEAMS[nextFixture.homeTeamCode] : null;
  const awayTeam = nextFixture ? WC_TEAMS[nextFixture.awayTeamCode] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl border border-pitch-green/20 bg-pitch-card"
    >
      {/* Animated stadium background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-pitch-green/15 via-pitch-dark/60 to-pitch-blue/15 pointer-events-none animate-stadium-bg" />
      <div className="absolute inset-0 bg-gradient-to-t from-pitch-dark/80 via-transparent to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-20 pitch-grass opacity-10 pointer-events-none" />

      {/* Glow accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-pitch-green/50 to-transparent" />

      <div className="relative px-6 py-8 md:px-10 md:py-10">
        {/* Header row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Title block */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-pitch-green/20 border border-pitch-green/30 flex items-center justify-center shrink-0 shadow-lg">
              <Trophy className="w-7 h-7 text-pitch-green" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-pitch-text-primary tracking-tight">
                  FIFA World Cup 2026™
                </h1>
                {countdown.live && (
                  <span className="flex items-center gap-1.5 text-xs bg-pitch-red/20 text-pitch-red border border-pitch-red/30 px-2.5 py-1 rounded-full font-bold">
                    <span className="live-dot scale-75" />
                    LIVE NOW
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-sm text-pitch-text-secondary">
                  <MapPin className="w-3.5 h-3.5" />
                  USA · Canada · Mexico
                </span>
                <span className="flex items-center gap-1 text-sm text-pitch-text-secondary">
                  <Calendar className="w-3.5 h-3.5" />
                  Jun 11 – Jul 19, 2026
                </span>
              </div>
              {/* Stats chips */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-xs bg-pitch-muted/50 border border-pitch-border/50 px-2.5 py-1 rounded-full text-pitch-text-secondary font-medium">
                  48 Teams
                </span>
                <span className="text-xs bg-pitch-muted/50 border border-pitch-border/50 px-2.5 py-1 rounded-full text-pitch-text-secondary font-medium">
                  104 Matches
                </span>
                <span className="text-xs bg-pitch-muted/50 border border-pitch-border/50 px-2.5 py-1 rounded-full text-pitch-text-secondary font-medium">
                  16 Host Cities
                </span>
                {todayCount > 0 && (
                  <span className="flex items-center gap-1 text-xs bg-pitch-green/15 border border-pitch-green/30 px-2.5 py-1 rounded-full text-pitch-green font-semibold">
                    <Zap className="w-3 h-3" />
                    {todayCount} match{todayCount !== 1 ? "es" : ""} today
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Countdown */}
          {!countdown.live && (
            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              <span className="text-xs text-pitch-text-muted uppercase tracking-widest font-medium">
                Tournament begins in
              </span>
              <div className="flex gap-2">
                {[
                  { value: countdown.days, label: "days" },
                  { value: countdown.hours, label: "hrs" },
                  { value: countdown.minutes, label: "min" },
                  { value: countdown.seconds, label: "sec" },
                ].map(({ value, label }) => (
                  <div
                    key={label}
                    className="text-center min-w-[3.5rem] px-3 py-2 rounded-xl bg-pitch-muted/50 border border-pitch-border/60"
                  >
                    <div className="text-2xl font-bold text-pitch-green leading-none tabular-nums">
                      {String(value).padStart(2, "0")}
                    </div>
                    <div className="text-[10px] text-pitch-text-muted uppercase tracking-wider mt-0.5">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="my-6 border-t border-pitch-border/30" />

        {/* Bottom row: next kickoff + CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Next kickoff */}
          {nextFixture && homeTeam && awayTeam && (
            <div className="flex items-center gap-3">
              <div className="text-xs text-pitch-text-muted uppercase tracking-widest font-medium whitespace-nowrap">
                {countdown.live ? "Up next" : "First kickoff"}
              </div>
              <div className="flex items-center gap-2 bg-pitch-muted/40 border border-pitch-border/50 rounded-xl px-4 py-2">
                <span className="text-xl">{homeTeam.flag}</span>
                <span className="text-sm font-semibold text-pitch-text-primary">{homeTeam.shortName}</span>
                <span className="text-xs text-pitch-text-muted font-bold mx-1">vs</span>
                <span className="text-sm font-semibold text-pitch-text-primary">{awayTeam.shortName}</span>
                <span className="text-xl">{awayTeam.flag}</span>
                <span suppressHydrationWarning className="ml-2 text-xs text-pitch-green font-mono font-bold">
                  {formatKickoff(nextFixture.kickoffUtc)}
                </span>
              </div>
              <div className="text-xs text-pitch-text-muted hidden sm:block">
                {nextFixture.city}, {nextFixture.country}
              </div>
            </div>
          )}

          {/* CTA */}
          <Link
            href="/world-cup"
            className="flex items-center gap-2 bg-pitch-green text-pitch-dark font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-pitch-green/90 transition-all shadow-md hover:shadow-pitch-green/20 shrink-0"
          >
            Explore World Cup
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
