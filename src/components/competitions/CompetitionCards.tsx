"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const COMPETITIONS = [
  {
    id: "fifa-world-cup-2026",
    name: "World Cup 2026",
    emoji: "🏆",
    href: "/world-cup",
    highlight: true,
  },
  {
    id: "champions-league",
    name: "Champions League",
    emoji: "⭐",
    href: "/competitions?c=champions-league",
    highlight: false,
  },
  {
    id: "premier-league",
    name: "Premier League",
    emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    href: "/competitions?c=premier-league",
    highlight: false,
  },
  {
    id: "la-liga",
    name: "La Liga",
    emoji: "🇪🇸",
    href: "/competitions?c=la-liga",
    highlight: false,
  },
  {
    id: "bundesliga",
    name: "Bundesliga",
    emoji: "🇩🇪",
    href: "/competitions?c=bundesliga",
    highlight: false,
  },
  {
    id: "serie-a",
    name: "Serie A",
    emoji: "🇮🇹",
    href: "/competitions?c=serie-a",
    highlight: false,
  },
] as const;

export function CompetitionCards() {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
      {COMPETITIONS.map((comp, i) => (
        <motion.div
          key={comp.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            href={comp.href}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl shrink-0 border transition-all hover:shadow-glass-hover ${
              comp.highlight
                ? "w-28 sm:w-32 md:w-36 h-24 sm:h-28 border-pitch-green/30 bg-pitch-green/5 hover:border-pitch-green/50 hover:bg-pitch-green/10"
                : "w-24 sm:w-28 md:w-32 h-24 sm:h-28 border-pitch-border/60 bg-pitch-card/80 hover:border-pitch-border hover:bg-pitch-muted/30"
            }`}
          >
            <span className="text-3xl">{comp.emoji}</span>
            <span className={`text-xs font-semibold text-center leading-tight px-2 ${comp.highlight ? "text-pitch-green" : "text-pitch-text-secondary"}`}>
              {comp.name}
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
