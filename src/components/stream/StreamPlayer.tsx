"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMatchStreams } from "@/hooks/useMatches";
import {
  Play, ExternalLink, Globe, Lock, Wifi, WifiOff,
  ChevronDown, ChevronUp, Info, Loader2, Youtube,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StreamSource } from "@/types";
import type { ScrapedStream } from "@/app/api/scraped-matches/route";

interface StreamPlayerProps {
  matchId: string;
  isLive: boolean;
  /** When provided, skip the Firestore fetch and use these scraped streams directly */
  streams?: ScrapedStream[];
}

const QUALITY_ORDER: Record<string, number> = { "4K": 4, FHD: 3, HD: 2, SD: 1 };
const PLATFORM_ICON: Record<string, React.ElementType> = {
  youtube: Youtube,
  web: Globe,
};

function scrapedToStreamSource(s: ScrapedStream, matchId: string): StreamSource {
  return {
    id: s.url,
    matchId,
    broadcaster: s.source === "streamseast" ? "StreamEast" : "TotalSportek",
    broadcasterId: s.source,
    title: "",
    url: s.url,
    embedUrl: s.embed_url,
    streamType: "live",
    quality: (s.quality as StreamSource["quality"]) ?? "HD",
    language: "en",
    region: [],
    isOfficial: false,
    isGeoRestricted: false,
    requiresAuth: false,
    requiresSubscription: false,
    isFree: true,
    isAvailable: true,
    availableFrom: null,
    availableUntil: null,
    lastVerified: new Date().toISOString(),
    thumbnailUrl: null,
    platform: "web",
    source: s.source,
  } as StreamSource;
}

