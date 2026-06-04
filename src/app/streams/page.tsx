"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Radio, ExternalLink, Globe, Lock, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreamEntry {
  id: string;
  matchId: string;
  broadcaster: string;
  title: string;
  url: string;
  quality: string;
  language: string;
  region: string[];
  is_free: boolean;
  is_available: boolean;
  is_geo_restricted: boolean;
  platform: string;
  thumbnailUrl?: string;
}

export default function StreamsPage() {
  const { data: streams = [], isLoading } = useQuery<StreamEntry[]>({
    queryKey: ["all-streams"],
    queryFn: async () => {
      const res = await fetch("/api/streams");
      if (!res.ok) return [];
      const json = await res.json();
      return json.streams ?? [];
    },
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
  });

  const live = streams.filter((s) => s.is_available);
  const upcoming = streams.filter((s) => !s.is_available);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-pitch-red/10 border border-pitch-red/20 flex items-center justify-center">
          <Radio className="w-5 h-5 text-pitch-red" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-pitch-text-primary">Live Streams</h1>
          <p className="text-xs text-pitch-text-muted">Official free-to-air broadcasts only</p>
        </div>
        {live.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-pitch-red font-semibold px-2.5 py-1 rounded-full bg-pitch-red/10 border border-pitch-red/20">
            <span className="w-1.5 h-1.5 bg-pitch-red rounded-full animate-pulse-live" />
            {live.length} live now
          </div>
        )}
      </div>

      {isLoading ? (
        <StreamsSkeleton />
      ) : (
        <div className="space-y-6">
          {live.length > 0 && (
            <StreamSection title="Live Now" icon={<Wifi className="w-4 h-4 text-pitch-green" />} streams={live} />
          )}
          {upcoming.length > 0 && (
            <StreamSection title="Upcoming" icon={<WifiOff className="w-4 h-4 text-pitch-text-muted" />} streams={upcoming} dimmed />
          )}
          {!live.length && !upcoming.length && <NoStreams />}
        </div>
      )}
    </div>
  );
}

function StreamSection({
  title, icon, streams, dimmed = false,
}: {
  title: string;
  icon: React.ReactNode;
  streams: StreamEntry[];
  dimmed?: boolean;
}) {
  return (
    <div className={cn("space-y-3", dimmed && "opacity-60")}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-bold text-pitch-text-primary">{title}</span>
        <span className="text-xs text-pitch-text-muted">({streams.length})</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {streams.map((stream, i) => (
          <StreamCard key={stream.id} stream={stream} index={i} />
        ))}
      </div>
    </div>
  );
}

function StreamCard({ stream, index }: { stream: StreamEntry; index: number }) {
  const qualityColors: Record<string, string> = {
    "4K": "text-purple-400 bg-purple-400/10 border-purple-400/20",
    FHD: "text-pitch-blue bg-pitch-blue/10 border-pitch-blue/20",
    HD:  "text-pitch-green bg-pitch-green/10 border-pitch-green/20",
    SD:  "text-pitch-text-muted bg-pitch-muted/30 border-pitch-border/40",
  };

  return (
    <motion.a
      href={stream.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="group glass glass-hover rounded-2xl border border-pitch-border/60 overflow-hidden flex flex-col"
    >
      {stream.thumbnailUrl && (
        <div className="relative h-32 bg-pitch-dark overflow-hidden">
          <img
            src={stream.thumbnailUrl}
            alt={stream.title}
            className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity duration-300"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-pitch-dark via-transparent to-transparent" />
          {stream.is_available && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-pitch-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              LIVE
            </div>
          )}
        </div>
      )}

      <div className="px-3 py-3 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-pitch-text-primary group-hover:text-pitch-green transition-colors truncate">
              {stream.broadcaster}
            </p>
            <p className="text-xs text-pitch-text-muted truncate">{stream.title}</p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-pitch-text-muted group-hover:text-pitch-green transition-colors shrink-0 mt-0.5" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded border font-semibold",
            qualityColors[stream.quality] ?? qualityColors.SD,
          )}>
            {stream.quality}
          </span>
          {stream.is_free && (
            <span className="text-[10px] bg-pitch-green/10 text-pitch-green border border-pitch-green/20 px-1.5 py-0.5 rounded font-semibold">
              FREE
            </span>
          )}
          <span className="text-[10px] text-pitch-text-muted capitalize">{stream.language}</span>
          {stream.is_geo_restricted && (
            <div className="flex items-center gap-0.5 text-[10px] text-pitch-text-muted">
              <Lock className="w-2.5 h-2.5" />
              {stream.region.join(", ")}
            </div>
          )}
          {!stream.is_geo_restricted && (
            <div className="flex items-center gap-0.5 text-[10px] text-pitch-text-muted">
              <Globe className="w-2.5 h-2.5" />
              Worldwide
            </div>
          )}
        </div>
      </div>
    </motion.a>
  );
}

function StreamsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 rounded-2xl skeleton" />
        ))}
      </div>
    </div>
  );
}

function NoStreams() {
  return (
    <div className="glass rounded-2xl border border-pitch-border/60 px-6 py-12 flex flex-col items-center gap-3 text-center">
      <WifiOff className="w-8 h-8 text-pitch-text-muted" />
      <p className="text-sm font-medium text-pitch-text-secondary">No streams available right now</p>
      <p className="text-xs text-pitch-text-muted">Streams will appear here when matches go live</p>
    </div>
  );
}
