"use client";

import { motion } from "framer-motion";
import { Calendar, MapPin, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

const WORLD_CUP_START = new Date("2026-06-11T00:00:00-05:00");
const WORLD_CUP_END = new Date("2026-07-19T00:00:00-04:00");

function getCountdown() {
  const now = new Date();
  if (now >= WORLD_CUP_END) return null; // tournament over
  if (now >= WORLD_CUP_START) return { live: true, days: 0, hours: 0, minutes: 0 };

  const diff = WORLD_CUP_START.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { live: false, days, hours, minutes };
}

export function WorldCupBanner() {
  const [countdown, setCountdown] = useState(getCountdown());

  useEffect(() => {
    const id = setInterval(() => setCountdown(getCountdown()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!countdown) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-pitch-green/20 bg-pitch-card"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-pitch-green/10 via-transparent to-pitch-blue/10 pointer-events-none" />
      <div className="absolute top-0 left-0 w-40 h-full bg-gradient-to-r from-pitch-green/10 to-transparent pointer-events-none" />

      <div className="relative px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pitch-green/15 border border-pitch-green/25 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-pitch-green" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-pitch-text-primary">FIFA World Cup 2026™</span>
              {countdown.live && (
                <span className="flex items-center gap-1 text-xs bg-pitch-red/20 text-pitch-red border border-pitch-red/30 px-2 py-0.5 rounded-full font-semibold">
                  <span className="live-dot scale-75" />
                  LIVE NOW
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1 text-xs text-pitch-text-secondary">
                <Calendar className="w-3 h-3" />
                Jun 11 – Jul 19, 2026
              </span>
              <span className="flex items-center gap-1 text-xs text-pitch-text-secondary">
                <MapPin className="w-3 h-3" />
                USA · Canada · Mexico
              </span>
            </div>
          </div>
        </div>

        {!countdown.live && (
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-pitch-text-muted uppercase tracking-wider font-medium hidden sm:block">Starts in</span>
            <div className="flex gap-2">
              {[
                { value: countdown.days, label: "days" },
                { value: countdown.hours, label: "hrs" },
                { value: countdown.minutes, label: "min" },
              ].map(({ value, label }) => (
                <div key={label} className="text-center min-w-[2.5rem] sm:min-w-[3rem] px-2 py-1 rounded-lg bg-pitch-muted/50 border border-pitch-border/50">
                  <div className="text-lg font-bold text-pitch-green leading-none tabular-nums">
                    {String(value).padStart(2, "0")}
                  </div>
                  <div className="text-[10px] text-pitch-text-muted uppercase tracking-wider">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
