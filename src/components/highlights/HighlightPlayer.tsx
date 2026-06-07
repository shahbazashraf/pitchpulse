"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Highlight } from "@/types";

interface HighlightPlayerProps {
  highlight: Highlight;
  onClose: () => void;
}

export function HighlightPlayer({ highlight, onClose }: HighlightPlayerProps) {
  // Support YouTube embeds, vibedailyhighlights, and any other iframe-able URL
  const embedSrc = highlight.embedUrl
    ? highlight.embedUrl.includes("youtube.com/embed/")
      ? highlight.embedUrl.includes("autoplay")
        ? highlight.embedUrl
        : highlight.embedUrl + "?autoplay=1&rel=0&modestbranding=1"
      : highlight.embedUrl  // vibedailyhighlights or other — embed as-is
    : null;

  return (
    <AnimatePresence>
      <motion.div
        key="player"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden"
      >
        <div className="relative rounded-2xl overflow-hidden bg-black border border-pitch-border/40 shadow-xl">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-10 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition"
          >
            <X className="w-4 h-4" />
          </button>

          {embedSrc ? (
            <iframe
              src={embedSrc}
              title={highlight.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="w-full aspect-video"
              style={{ border: "none" }}
            />
          ) : highlight.videoUrl ? (
            <video src={highlight.videoUrl} controls autoPlay className="w-full aspect-video" />
          ) : (
            <div className="w-full aspect-video flex items-center justify-center bg-pitch-dark text-pitch-text-muted text-sm">
              Video unavailable
            </div>
          )}

          <div className="p-3 bg-pitch-card border-t border-pitch-border/30">
            <p className="text-sm font-semibold text-pitch-text-primary">{highlight.title}</p>
            <p className="text-xs text-pitch-text-muted mt-0.5">{highlight.provider} · {highlight.competition} {highlight.year}</p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
