"use client";

import { motion } from "framer-motion";
import { Play, Clock, CheckCircle } from "lucide-react";
import { Highlight } from "@/types";

interface HighlightCardProps {
  highlight: Highlight;
  index: number;
  onPlay: (h: Highlight) => void;
  isPlaying: boolean;
}

export function HighlightCard({ highlight, index, onPlay, isPlaying }: HighlightCardProps) {
  // Use provided thumbnail; for vibedailyhighlights embeds the thumbnail is already set from API
  // Browsers follow the redirect transparently for <img> tags
  const thumbnail = highlight.thumbnail ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card p-0 overflow-hidden group cursor-pointer"
      onClick={() => onPlay(highlight)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-pitch-muted/40">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={highlight.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-pitch-muted/60">
            <Play className="w-10 h-10 text-pitch-text-muted" />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-pitch-dark/60 via-transparent to-transparent" />

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-14 h-14 rounded-full bg-black/50 border-2 border-white/30 flex items-center justify-center transition-all ${isPlaying ? "scale-110 border-pitch-green/60 bg-pitch-green/20" : "group-hover:scale-110 group-hover:bg-black/70 play-pulse"}`}>
            <Play className={`w-6 h-6 ml-0.5 ${isPlaying ? "text-pitch-green" : "text-white"}`} fill="currentColor" />
          </div>
        </div>

        {/* Duration badge */}
        {highlight.duration && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
            <Clock className="w-2.5 h-2.5" />
            {highlight.duration}
          </div>
        )}

        {/* Source badge */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
          {highlight.verified && (
            <span className="bg-pitch-green/80 text-pitch-dark text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
              <CheckCircle className="w-2.5 h-2.5" />
              Official
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-semibold text-pitch-text-primary line-clamp-2 leading-snug">
          {highlight.title}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-pitch-text-muted">{highlight.provider}</span>
          <span className="text-xs bg-pitch-muted/50 text-pitch-text-secondary px-2 py-0.5 rounded-full">
            {highlight.year}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
