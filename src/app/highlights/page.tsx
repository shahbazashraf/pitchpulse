"use client";

import { useState } from "react";
import { Film } from "lucide-react";
import clsx from "clsx";
import { HighlightsFeed } from "@/components/highlights/HighlightsFeed";

const COMPETITIONS = [
  { label: "All", value: "all" },
  { label: "World Cup", value: "FIFA World Cup" },
  { label: "Champions League", value: "Champions League" },
  { label: "Premier League", value: "Premier League" },
  { label: "La Liga", value: "La Liga" },
  { label: "Serie A", value: "Serie A" },
  { label: "Bundesliga", value: "Bundesliga" },
  { label: "Europa League", value: "Europa League" },
];

export default function HighlightsPage() {
  const [activeComp, setActiveComp] = useState("all");
  const [search, setSearch] = useState("");

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

        {/* Competition filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {COMPETITIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setActiveComp(value)}
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

        {/* Search */}
        <input
          type="text"
          placeholder="Search teams or matches..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 rounded-xl bg-pitch-muted/20 border border-pitch-border/40 text-pitch-text-primary placeholder:text-pitch-text-muted text-sm focus:outline-none focus:border-pitch-green/40 transition-colors"
        />
      </div>

      {/* Feed */}
      <HighlightsFeed
        limit={24}
        competition={activeComp === "all" ? undefined : activeComp}
        search={search}
      />
    </div>
  );
}
