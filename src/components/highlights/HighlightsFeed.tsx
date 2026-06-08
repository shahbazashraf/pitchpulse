"use client";

import { useState } from "react";
import { useHoofootHighlights } from "@/hooks/useHoofootHighlights";
import { HighlightCard } from "./HighlightCard";
import { HighlightPlayer } from "./HighlightPlayer";
import { Highlight } from "@/types";
import { AlertCircle } from "lucide-react";

interface HighlightsFeedProps {
  limit?: number;
  competition?: string;
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-2xl h-52 skeleton" />
      ))}
    </div>
  );
}

export function HighlightsFeed({ limit = 24, competition }: HighlightsFeedProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { data: rawHighlights, isLoading, isError } = useHoofootHighlights(limit);

  const allHighlights: Highlight[] = Array.isArray(rawHighlights) ? rawHighlights : [];
  const highlights = competition
    ? allHighlights.filter((h) => h.competition?.toLowerCase().includes(competition.toLowerCase()))
    : allHighlights;

  const playingHighlight = highlights.find((h) => h.id === playingId) ?? null;

  function handlePlay(h: Highlight) {
    setPlayingId(playingId === h.id ? null : h.id);
  }

  return (
    <div className="space-y-4">
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
            {isError ? "Could not load highlights." : "No highlights found."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
