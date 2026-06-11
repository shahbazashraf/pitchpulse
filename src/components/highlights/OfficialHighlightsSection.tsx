"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import Link from "next/link";
import { useHighlights } from "@/hooks/useHighlights";
import { HighlightCard } from "./HighlightCard";
import { HighlightPlayer } from "./HighlightPlayer";
import { Highlight } from "@/types";

interface OfficialHighlightsSectionProps {
  limit?: number;
}

function SectionHeader({
  icon,
  title,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-[3px] h-5 rounded-full bg-pitch-green/70 shrink-0" />
        <div className="w-8 h-8 rounded-lg bg-pitch-green/15 border border-pitch-green/20 flex items-center justify-center text-pitch-green">
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-pitch-text-primary">{title}</h2>
      </div>
      {href && (
        <Link
          href={href}
          className="text-sm text-pitch-text-secondary hover:text-pitch-green transition font-medium"
        >
          View all →
        </Link>
      )}
    </div>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-2xl h-52 skeleton animate-pulse bg-pitch-muted/10 border border-pitch-border/30" />
      ))}
    </div>
  );
}

export function OfficialHighlightsSection({
  limit = 4,
}: OfficialHighlightsSectionProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Fetch using useHighlights with official provider to hit football_videos collection
  const { data: rawHighlights, isLoading } = useHighlights(
    undefined,
    undefined,
    limit,
    0,
    "official"
  );

  const highlights: Highlight[] = Array.isArray(rawHighlights) ? rawHighlights : [];

  if (isLoading) {
    return (
      <section className="space-y-4">
        <SectionHeader
          icon={<Shield className="w-4 h-4" />}
          title="FIFA/UEFA"
          href="/highlights"
        />
        <SkeletonGrid count={limit} />
      </section>
    );
  }

  // Auto-hide the entire section if no videos are returned
  if (highlights.length === 0) {
    return null;
  }

  const playingHighlight = highlights.find((h) => h.id === playingId) ?? null;

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={<Shield className="w-4 h-4" />}
        title="FIFA/UEFA"
        href="/highlights"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {highlights.map((h, i) => (
          <HighlightCard
            key={h.id}
            highlight={h}
            index={i}
            onPlay={(selected) => setPlayingId(selected.id)}
            isPlaying={playingId === h.id}
          />
        ))}
      </div>

      {playingHighlight && (
        <HighlightPlayer
          highlight={playingHighlight}
          onClose={() => setPlayingId(null)}
        />
      )}
    </section>
  );
}
