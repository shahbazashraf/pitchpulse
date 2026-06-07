import Link from 'next/link';
import { NormalizedMatch } from '@/types';
import clsx from 'clsx';

interface MatchCardProps {
  match: NormalizedMatch;
}

export default function MatchCard({ match }: MatchCardProps) {
  const home = match.homeTeam;
  const away = match.awayTeam;
  const status = match.status;

  const score = `${match.homeScore ?? '-'} : ${match.awayScore ?? '-'}`;

  return (
    <Link href={`/match/${match.id}`} className="glass-card group block hover:shadow-glass-hover transition-shadow">
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center space-x-2">
          {home.logoUrl && <img src={home.logoUrl} alt={home.name} className="h-6 w-6" />}
          <span className="text-sm font-medium text-text-primary">{home.shortName}</span>
        </div>
        <div className="text-center">
          <span className="text-lg font-bold text-text-primary score-pop">{score}</span>
          <div className="text-xs text-text-muted">{status}</div>
        </div>
        <div className="flex items-center space-x-2">
          {away.logoUrl && <img src={away.logoUrl} alt={away.name} className="h-6 w-6" />}
          <span className="text-sm font-medium text-text-primary">{away.shortName}</span>
        </div>
      </div>
    </Link>
  );
}
