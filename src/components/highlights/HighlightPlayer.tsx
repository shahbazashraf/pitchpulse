"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Highlight } from "@/types";

interface HighlightPlayerProps {
  highlight: Highlight;
  onClose: () => void;
}

export function HighlightPlayer({ highlight, onClose }: HighlightPlayerProps) {
  const embedSrc = highlight.embedUrl
    ? highlight.embedUrl.includes("youtube.com/embed/")
      ? highlight.embedUrl.includes("autoplay")
        ? highlight.embedUrl
        : highlight.embedUrl + "?autoplay=1&rel=0&modestbranding=1"
      : highlight.embedUrl
    : null;

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="player-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      >
        {/* Player card */}
        <motion.div
          className="relative w-full max-w-3xl rounded-2xl overflow-hidden bg-pitch-card border border-pitch-border/40 shadow-2xl"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/60 hover:bg-black/90 rounded-full flex items-center justify-center text-white transition"
            aria-label="Close player"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Video */}
          {embedSrc ? (
            <iframe
              src={embedSrc}
              title={highlight.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="w-full aspect-video"
              style={{ border: "none", display: "block" }}
            />
          ) : highlight.videoUrl ? (
            <video src={highlight.videoUrl} controls autoPlay className="w-full aspect-video" />
          ) : (
            <div className="w-full aspect-video flex items-center justify-center bg-pitch-dark text-pitch-text-muted text-sm">
              Video unavailable
            </div>
          )}

          {/* Metadata */}
          <div className="p-3 border-t border-pitch-border/30">
            <p className="text-sm font-semibold text-pitch-text-primary">{highlight.title}</p>
            <p className="text-xs text-pitch-text-muted mt-0.5">
              {highlight.provider} · {highlight.competition} {highlight.year}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
