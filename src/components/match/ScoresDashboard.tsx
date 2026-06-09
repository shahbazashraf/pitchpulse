"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveMatches, useMatchesByDate } from "@/hooks/useMatches";
import { useScrapedMatches, type ScrapedMatch } from "@/hooks/useScrapedMatches";
import MatchCard from "@/components/match/MatchCard";
import { cn, getDateString } from "@/lib/utils";
import { RefreshCw, Radio, Trophy } from "lucide-react";
import type { NormalizedMatch } from "@/types";
import { WC_FIXTURES, WC_TEAMS } from "@/lib/worldcup2026/data";
import Link from "next/link";

// ─── Date tabs (original behaviour, all leagues) ──────────────────────────────
const DATE_TABS = [
  { offset: -1, label: "Yesterday" },
  { offset: 0,  label: "Today"     },
  { offset: 1,  label: "Tomorrow"  },
  { offset: 2,  label: "+2"        },
  { offset: 3,  label: "+3"        },
];

type Mode = "dates" | "worldcup";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByCompetition(matches: NormalizedMatch[]): Record<string, NormalizedMatch[]> {
  return matches.reduce((acc, m) => {
    const key = m.competitionId ?? "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {} as Record<string, NormalizedMatch[]>);
}

function mergeMatches(live: NormalizedMatch[], day: NormalizedMatch[]): NormalizedMatch[] {
  const liveIds = new Set(live.map((m) => m.id));
  const merged = day.map((m) => (liveIds.has(m.id) ? live.find((l) => l.id === m.id)! : m));
  const dayIds = new Set(day.map((m) => m.id));
  const extraLive = live.filter((m) => !dayIds.has(m.id));
  return [...extraLive, ...merged];
}

function wcFixturesToMatches(date: string): NormalizedMatch[] {
  return WC_FIXTURES.filter((f) => f.kickoffUtc.startsWith(date)).map((f) => {
    const home = WC_TEAMS[f.homeTeamCode];
    const away = WC_TEAMS[f.awayTeamCode];
    return {
      id: `wc2026:static:${f.id}`,
      provider: "wc2026",
      providerId: f.id,
      competitionId: "fifa-world-cup-2026",
      season: "2026",
      round: f.group ? `Group ${f.group}` : f.stage.replace(/_/g, " "),
      roundType: f.stage,
      group: f.group ?? undefined,
      homeTeam: { id: home.id, provider: "wc2026", providerId: home.id, name: home.name, shortName: home.shortName, code: home.code, country: home.name, countryCode: home.code, logoUrl: null, flag: home.flag },
      awayTeam: { id: away.id, provider: "wc2026", providerId: away.id, name: away.name, shortName: away.shortName, code: away.code, country: away.name, countryCode: away.code, logoUrl: null, flag: away.flag },
      homeScore: null, awayScore: null,
      homeScoreHT: null, awayScoreHT: null,
      status: "NS", minute: null, injuryTime: null,
      venue: f.venue, referee: null,
      startTime: f.kickoffUtc, timezone: "UTC",
      events: [], stats: null, lineups: null,
      updatedAt: new Date().toISOString(),
    } as unknown as NormalizedMatch;
  });
}

// Find the next date (from today) that has WC fixtures, up to 30 days ahead
function findNextWCDate(): string {
  const today = getDateString(0);
  const from = new Date(today + "T00:00:00Z");
  for (let i = 0; i <= 30; i++) {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    if (WC_FIXTURES.some((f) => f.kickoffUtc.startsWith(dateStr))) return dateStr;
  }
  return today;
}

// Build WC date tab list: show dates around today that have WC fixtures
function getWCDateTabs(): { date: string; label: string }[] {
  const today = getDateString(0);
  const tabs: { date: string; label: string }[] = [];
  // Find the first WC date from today
  const from = new Date(findNextWCDate() + "T00:00:00Z");
  // Show 5 days starting from the first WC date
  for (let i = 0; i < 40 && tabs.length < 8; i++) {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    if (WC_FIXTURES.some((f) => f.kickoffUtc.startsWith(dateStr))) {
      const isToday = dateStr === today;
      const isTomorrow = dateStr === getDateString(1);
      const label = isToday ? "Today" : isTomorrow ? "Tomorrow"
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      tabs.push({ date: dateStr, label });
    }
  }
  return tabs;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CompetitionGroup({
  matches,
  scrapedMap = {},
}: {
  matches: NormalizedMatch[];
  scrapedMap?: Record<string, ScrapedMatch>;
}) {
  const first = matches[0];
  const compLabel = first.competitionId
    ?.replace("fifa-world-cup-2026", "FIFA World Cup 2026")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()) ?? "Matches";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-semibold text-pitch-text-secondary uppercase tracking-wider">
          {compLabel}
        </span>
        <div className="flex-1 h-px bg-pitch-border/50" />
      </div>
      <div className="space-y-1.5">
        {matches.map((match, i) => {
          const key = `${match.homeTeam.name.toLowerCase()}:${match.awayTeam.name.toLowerCase()}`;
          const scraped = scrapedMap[key];
          return (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <MatchCard match={match} hasStreams={(scraped?.streams.length ?? 0) > 0} />
            </motion.div>
          );
        })}
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

function EmptyState({ message }: { message: string }) {
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
        <p className="text-pitch-text-muted text-sm mt-1">{message}</p>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScoresDashboard() {
  const [mode, setMode] = useState<Mode>("dates");
  const [selectedOffset, setSelectedOffset] = useState(0);

  // WC tab state — default to first WC date tab
  const wcTabs = getWCDateTabs();
  const [wcDate, setWcDate] = useState<string>(wcTabs[0]?.date ?? getDateString(0));

  const selectedDate = getDateString(selectedOffset);
  const isToday = selectedOffset === 0;

  // Always fetch live matches (used in both modes)
  const { data: liveMatches = [], isRefetching: liveRefetching } = useLiveMatches();
  // Fetch by-date for both the date-mode selected date and the WC-mode selected date
  const { data: dayMatches = [], isLoading, isFetching } = useMatchesByDate(
    mode === "dates" ? selectedDate : wcDate
  );

  // Scraped matches — used to attach stream badges to match cards
  const { data: scrapedData } = useScrapedMatches();
  const scrapedMap: Record<string, ScrapedMatch> = {};
  for (const m of scrapedData?.matches ?? []) {
    scrapedMap[`${m.homeTeam.toLowerCase()}:${m.awayTeam.toLowerCase()}`] = m;
  }

  // ── Date mode ──
  const allMatches: NormalizedMatch[] = isToday && mode === "dates"
    ? mergeMatches(liveMatches, dayMatches)
    : dayMatches;

  const liveCount = allMatches.filter((m) =>
    ["1H", "2H", "HT", "ET", "P"].includes(m.status)
  ).length;

  const grouped = groupByCompetition(allMatches);

  // ── WC mode ──
  // Prefer API data; fall back to static fixtures for that date
  const wcMatches: NormalizedMatch[] = dayMatches.filter(
    (m) => m.competitionId === "fifa-world-cup-2026"
  ).length > 0
    ? dayMatches.filter((m) => m.competitionId === "fifa-world-cup-2026")
    : wcFixturesToMatches(wcDate);

  const wcGrouped = groupByCompetition(wcMatches);

  return (
    <div className="space-y-4">
      {/* Mode selector row */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {/* All Matches mode */}
        <button
          onClick={() => setMode("dates")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all whitespace-nowrap shrink-0",
            mode === "dates"
              ? "bg-pitch-green/10 border-pitch-green/25 text-pitch-green"
              : "bg-pitch-muted/20 border-pitch-border/40 text-pitch-text-secondary hover:border-pitch-border hover:text-pitch-text-primary"
          )}
        >
          <Radio className="w-3.5 h-3.5" />
          All Matches
          {liveCount > 0 && mode === "dates" && (
            <span className="flex items-center gap-1 text-[10px] bg-pitch-red/20 text-pitch-red px-1.5 py-0.5 rounded-full font-semibold">
              <span className="w-1.5 h-1.5 bg-pitch-red rounded-full animate-pulse" />
              {liveCount}
            </span>
          )}
        </button>

        {/* World Cup mode */}
        <button
          onClick={() => setMode("worldcup")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all whitespace-nowrap shrink-0",
            mode === "worldcup"
              ? "bg-pitch-green/10 border-pitch-green/25 text-pitch-green"
              : "bg-pitch-muted/20 border-pitch-border/40 text-pitch-text-secondary hover:border-pitch-border hover:text-pitch-text-primary"
          )}
        >
          <Trophy className="w-3.5 h-3.5" />
          World Cup 2026
        </button>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {(isFetching || liveRefetching) && (
            <RefreshCw className="w-3.5 h-3.5 text-pitch-text-muted animate-spin" />
          )}
        </div>
      </div>

      {/* Sub-tabs row */}
      {mode === "dates" ? (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mt-2">
          {DATE_TABS.map(({ offset, label }) => {
            const isActive = offset === selectedOffset;
            return (
              <button
                key={offset}
                onClick={() => setSelectedOffset(offset)}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0",
                  isActive
                    ? "text-pitch-green bg-pitch-green/10 border border-pitch-green/25"
                    : "text-pitch-text-secondary hover:text-pitch-text-primary hover:bg-pitch-muted/40 border border-transparent"
                )}
              >
                {label}
                {isActive && isToday && liveCount > 0 && (
                  <span className="flex items-center gap-1 text-[10px] bg-pitch-red/20 text-pitch-red px-1.5 py-0.5 rounded-full font-semibold">
                    <span className="w-1 h-1 bg-pitch-red rounded-full animate-pulse" />
                    {liveCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : wcTabs.length > 0 ? (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mt-2">
          {wcTabs.map(({ date, label }) => {
            const count = wcFixturesToMatches(date).length;
            return (
              <button
                key={date}
                onClick={() => setWcDate(date)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0",
                  date === wcDate
                    ? "text-pitch-green bg-pitch-green/10 border border-pitch-green/25"
                    : "text-pitch-text-secondary hover:text-pitch-text-primary hover:bg-pitch-muted/40 border border-transparent"
                )}
              >
                {label}
                {count > 0 && (
                  <span className="text-[10px] bg-pitch-muted/40 text-pitch-text-muted px-1.5 py-0.5 rounded-full font-semibold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          <Link
            href="/world-cup"
            className="ml-auto shrink-0 text-xs text-pitch-green hover:text-pitch-green/80 transition-colors whitespace-nowrap px-2"
          >
            Full Hub →
          </Link>
        </div>
      ) : null}

      {/* Match list */}
      {isLoading ? (
        <MatchListSkeleton />
      ) : mode === "dates" ? (
        allMatches.length === 0 ? (
          <EmptyState message={`No fixtures scheduled for ${selectedDate}`} />
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
                <CompetitionGroup key={compId} matches={matches} scrapedMap={scrapedMap} />
              ))}
            </motion.div>
          </AnimatePresence>
        )
      ) : wcMatches.length === 0 ? (
        <EmptyState message={`No World Cup fixtures on ${wcDate}`} />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={wcDate}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            {Object.entries(wcGrouped).map(([compId, matches]) => (
              <CompetitionGroup key={compId} matches={matches} scrapedMap={scrapedMap} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
