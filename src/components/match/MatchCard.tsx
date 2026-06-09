import Link from 'next/link';
import { NormalizedMatch } from '@/types';
import clsx from 'clsx';

interface MatchCardProps {
  match: NormalizedMatch;
  hasStreams?: boolean;
}

export default function MatchCard({ match, hasStreams = false }: MatchCardProps) {
  const home = match.homeTeam;
  const away = match.awayTeam;
  const status = match.status;
  const isLive = ["1H", "2H", "HT", "ET", "P"].includes(status);

  const score = `${match.homeScore ?? '-'} : ${match.awayScore ?? '-'}`;

  return (
    <Link href={`/match/${match.id}`} className="glass-card group block hover:shadow-glass-hover transition-shadow">
      <div className="flex items-center justify-between p-2 gap-2">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {home.logoUrl && <img src={home.logoUrl} alt={home.name} className="h-6 w-6 shrink-0" />}
          <span className="text-sm font-medium text-text-primary truncate">{home.shortName}</span>
        </div>
        <div className="text-center shrink-0">
          <span className={clsx("text-lg font-bold score-pop", isLive ? "text-pitch-green" : "text-text-primary")}>
            {score}
          </span>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            {isLive ? (
              <span className="flex items-center gap-1 text-[10px] text-pitch-red font-bold">
                <span className="w-1 h-1 bg-pitch-red rounded-full animate-pulse" />
                LIVE{match.minute ? ` ${match.minute}'` : ""}
              </span>
            ) : (
              <span className="text-xs text-text-muted">{status}</span>
            )}
            {hasStreams && (
              <span className="text-[10px] bg-pitch-green/10 text-pitch-green border border-pitch-green/20 px-1 py-px rounded-full font-semibold">
                ▶
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-1 min-w-0 justify-end">
          <span className="text-sm font-medium text-text-primary truncate">{away.shortName}</span>
          {away.logoUrl && <img src={away.logoUrl} alt={away.name} className="h-6 w-6 shrink-0" />}
        </div>
      </div>
    </Link>
  );
}
