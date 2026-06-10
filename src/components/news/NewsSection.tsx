"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ExternalLink, Clock } from "lucide-react";
import { NewsArticle } from "@/types";

interface NewsSectionProps {
  limit?: number;
}

const SOURCE_COLORS: Record<string, string> = {
  bbc:         "bg-red-600",
  sky:         "bg-blue-600",
  espn:        "bg-red-700",
  fifa:        "bg-blue-800",
  uefa:        "bg-blue-700",
  goal:        "bg-orange-600",
  as:          "bg-red-500",
  pitchpulse:  "bg-pitch-green",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SourceBadge({ source, name }: { source: string; name: string }) {
  const color = SOURCE_COLORS[source.toLowerCase()] ?? "bg-pitch-muted";
  return (
    <span className={`${color} text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide`}>
      {name}
    </span>
  );
}

function FeaturedNewsCard({ article, index }: { article: NewsArticle; index: number }) {
  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card group flex flex-col gap-3 hover:border-pitch-green/20 border border-transparent transition-all"
    >
      {article.imageUrl && (
        <div className="relative h-40 rounded-xl overflow-hidden bg-pitch-muted/40">
          <img
            src={article.imageUrl}
            alt={article.headline}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-pitch-dark/60 to-transparent" />
        </div>
      )}
      <div className="flex items-center gap-2">
        <SourceBadge source={article.source} name={article.sourceName} />
        {article.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="text-[10px] text-pitch-text-muted bg-pitch-muted/40 px-2 py-0.5 rounded-full">
            {tag}
          </span>
        ))}
      </div>
      <h3 className="text-base font-bold text-pitch-text-primary leading-snug group-hover:text-pitch-green transition-colors">
        {article.headline}
      </h3>
      <p className="text-sm text-pitch-text-secondary leading-relaxed">
        {article.aiSummary ?? article.summary}
      </p>
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-1 text-xs text-pitch-text-muted">
          <Clock className="w-3 h-3" />
          {timeAgo(article.publishedAt)}
        </div>
        <span className="flex items-center gap-1 text-xs text-pitch-text-secondary group-hover:text-pitch-green transition-colors font-medium">
          Read more <ExternalLink className="w-3 h-3" />
        </span>
      </div>
    </motion.a>
  );
}

function SmallNewsCard({ article, index }: { article: NewsArticle; index: number }) {
  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card group flex flex-col gap-2 hover:border-pitch-green/20 border border-transparent transition-all"
    >
      <SourceBadge source={article.source} name={article.sourceName} />
      <p className="text-sm font-semibold text-pitch-text-primary leading-snug line-clamp-2 group-hover:text-pitch-green transition-colors">
        {article.headline}
      </p>
      <div className="flex items-center gap-1 text-xs text-pitch-text-muted mt-auto">
        <Clock className="w-3 h-3" />
        {timeAgo(article.publishedAt)}
      </div>
    </motion.a>
  );
}

function NewsSectionSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="glass rounded-2xl h-52 skeleton" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl h-24 skeleton" />
        ))}
      </div>
    </div>
  );
}

const FALLBACK_ARTICLE: NewsArticle = {
  id: "fallback-wc26",
  headline: "FIFA World Cup 2026 — Everything you need to know",
  summary: "The biggest World Cup ever. 48 teams, 104 matches, 16 cities across the USA, Canada, and Mexico. Follow every match live with real-time scores, highlights, and AI-powered commentary.",
  body: null,
  source: "fifa",
  sourceName: "FIFA",
  sourceLogoUrl: null,
  author: null,
  imageUrl: null,
  url: "https://www.fifa.com/worldcup/",
  publishedAt: new Date().toISOString(),
  tags: ["World Cup 2026"],
  competitionId: "fifa-world-cup-2026",
  teamIds: [],
  playerIds: [],
  matchId: null,
  language: "en",
};

export function NewsSection({ limit = 5 }: NewsSectionProps) {
  const { data: articles = [], isLoading } = useQuery<NewsArticle[]>({
    queryKey: ["news-homepage", limit],
    queryFn: async () => {
      const res = await fetch(`/api/news?limit=${limit}&summary=true`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.articles ?? []) as NewsArticle[];
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <NewsSectionSkeleton />;

  const display = articles.length > 0 ? articles : [FALLBACK_ARTICLE];
  const [featured, ...rest] = display;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Featured story */}
      <FeaturedNewsCard article={featured} index={0} />

      {/* Grid of smaller cards */}
      {rest.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {rest.slice(0, 4).map((article, i) => (
            <SmallNewsCard key={article.id} article={article} index={i + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
