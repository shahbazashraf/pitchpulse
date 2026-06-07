"use client";

import { useState } from "react";
import clsx from "clsx";
import { useHoofootHighlights } from "@/hooks/useHoofootHighlights";
import { HighlightCard } from "./HighlightCard";
import { HighlightPlayer } from "./HighlightPlayer";
import { Highlight } from "@/types";
import { AlertCircle } from "lucide-react";

interface HighlightsFeedProps {
  limit?: number;
  showYearTabs?: boolean;
}

const YEARS = [
  { label: "All", value: undefined as number | undefined },
  { label: "2026", value: 2026 },
  { label: "2025", value: 2025 },
];

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-2xl h-52 skeleton" />
      ))}
    </div>
  );
}

export function HighlightsFeed({ limit = 12, showYearTabs = false }: HighlightsFeedProps) {
  const [activeYear, setActiveYear] = useState<number | undefined>(undefined);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { data: rawHighlights, isLoading, isError, error } = useHoofootHighlights(limit);

  const highlights: Highlight[] = (rawHighlights ?? []).filter((h) =>
    activeYear === undefined ? true : h.year === activeYear
  );

  const playingHighlight = highlights.find((h) => h.id === playingId) ?? null;

  function handlePlay(h: Highlight) {
    setPlayingId(playingId === h.id ? null : h.id);
  }

  return (
    <div className="space-y-4">
      {/* Year tabs */}
      {showYearTabs && (
        <div className="flex gap-2 flex-wrap">
          {YEARS.map((y) => (
            <button
              key={y.label}
              onClick={() => setActiveYear(y.value)}
              className={clsx(
                "px-4 py-1.5 rounded-xl text-sm font-semibold border transition-all",
                activeYear === y.value
                  ? "bg-pitch-green/10 border-pitch-green/25 text-pitch-green"
                  : "bg-pitch-muted/20 border-pitch-border/40 text-pitch-text-secondary hover:border-pitch-border"
              )}
            >
              {y.label}
            </button>
          ))}
        </div>
      )}

      {/* Inline player */}
      {playingHighlight && (
        <HighlightPlayer
          highlight={playingHighlight}
          onClose={() => setPlayingId(null)}
        />
      )}

      {/* Grid */}
      {isLoading ? (
        <SkeletonGrid count={Math.min(limit, 6)} />
      ) : isError || highlights.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="w-8 h-8 text-pitch-text-muted" />
          <p className="text-pitch-text-secondary text-sm">
            {isError
              ? "Could not load highlights. Check your browser's ad blocker settings."
              : "No highlights found."}
          </p>
          {isError && (
            <a
              href="https://hoofoot.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-pitch-green hover:underline"
            >
              Browse highlights on HooFoot →
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {highlights.map((h, i) => (
            <HighlightCard
              key={h.id}
              highlight={h}
              index={i}
              onPlay={handlePlay}
              isPlaying={playingId === h.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
