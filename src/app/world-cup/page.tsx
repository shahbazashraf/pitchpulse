"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { Trophy, ChevronDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { WCOverview } from "@/components/worldcup/WCOverview";
import { KnockoutBracket } from "@/components/worldcup/KnockoutBracket";
import { TopScorers } from "@/components/worldcup/TopScorers";
import { HighlightsFeed } from "@/components/highlights/HighlightsFeed";
import { NewsSection } from "@/components/news/NewsSection";
import ScoresDashboard from "@/components/match/ScoresDashboard";
import type { NormalizedStanding, NormalizedTeam, StandingEntry } from "@/types";

type WCTab =
  | "overview"
  | "groups"
  | "matches"
  | "knockout"
  | "scorers"
  | "highlights"
  | "news";

const TABS: { id: WCTab; label: string; icon: string }[] = [
  { id: "overview",   label: "Overview",   icon: "🌍" },
  { id: "groups",     label: "Groups",     icon: "📊" },
  { id: "matches",    label: "Matches",    icon: "⚽" },
  { id: "knockout",   label: "Knockout",   icon: "🏅" },
  { id: "scorers",    label: "Scorers",    icon: "🎯" },
  { id: "highlights", label: "Highlights", icon: "🎬" },
  { id: "news",       label: "News",       icon: "📰" },
];

// ─── Standings sub-components (inlined from competitions page pattern) ────────

function formColor(c: string) {
  if (c === "W") return "bg-pitch-green";
  if (c === "L") return "bg-pitch-red";
  return "bg-pitch-muted";
}

function TrendIcon({ status }: { status: StandingEntry["status"] }) {
  if (status === "up")   return <TrendingUp   className="w-3 h-3 text-pitch-green" />;
  if (status === "down") return <TrendingDown className="w-3 h-3 text-pitch-red"   />;
  return <Minus className="w-3 h-3 text-pitch-text-muted" />;
}

function StandingRow({ entry, rank }: { entry: StandingEntry; rank: number }) {
  const top2 = rank <= 2;
  return (
    <div className={clsx(
      "grid grid-cols-[1fr_repeat(6,_auto)] gap-2 items-center px-2 py-1.5 rounded-lg text-sm",
      top2 ? "border-l-2 border-pitch-green pl-2" : "opacity-90"
    )}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-pitch-text-muted w-4 text-right">{rank}</span>
        {(entry.team as NormalizedTeam & { flag?: string }).flag && (
          <span className="text-base">{(entry.team as NormalizedTeam & { flag?: string }).flag}</span>
        )}
        <span className="text-pitch-text-primary font-medium truncate">{entry.team.shortName}</span>
        {entry.status && <TrendIcon status={entry.status} />}
      </div>
      <span className="text-center text-pitch-text-secondary w-6">{entry.played}</span>
      <span className="text-center text-pitch-text-secondary w-6">{entry.win}</span>
      <span className="text-center text-pitch-text-secondary w-6">{entry.draw}</span>
      <span className="text-center text-pitch-text-secondary w-6">{entry.lose}</span>
      <span className={clsx("text-center w-8", entry.goalDifference > 0 ? "text-pitch-green" : entry.goalDifference < 0 ? "text-pitch-red" : "text-pitch-text-muted")}>
        {entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}
      </span>
      <span className="text-center font-bold text-pitch-text-primary w-6">{entry.points}</span>
    </div>
  );
}

function GroupCard({ group }: { group: NormalizedStanding }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="glass-card space-y-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between mb-2"
      >
        <span className="text-sm font-bold text-pitch-text-primary">
          {group.group ? `Group ${group.group}` : "Standings"}
        </span>
        <ChevronDown className={clsx("w-4 h-4 text-pitch-text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="grid grid-cols-[1fr_repeat(6,_auto)] gap-2 px-2 mb-1">
            {["", "P", "W", "D", "L", "GD", "Pts"].map((h, i) => (
              <span key={i} className="text-[10px] text-pitch-text-muted uppercase text-center">{h}</span>
            ))}
          </div>
          {group.entries.map((e, i) => (
            <StandingRow key={e.team.id} entry={e} rank={i + 1} />
          ))}
        </>
      )}
    </div>
  );
}

function GroupsTab() {
  const { data: standings = [], isLoading } = useQuery<NormalizedStanding[]>({
    queryKey: ["standings", "fifa-world-cup-2026"],
    queryFn: async () => {
      const res = await fetch("/api/standings?competition=fifa-world-cup-2026");
      if (!res.ok) return [];
      const json = await res.json();
      return json.standings ?? [];
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl h-48 skeleton" />
        ))}
      </div>
    );
  }

  if (!standings.length) {
    return <p className="text-pitch-text-muted text-center py-8">Standings not yet available — check back after group stage begins.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {standings.map((g) => <GroupCard key={g.group ?? g.competitionId} group={g} />)}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorldCupPage() {
  const [activeTab, setActiveTab] = useState<WCTab>("overview");

  return (
    <div className="space-y-6">
      {/* Hero bar */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-pitch-green/15 border border-pitch-green/25 flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-pitch-green" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-pitch-text-primary">FIFA World Cup 2026™</h1>
          <p className="text-xs text-pitch-text-muted">USA · Canada · Mexico · Jun 11 – Jul 19</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all whitespace-nowrap shrink-0",
              activeTab === tab.id
                ? "bg-pitch-green/10 border-pitch-green/25 text-pitch-green"
                : "bg-pitch-muted/20 border-pitch-border/40 text-pitch-text-secondary hover:border-pitch-border hover:text-pitch-text-primary"
            )}
          >
            <span className="text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "overview"   && <WCOverview />}
          {activeTab === "groups"     && <GroupsTab />}
          {activeTab === "matches"    && <ScoresDashboard />}
          {activeTab === "knockout"   && <KnockoutBracket />}
          {activeTab === "scorers"    && <TopScorers />}
          {activeTab === "highlights" && <HighlightsFeed showYearTabs={true} limit={12} />}
          {activeTab === "news"       && <NewsSection limit={10} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
