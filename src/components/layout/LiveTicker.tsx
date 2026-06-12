"use client";

import { useEffect, useState } from 'react';
import { useMatches } from '@/hooks/useMatches';
import { NormalizedMatch } from '@/types';
import Link from 'next/link';
import clsx from 'clsx';

export default function LiveTicker() {
  const { data: matches = [], isLoading } = useMatches();
  const [displayMatches, setDisplayMatches] = useState<NormalizedMatch[]>([]);

  // Filter to only upcoming or live matches (status not FT)
  useEffect(() => {
    if (!isLoading) {
      const filtered = matches.filter((m) => m.status !== 'FT');
      setDisplayMatches(filtered);
    }
  }, [matches, isLoading]);

  if (isLoading || displayMatches.length === 0) return null;

  return (
    <div className="overflow-hidden border-t border-pitch-border bg-pitch-card">
      <div className="flex whitespace-nowrap animate-ticker py-2">
        {displayMatches.map((match) => (
          <Link
            key={match.id}
            href={`/match/${match.id}`}
            className="mx-2 md:mx-4 text-xs text-text-secondary hover:text-text-primary transition"
          >
            {match.homeTeam.shortName} {match.homeScore ?? '-'} : {match.awayScore ?? '-'} {match.awayTeam.shortName} ({match.status})
          </Link>
        ))}
      </div>
    </div>
  );
}
