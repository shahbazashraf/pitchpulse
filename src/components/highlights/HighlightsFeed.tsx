"use client";

import { useState, useEffect } from "react";
import { useHighlights } from "@/hooks/useHighlights";
import { HighlightCard } from "./HighlightCard";
import { HighlightPlayer } from "./HighlightPlayer";
import { Highlight } from "@/types";
import { AlertCircle } from "lucide-react";

interface HighlightsFeedProps {
  limit?: number;
  offset?: number;
  competition?: string;
  search?: string;
  officialOnly?: boolean;
  excludeOfficial?: boolean;
  onHasMoreChange?: (hasMore: boolean) => void;
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

export function HighlightsFeed({
  limit = 24,
  offset = 0,
  competition,
  search,
  officialOnly,
  excludeOfficial,
  onHasMoreChange,
}: HighlightsFeedProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  const provider = officialOnly ? "official" : excludeOfficial ? "others" : undefined;
  const { data: rawHighlights, isLoading, isError } = useHighlights(competition, undefined, limit, offset, provider);

  useEffect(() => {
    if (isError) {
      console.error(`[HighlightsFeed] Query error — competition=${competition ?? "all"} provider=${provider ?? "all"} limit=${limit}`);
    }
  }, [isError, competition, provider, limit]);

  useEffect(() => {
    if (!isLoading && onHasMoreChange) {
      const raw = Array.isArray(rawHighlights) ? rawHighlights : [];
      onHasMoreChange(raw.length === limit);
    }
  }, [rawHighlights, isLoading, limit, onHasMoreChange]);

  const allHighlights: Highlight[] = Array.isArray(rawHighlights) ? rawHighlights : [];

  const highlights = search?.trim()
    ? allHighlights.filter((h) => {
        const q = search.toLowerCase();
        return (
          h.title?.toLowerCase().includes(q) ||
          h.homeTeam?.toLowerCase().includes(q) ||
          h.awayTeam?.toLowerCase().includes(q)
        );
      })
    : allHighlights;

  const playingHighlight = highlights.find((h) => h.id === playingId) ?? null;

  function handlePlay(h: Highlight) {
    setPlayingId(h.id);
  }

  return (
    <>
      <div className="space-y-4">
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

      {playingHighlight && (
        <HighlightPlayer
          highlight={playingHighlight}
          onClose={() => setPlayingId(null)}
        />
      )}
    </>
  );
}
