"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

interface Scorer {
  rank: number;
  name: string;
  team: string;
  flag: string;
  goals: number;
  assists: number;
}

export function TopScorers() {
  const { data, isLoading } = useQuery<{ scorers: Scorer[] }>({
    queryKey: ["wc-scorers"],
    queryFn: async () => {
      const res = await fetch("/api/world-cup/scorers");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const scorers = data?.scorers ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl h-24 skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {scorers.every((s) => s.goals === 0) && (
        <p className="text-xs text-pitch-text-muted">
          Tournament just kicked off — goal tallies will update as matches are played.
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {scorers.map((scorer, i) => (
          <motion.div
            key={scorer.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className="glass-card flex flex-col items-center gap-1.5 py-4 text-center"
          >
            <span className="text-3xl">{scorer.flag}</span>
            <p className="text-xs font-bold text-pitch-text-primary leading-tight">{scorer.name}</p>
            <p className="text-[10px] text-pitch-text-muted">{scorer.team}</p>
            <div className="flex gap-3 mt-1">
              <div className="text-center">
                <div className="text-lg font-bold text-pitch-green">{scorer.goals}</div>
                <div className="text-[10px] text-pitch-text-muted">Goals</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-pitch-blue">{scorer.assists}</div>
                <div className="text-[10px] text-pitch-text-muted">Assists</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
