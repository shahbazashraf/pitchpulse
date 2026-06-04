"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Newspaper, ExternalLink, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Article {
  id: string;
  headline: string;
  summary: string;
  source: string;
  sourceName: string;
  imageUrl: string | null;
  url: string;
  publishedAt: string;
  tags: string[];
}

const SOURCE_COLORS: Record<string, string> = {
  bbc_sport_football: "text-orange-400",
  sky_sports_football: "text-sky-400",
  espn_fc: "text-red-400",
  fifa_news: "text-pitch-blue",
  uefa_news: "text-pitch-green",
  goal_com: "text-pitch-gold",
  as_en: "text-pink-400",
};

export default function NewsPage() {
  const { data: articles = [], isLoading, isFetching, refetch } = useQuery<Article[]>({
    queryKey: ["news"],
    queryFn: async () => {
      const res = await fetch("/api/news");
      if (!res.ok) return [];
      const json = await res.json();
      return json.articles ?? [];
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-pitch-blue/10 border border-pitch-blue/20 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-pitch-blue" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-pitch-text-primary">Latest News</h1>
            <p className="text-xs text-pitch-text-muted">BBC, Sky, ESPN, FIFA, UEFA</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg hover:bg-pitch-muted/40 text-pitch-text-secondary transition-colors"
          disabled={isFetching}
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
        </button>
      </div>

      {isLoading ? (
        <NewsSkeleton />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {articles.map((article, i) => (
            <NewsCard key={article.id} article={article} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewsCard({ article, index }: { article: Article; index: number }) {
  const sourceColor = SOURCE_COLORS[article.source] ?? "text-pitch-text-muted";
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true });
    } catch {
      return "";
    }
  })();

  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="group glass glass-hover rounded-2xl border border-pitch-border/60 overflow-hidden flex flex-col"
    >
      {/* Image */}
      {article.imageUrl && (
        <div className="relative h-40 bg-pitch-dark overflow-hidden">
          <img
            src={article.imageUrl}
            alt={article.headline}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-pitch-dark/80 via-transparent to-transparent" />
        </div>
      )}

      <div className="px-4 py-3 flex-1 flex flex-col gap-2">
        {/* Source + time */}
        <div className="flex items-center justify-between">
          <span className={cn("text-xs font-semibold", sourceColor)}>
            {article.sourceName}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-pitch-text-muted">
            <Clock className="w-3 h-3" />
            {timeAgo}
          </div>
        </div>

        {/* Headline */}
        <h2 className="text-sm font-semibold text-pitch-text-primary leading-snug line-clamp-2 group-hover:text-pitch-green transition-colors">
          {article.headline}
        </h2>

        {/* Summary */}
        {article.summary && (
          <p className="text-xs text-pitch-text-muted leading-relaxed line-clamp-2">
            {article.summary}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex gap-1 flex-wrap">
            {article.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-pitch-muted/30 text-pitch-text-muted border border-pitch-border/30"
              >
                {tag}
              </span>
            ))}
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-pitch-text-muted group-hover:text-pitch-green transition-colors" />
        </div>
      </div>
    </motion.a>
  );
}

function NewsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-pitch-border/40">
          <div className="h-40 skeleton" />
          <div className="p-4 space-y-2">
            <div className="h-3 w-24 rounded skeleton" />
            <div className="h-4 rounded skeleton" />
            <div className="h-4 w-3/4 rounded skeleton" />
            <div className="h-3 w-1/2 rounded skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}
