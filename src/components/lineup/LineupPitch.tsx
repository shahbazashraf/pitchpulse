"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMatchLineups } from "@/hooks/useMatches";
import { Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NormalizedLineup, LineupPlayer, NormalizedMatch } from "@/types";

interface LineupPitchProps {
  matchId: string;
  match: NormalizedMatch;
}

type Side = "home" | "away";

export function LineupPitch({ matchId, match }: LineupPitchProps) {
  const { data: lineups, isLoading } = useMatchLineups(matchId);
  const [view, setView] = useState<"pitch" | "list">("pitch");

  if (isLoading) return <LineupSkeleton />;

  if (!lineups?.length) {
    return (
      <div className="glass rounded-2xl border border-pitch-border/60 px-6 py-10 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-pitch-muted/40 border border-pitch-border flex items-center justify-center">
          <Users className="w-6 h-6 text-pitch-text-muted" />
        </div>
        <p className="text-sm font-medium text-pitch-text-secondary">Lineup not yet announced</p>
        <p className="text-xs text-pitch-text-muted">Lineups are usually confirmed 1 hour before kick-off</p>
      </div>
    );
  }

  const home = lineups.find((l) => l.side === "home");
  const away = lineups.find((l) => l.side === "away");

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-pitch-muted/30 border border-pitch-border/40 w-fit">
        {(["pitch", "list"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all",
              view === v
                ? "bg-pitch-card text-pitch-text-primary shadow border border-pitch-border/60"
                : "text-pitch-text-secondary hover:text-pitch-text-primary",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "pitch" ? (
        <PitchView home={home} away={away} match={match} />
      ) : (
        <ListView home={home} away={away} match={match} />
      )}
    </div>
  );
}

// ─── Pitch view ───────────────────────────────────────────────────────────────

function PitchView({
  home, away, match,
}: {
  home?: NormalizedLineup;
  away?: NormalizedLineup;
  match: NormalizedMatch;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-pitch-border/60">
      {/* Formations header */}
      <div className="glass px-4 py-3 grid grid-cols-3 items-center text-sm">
        <div className="text-left">
          <span className="font-semibold text-pitch-text-primary">{match.homeTeam.shortName}</span>
          {home?.formation && (
            <span className="ml-2 text-xs text-pitch-green font-mono">{home.formation}</span>
          )}
        </div>
        <div className="text-center text-pitch-text-muted text-xs">Formation</div>
        <div className="text-right">
          <span className="font-semibold text-pitch-text-primary">{match.awayTeam.shortName}</span>
          {away?.formation && (
            <span className="ml-2 text-xs text-pitch-blue font-mono">{away.formation}</span>
          )}
        </div>
      </div>

      {/* Pitch */}
      <div className="relative pitch-grass aspect-[3/4] select-none overflow-hidden">
        {/* Pitch markings */}
        <PitchMarkings />

        {/* Home players (bottom half) */}
        {home && (
          <FormationLayer
            lineup={home}
            side="home"
            color="pitch-green"
          />
        )}

        {/* Away players (top half) */}
        {away && (
          <FormationLayer
            lineup={away}
            side="away"
            color="pitch-blue"
          />
        )}
      </div>

      {/* Bench */}
      {(home?.substitutes?.length || away?.substitutes?.length) && (
        <div className="glass px-4 py-3 border-t border-pitch-border/40">
          <p className="text-xs font-semibold text-pitch-text-muted uppercase tracking-wider mb-2">
            Substitutes
          </p>
          <div className="grid grid-cols-2 gap-3">
            <BenchList players={home?.substitutes ?? []} color="green" />
            <BenchList players={away?.substitutes ?? []} color="blue" />
          </div>
        </div>
      )}
    </div>
  );
}

function PitchMarkings() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-20"
      viewBox="0 0 300 400"
      fill="none"
      stroke="white"
      strokeWidth="1.5"
    >
      {/* Outer boundary */}
      <rect x="10" y="10" width="280" height="380" />
      {/* Center line */}
      <line x1="10" y1="200" x2="290" y2="200" />
      {/* Center circle */}
      <circle cx="150" cy="200" r="40" />
      <circle cx="150" cy="200" r="2" fill="white" />
      {/* Top penalty area */}
      <rect x="75" y="10" width="150" height="55" />
      <rect x="110" y="10" width="80" height="22" />
      {/* Bottom penalty area */}
      <rect x="75" y="335" width="150" height="55" />
      <rect x="110" y="368" width="80" height="22" />
      {/* Penalty spots */}
      <circle cx="150" cy="48" r="2" fill="white" />
      <circle cx="150" cy="352" r="2" fill="white" />
    </svg>
  );
}

function FormationLayer({
  lineup,
  side,
  color,
}: {
  lineup: NormalizedLineup;
  side: Side;
  color: string;
}) {
  const players = lineup.startingXI;

  // Group by grid row
  const byRow: Record<string, LineupPlayer[]> = {};
  for (const p of players) {
    const row = p.grid?.split(":")?.[0] ?? "1";
    if (!byRow[row]) byRow[row] = [];
    byRow[row].push(p);
  }
  const rows = Object.keys(byRow).sort((a, b) => Number(a) - Number(b));

  // For home: rows go bottom-to-top; for away: top-to-bottom
  const totalRows = rows.length;

  return (
    <>
      {rows.map((row, rowIdx) => {
        const rowPlayers = byRow[row];
        const playersInRow = rowPlayers.length;

        // Y position: home occupies bottom 45%, away top 45%
        const yPct = side === "home"
          ? 95 - (rowIdx / (totalRows - 1 || 1)) * 44
          : 5 + (rowIdx / (totalRows - 1 || 1)) * 44;

        return rowPlayers.map((player, colIdx) => {
          const xPct = ((colIdx + 1) / (playersInRow + 1)) * 100;
          return (
            <PlayerDot
              key={player.name}
              player={player}
              xPct={xPct}
              yPct={yPct}
              color={color}
              side={side}
            />
          );
        });
      })}
    </>
  );
}

