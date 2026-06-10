"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  page: number;
  hasNext: boolean;
  isLoading?: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function PaginationControls({
  page,
  hasNext,
  isLoading,
  onPrev,
  onNext,
}: PaginationControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <button
        onClick={onPrev}
        disabled={page === 0 || isLoading}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all",
          page === 0 || isLoading
            ? "opacity-40 cursor-not-allowed bg-pitch-muted/20 border-pitch-border/30 text-pitch-text-muted"
            : "bg-pitch-muted/20 border-pitch-border/40 text-pitch-text-secondary hover:border-pitch-border hover:text-pitch-text-primary"
        )}
      >
        <ChevronLeft className="w-4 h-4" />
        Prev
      </button>

      <span className="text-sm font-medium text-pitch-text-secondary tabular-nums min-w-[4rem] text-center">
        Page {page + 1}
      </span>

      <button
        onClick={onNext}
        disabled={!hasNext || isLoading}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all",
          !hasNext || isLoading
            ? "opacity-40 cursor-not-allowed bg-pitch-muted/20 border-pitch-border/30 text-pitch-text-muted"
            : "bg-pitch-muted/20 border-pitch-border/40 text-pitch-text-secondary hover:border-pitch-border hover:text-pitch-text-primary"
        )}
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