export function StreamPlayer({ matchId, isLive, streams: propStreams }: StreamPlayerProps) {
  const { data: fetchedStreams = [], isLoading } = useMatchStreams(
    propStreams ? "" : matchId,
  );

  const streams: StreamSource[] = propStreams
    ? propStreams.map((s) => scrapedToStreamSource(s, matchId))
    : fetchedStreams;
  const [activeStream, setActiveStream] = useState<StreamSource | null>(null);
  const [embedExpanded, setEmbedExpanded] = useState(false);

  const available = streams
    .filter((s) => s.isAvailable)
    .sort((a, b) => (QUALITY_ORDER[b.quality] ?? 0) - (QUALITY_ORDER[a.quality] ?? 0));

  const unavailable = streams.filter((s) => !s.isAvailable);
  const selected = activeStream ?? available[0] ?? null;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-52 rounded-2xl skeleton" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (!streams.length) {
    return <NoStreamsState isLive={isLive} />;
  }

  return (
    <div className="space-y-3">
      {/* Embed player - YouTube */}
      {selected?.embedUrl && selected.platform === "youtube" && (
        <div className="rounded-2xl overflow-hidden border border-pitch-border/60 bg-black">
          <div className="relative pt-[56.25%]">
            <iframe
              key={selected.id}
              src={selected.embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title={selected.title}
            />
          </div>
          <div className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-pitch-text-secondary">{selected.broadcaster}</span>
              {selected.isFree && (
                <span className="text-[10px] bg-pitch-green/15 text-pitch-green border border-pitch-green/25 px-1.5 py-0.5 rounded-full font-medium">
                  FREE
                </span>
              )}
            </div>
            <a
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-pitch-text-muted hover:text-pitch-text-secondary transition-colors"
            >
              Open <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Embed player - Web (streamseast, totalsportek) */}
      {selected?.embedUrl && selected.platform === "web" && (
        <div className="rounded-2xl overflow-hidden border border-pitch-border/60 bg-black">
          <div className="relative pt-[56.25%]">
            <iframe
              key={selected.id}
              src={selected.embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title={selected.title}
            />
          </div>
          <div className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-pitch-text-secondary">{selected.broadcaster}</span>
              {selected.isFree && (
                <span className="text-[10px] bg-pitch-green/15 text-pitch-green border border-pitch-green/25 px-1.5 py-0.5 rounded-full font-medium">
                  FREE
                </span>
              )}
            </div>
            <a
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-pitch-text-muted hover:text-pitch-text-secondary transition-colors"
            >
              Open <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* No embed — show big open link button */}
      {selected && !selected.embedUrl && (
        <StreamOpenCard stream={selected} />
      )}

      {/* Available streams list */}
      {available.length > 0 && (
        <div className="glass rounded-2xl border border-pitch-border/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-pitch-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-pitch-green" />
              <span className="text-sm font-semibold text-pitch-text-primary">
                Live Streams
              </span>
              <span className="text-xs text-pitch-text-muted">({available.length})</span>
            </div>
            {isLive && (
              <div className="flex items-center gap-1.5 text-xs text-pitch-green font-medium">
                <span className="w-1.5 h-1.5 bg-pitch-green rounded-full animate-pulse-live" />
                Available now
              </div>
            )}
          </div>

          <div className="divide-y divide-pitch-border/40">
            {available.map((stream) => (
              <StreamRow
                key={stream.id}
                stream={stream}
                isActive={selected?.id === stream.id}
                onSelect={() => setActiveStream(stream)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unavailable / upcoming streams */}
      {unavailable.length > 0 && (
        <div className="glass rounded-2xl border border-pitch-border/40 overflow-hidden opacity-60">
          <button
            onClick={() => setEmbedExpanded((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-sm text-pitch-text-secondary hover:text-pitch-text-primary transition-colors"
          >
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              <span>Upcoming / Unavailable ({unavailable.length})</span>
            </div>
            {embedExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {embedExpanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="divide-y divide-pitch-border/30 border-t border-pitch-border/40">
                  {unavailable.map((stream) => (
                    <StreamRow
                      key={stream.id}
                      stream={stream}
                      isActive={false}
                      onSelect={() => { }}
                      disabled
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Legal notice */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-pitch-muted/20 border border-pitch-border/40">
        <Info className="w-3.5 h-3.5 text-pitch-text-muted shrink-0 mt-0.5" />
        <p className="text-[11px] text-pitch-text-muted leading-relaxed">
          KickStreaming only links to official, rights-holder streams. All streams are free-to-air
          public broadcasts. Geo-restrictions may apply based on your location.
        </p>
      </div>
    </div>
  );
}

// ─── Stream row ───────────────────────────────────────────────────────────────

interface StreamRowProps {
  stream: StreamSource;
  isActive: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

function StreamRow({ stream, isActive, onSelect, disabled = false }: StreamRowProps) {
  const Icon = PLATFORM_ICON[stream.platform] ?? Globe;
  const qualityColors: Record<string, string> = {
    "4K": "text-purple-400 bg-purple-400/10 border-purple-400/20",
    FHD: "text-pitch-blue bg-pitch-blue/10 border-pitch-blue/20",
    HD: "text-pitch-green bg-pitch-green/10 border-pitch-green/20",
    SD: "text-pitch-text-muted bg-pitch-muted/30 border-pitch-border/40",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-all",
        !disabled && "cursor-pointer hover:bg-pitch-muted/20",
        isActive && "bg-pitch-green/5",
        disabled && "opacity-50",
      )}
      onClick={disabled ? undefined : onSelect}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
        isActive ? "bg-pitch-green/15 border border-pitch-green/25" : "bg-pitch-muted/40 border border-pitch-border/40",
      )}>
        <Icon className={cn("w-4 h-4", isActive ? "text-pitch-green" : "text-pitch-text-muted")} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-pitch-text-primary truncate">
            {stream.broadcaster}
          </span>
          {stream.isFree && (
            <span className="text-[10px] bg-pitch-green/10 text-pitch-green border border-pitch-green/20 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
              FREE
            </span>
          )}
          {stream.isGeoRestricted && (
            <span className="flex items-center gap-0.5 text-[10px] text-pitch-text-muted shrink-0">
              <Lock className="w-2.5 h-2.5" />
              {stream.region.join(", ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-pitch-text-muted capitalize">{stream.language}</span>
          {stream.title && (
            <span className="text-xs text-pitch-text-muted truncate">{stream.title}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded border font-semibold",
          qualityColors[stream.quality] ?? qualityColors.SD,
        )}>
          {stream.quality}
        </span>
        <a
          href={stream.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg hover:bg-pitch-muted/40 text-pitch-text-muted hover:text-pitch-text-primary transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

// ─── Open card (no embed available) ─────────────────────────────────────────

function StreamOpenCard({ stream }: { stream: StreamSource }) {
  return (
    <div className="glass rounded-2xl border border-pitch-green/20 overflow-hidden">
      {stream.thumbnailUrl && (
        <div className="relative h-40 bg-pitch-dark">
          <img
            src={stream.thumbnailUrl}
            alt={stream.title}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-pitch-dark via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <a
              href={stream.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pitch-green text-pitch-black font-bold text-sm hover:bg-pitch-green-dim transition-colors shadow-green-glow"
            >
              <Play className="w-4 h-4 fill-pitch-black" />
              Watch on {stream.broadcaster}
            </a>
          </div>
        </div>
      )}
      {!stream.thumbnailUrl && (
        <div className="px-4 py-6 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-pitch-green/15 border border-pitch-green/25 flex items-center justify-center">
            <Play className="w-6 h-6 text-pitch-green fill-pitch-green" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-pitch-text-primary">{stream.broadcaster}</p>
            <p className="text-xs text-pitch-text-muted mt-0.5">{stream.language} · {stream.quality}</p>
          </div>
          <a
            href={stream.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pitch-green text-pitch-black font-bold text-sm hover:bg-pitch-green-dim transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Watch Live
          </a>
        </div>
      )}
    </div>
  );
}

// ─── No streams state ────────────────────────────────────────────────────────

function NoStreamsState({ isLive }: { isLive: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass rounded-2xl border border-pitch-border/60 px-6 py-10 flex flex-col items-center gap-3 text-center"
    >
      <div className="w-12 h-12 rounded-2xl bg-pitch-muted/40 border border-pitch-border flex items-center justify-center">
        <WifiOff className="w-6 h-6 text-pitch-text-muted" />
      </div>
      <div>
        <p className="text-sm font-semibold text-pitch-text-secondary">
          {isLive ? "No streams found yet" : "Streams will appear closer to kick-off"}
        </p>
        <p className="text-xs text-pitch-text-muted mt-1">
          Official broadcaster links will appear here when available.
        </p>
      </div>
    </motion.div>
  );
}