function PlayerDot({
  player,
  xPct,
  yPct,
  color,
  side,
}: {
  player: LineupPlayer;
  xPct: number;
  yPct: number;
  color: string;
  side: Side;
}) {
  const [hovered, setHovered] = useState(false);
  const isGreen = color === "pitch-green";

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
      style={{ left: `${xPct}%`, top: `${yPct}%` }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: xPct * 0.003 + yPct * 0.002, type: "spring", stiffness: 400, damping: 20 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      {/* Number circle */}
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shadow-lg transition-all",
        isGreen
          ? "bg-pitch-green/90 border-pitch-green text-pitch-black"
          : "bg-pitch-blue/90 border-pitch-blue text-white",
        player.isCaptain && "ring-2 ring-yellow-400 ring-offset-1 ring-offset-transparent",
      )}>
        {player.number ?? "?"}
      </div>

      {/* Name label */}
      <div className={cn(
        "absolute left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap text-[9px] font-semibold px-1 py-0.5 rounded",
        side === "home" ? "top-full" : "bottom-full mb-1",
        "bg-pitch-dark/80 text-white backdrop-blur-sm",
      )}>
        {player.name.split(" ").pop()}
        {player.isCaptain && " ©"}
      </div>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute bottom-full mb-8 left-1/2 -translate-x-1/2 z-20 bg-pitch-card border border-pitch-border rounded-lg px-2.5 py-2 shadow-xl pointer-events-none"
          >
            <p className="text-xs font-semibold text-pitch-text-primary whitespace-nowrap">{player.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {player.number && (
                <span className="text-[10px] text-pitch-text-muted">#{player.number}</span>
              )}
              {player.position && (
                <span className="text-[10px] text-pitch-text-muted">{player.position}</span>
              )}
              {player.rating && (
                <span className={cn(
                  "text-[10px] font-bold px-1 rounded",
                  player.rating >= 7.5 ? "text-pitch-green" : player.rating >= 6.5 ? "text-pitch-gold" : "text-pitch-text-muted",
                )}>
                  {player.rating.toFixed(1)}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({
  home, away, match,
}: {
  home?: NormalizedLineup;
  away?: NormalizedLineup;
  match: NormalizedMatch;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <TeamListPanel lineup={home} team={match.homeTeam} color="green" />
      <TeamListPanel lineup={away} team={match.awayTeam} color="blue" />
    </div>
  );
}

function TeamListPanel({
  lineup,
  team,
  color,
}: {
  lineup?: NormalizedLineup;
  team: NormalizedMatch["homeTeam"];
  color: "green" | "blue";
}) {
  const accentColor = color === "green" ? "text-pitch-green" : "text-pitch-blue";
  const bgColor = color === "green" ? "bg-pitch-green/10 border-pitch-green/20" : "bg-pitch-blue/10 border-pitch-blue/20";

  return (
    <div className="glass rounded-2xl border border-pitch-border/60 overflow-hidden">
      <div className={cn("px-3 py-2.5 border-b border-pitch-border/40", bgColor)}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-pitch-text-primary">{team.shortName}</span>
          {lineup?.formation && (
            <span className={cn("text-xs font-mono font-bold", accentColor)}>{lineup.formation}</span>
          )}
        </div>
        {lineup?.coach && (
          <span className="text-[10px] text-pitch-text-muted">Coach: {lineup.coach}</span>
        )}
      </div>

      <div className="px-2 py-2 space-y-0.5">
        {lineup?.startingXI.map((p) => (
          <PlayerListRow key={p.name} player={p} accentColor={accentColor} />
        ))}
      </div>

      {lineup?.substitutes?.length ? (
        <>
          <div className="px-3 py-1.5 border-t border-pitch-border/40 bg-pitch-muted/10">
            <span className="text-[10px] font-semibold text-pitch-text-muted uppercase tracking-wider">Bench</span>
          </div>
          <div className="px-2 py-2 space-y-0.5 opacity-70">
            {lineup.substitutes.map((p) => (
              <PlayerListRow key={p.name} player={p} accentColor={accentColor} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function PlayerListRow({ player, accentColor }: { player: LineupPlayer; accentColor: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-pitch-muted/20 transition-colors">
      <span className={cn("w-5 text-right text-[10px] font-bold tabular-nums shrink-0", accentColor)}>
        {player.number ?? "–"}
      </span>
      <span className="flex-1 text-xs text-pitch-text-primary truncate">
        {player.name}
        {player.isCaptain && <span className="ml-1 text-pitch-gold text-[10px]">©</span>}
      </span>
      {player.rating && (
        <span className={cn(
          "text-[10px] font-bold tabular-nums",
          player.rating >= 7.5 ? "text-pitch-green" : player.rating >= 6.5 ? "text-pitch-gold" : "text-pitch-text-muted",
        )}>
          {player.rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

function BenchList({ players, color }: { players: LineupPlayer[]; color: "green" | "blue" }) {
  const accentColor = color === "green" ? "text-pitch-green" : "text-pitch-blue";
  return (
    <div className="space-y-0.5">
      {players.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5 text-[11px]">
          <span className={cn("w-4 text-right font-bold tabular-nums shrink-0", accentColor)}>
            {p.number ?? "–"}
          </span>
          <span className="text-pitch-text-secondary truncate">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function LineupSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-32 rounded-lg skeleton" />
      <div className="h-80 rounded-2xl skeleton" />
    </div>
  );
}
