"use client";

import { useMatches } from '@/hooks/useMatches';
import MatchCard from '@/components/match/MatchCard';
import { NormalizedMatch } from '@/types';
import clsx from 'clsx';

export default function ScoresDashboard() {
  const { data: matches = [], isLoading } = useMatches();

  if (isLoading) {
    return <div className="text-center text-text-secondary py-8">Loading live scores…</div>;
  }

  const liveMatches = matches.filter((m) => m.status !== 'FT');

  if (liveMatches.length === 0) {
    return <div className="text-center text-text-secondary py-8">No live matches at the moment.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {liveMatches.map((match: NormalizedMatch) => (
        <MatchCard key={match.id} match={match} />
      ))}
    </div>
  );
}
