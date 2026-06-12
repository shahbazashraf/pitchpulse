"use client";

import { WC_FIXTURES } from "@/lib/worldcup2026/data";

interface BracketSlot {
  id: string;
  label: string;
  home: string;
  away: string;
}

function buildBracketSlots(): Record<string, BracketSlot[]> {
  const stages: Record<string, BracketSlot[]> = {
    round_of_32: [],
    round_of_16: [],
    quarter_final: [],
    semi_final: [],
    final: [],
  };

  for (const f of WC_FIXTURES) {
    if (f.stage === "group") continue;
    if (!stages[f.stage]) continue;
    stages[f.stage].push({
      id: f.id,
      label: f.city,
      home: f.homeTeamCode || "TBD",
      away: f.awayTeamCode || "TBD",
    });
  }

  // If no knockout fixtures in static data, generate placeholders
  const total = Object.values(stages).flat().length;
  if (total === 0) {
    for (let i = 0; i < 16; i++) stages.round_of_32.push({ id: `r32-${i}`, label: "TBD", home: "TBD", away: "TBD" });
    for (let i = 0; i < 8; i++) stages.round_of_16.push({ id: `r16-${i}`, label: "TBD", home: "TBD", away: "TBD" });
    for (let i = 0; i < 4; i++) stages.quarter_final.push({ id: `qf-${i}`, label: "TBD", home: "TBD", away: "TBD" });
    for (let i = 0; i < 2; i++) stages.semi_final.push({ id: `sf-${i}`, label: "TBD", home: "TBD", away: "TBD" });
    stages.final.push({ id: "final", label: "MetLife Stadium", home: "TBD", away: "TBD" });
  }

  return stages;
}

function MatchSlot({ slot }: { slot: BracketSlot }) {
  const isTBD = slot.home === "TBD" || !slot.home;
  return (
    <div className="glass rounded-xl p-2 text-center min-w-[64px] sm:min-w-[80px] border border-pitch-border/40">
      <div className={`text-xs font-semibold ${isTBD ? "text-pitch-text-muted" : "text-pitch-text-primary"}`}>
        {slot.home}
      </div>
      <div className="text-[10px] text-pitch-text-muted my-0.5">vs</div>
      <div className={`text-xs font-semibold ${isTBD ? "text-pitch-text-muted" : "text-pitch-text-primary"}`}>
        {slot.away}
      </div>
    </div>
  );
}

const STAGE_LABELS: Record<string, string> = {
  round_of_32: "R32",
  round_of_16: "R16",
  quarter_final: "QF",
  semi_final: "SF",
  final: "Final",
};

const STAGE_ORDER = ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final"] as const;

export function KnockoutBracket() {
  const stages = buildBracketSlots();

  return (
    <div className="space-y-4">
      <p className="text-xs text-pitch-text-muted">
        Knockout bracket — slots fill as group stage results are confirmed.
      </p>
      <p className="text-xs text-pitch-text-muted block sm:hidden">← Scroll to see full bracket →</p>
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-2 sm:gap-4 min-w-max pb-2">
          {STAGE_ORDER.map((stage) => {
            const slots = stages[stage] ?? [];
            if (slots.length === 0) return null;
            return (
              <div key={stage} className="flex flex-col gap-2">
                {/* Stage label */}
                <div className="text-center text-xs font-bold text-pitch-green uppercase tracking-wider mb-1">
                  {STAGE_LABELS[stage]}
                </div>
                {/* Slots, vertically distributed */}
                <div className={`flex flex-col gap-${stage === "final" ? "0" : "2"} justify-around`} style={{ minHeight: `${slots.length * 70}px` }}>
                  {slots.map((slot) => (
                    <MatchSlot key={slot.id} slot={slot} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
