"use client";

import { useState } from "react";
import { Film, Youtube, MessageSquare, Video } from "lucide-react";
import clsx from "clsx";
import { HighlightsFeed } from "@/components/highlights/HighlightsFeed";

const COMPETITIONS = [
  { label: "All", value: "all" },
  { label: "World Cup", value: "FIFA World Cup" },
  { label: "Champions League", value: "UEFA Champions League" },
  { label: "Premier League", value: "Premier League" },
  { label: "La Liga", value: "La Liga" },
];

const SOURCE_BADGES = [
  { label: "YouTube Official", icon: Youtube, color: "text-red-400 bg-red-400/10 border-red-400/20" },
  { label: "Reddit Community", icon: MessageSquare, color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  { label: "HooFoot", icon: Video, color: "text-pitch-blue bg-pitch-blue/10 border-pitch-blue/20" },
];

export default function HighlightsPage() {
  const [activeComp, setActiveComp] = useState("all");
  const [page, setPage] = useState(0);

  function handleCompChange(value: string) {
    setActiveComp(value);
    setPage(0); // reset pagination on filter change
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pitch-green/15 border border-pitch-green/20 flex items-center justify-center text-pitch-green">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-pitch-text-primary">Football Highlights</h1>
            <p className="text-sm text-pitch-text-secondary mt-0.5">Latest match highlights from top competitions</p>
          </div>
        </div>

        {/* Source badges */}
        <div className="flex flex-wrap gap-2">
          {SOURCE_BADGES.map(({ label, icon: Icon, color }) => (
            <span
              key={label}
              className={clsx("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium", color)}
            >
              <Icon className="w-3 h-3" />
              {label}
            </span>
          ))}
        </div>

        {/* Competition filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {COMPETITIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleCompChange(value)}
              className={clsx(
                "px-4 py-2 rounded-xl text-sm font-semibold border transition-all whitespace-nowrap shrink-0",
                activeComp === value
                  ? "bg-pitch-green/10 border-pitch-green/25 text-pitch-green"
                  : "bg-pitch-muted/20 border-pitch-border/40 text-pitch-text-secondary hover:border-pitch-border hover:text-pitch-text-primary"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <HighlightsFeed
        limit={24}
        showYearTabs
        competition={activeComp === "all" ? undefined : activeComp}
        page={page}
      />

      {/* Load more */}
      <div className="flex justify-center pb-8">
        <button
          onClick={() => setPage((p) => p + 1)}
          className="px-6 py-2.5 rounded-xl bg-pitch-muted/30 border border-pitch-border/50 text-sm font-semibold text-pitch-text-secondary hover:text-pitch-text-primary hover:border-pitch-border transition-all"
        >
          Load more highlights
        </button>
      </div>
    </div>
  );
}
