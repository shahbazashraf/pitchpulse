import { Trophy, Play, Newspaper, Compass } from "lucide-react";
import Link from "next/link";
import ScoresDashboard from "@/components/match/ScoresDashboard";
import { WorldCupHero } from "@/components/match/WorldCupHero";
import { HighlightsFeed } from "@/components/highlights/HighlightsFeed";
import { OfficialHighlightsSection } from "@/components/highlights/OfficialHighlightsSection";
import { NewsSection } from "@/components/news/NewsSection";
import { CompetitionCards } from "@/components/competitions/CompetitionCards";

export const metadata = {
  title: "KickStreaming – World Cup 2026 Football Hub",
  description:
    "World Cup 2026 live scores, highlights, breaking football news, and free streams — all in one premium experience.",
};

function SectionHeader({
  icon,
  title,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-[3px] h-5 rounded-full bg-pitch-green/70 shrink-0" />
        <div className="w-8 h-8 rounded-lg bg-pitch-green/15 border border-pitch-green/20 flex items-center justify-center text-pitch-green">
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-pitch-text-primary">{title}</h2>
      </div>
      {href && (
        <Link
          href={href}
          className="text-sm text-pitch-text-secondary hover:text-pitch-green transition font-medium"
        >
          View all →
        </Link>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-12 pt-2">
      {/* 1. World Cup Hero */}
      <WorldCupHero />

      {/* 2. Explore Competitions */}
      <section className="reveal-on-scroll">
        <SectionHeader
          icon={<Compass className="w-4 h-4" />}
          title="Explore Competitions"
        />
        <CompetitionCards />
      </section>

      {/* 3. Live Matches */}
      <section className="content-visibility-auto contain-intrinsic-size-matches reveal-on-scroll">
        <SectionHeader
          icon={<Trophy className="w-4 h-4" />}
          title="Matches"
        />
        <ScoresDashboard />
      </section>

      {/* 4. FIFA/UEFA official highlights */}
      <OfficialHighlightsSection limit={4} />

      {/* 5. Latest Highlights */}
      <section className="content-visibility-auto contain-intrinsic-size-highlights reveal-on-scroll">
        <SectionHeader
          icon={<Play className="w-4 h-4" />}
          title="Latest Highlights"
          href="/highlights"
        />
        <HighlightsFeed limit={4} />
      </section>

      {/* 6. Breaking Football News */}
      <section className="content-visibility-auto contain-intrinsic-size-news reveal-on-scroll">
        <SectionHeader
          icon={<Newspaper className="w-4 h-4" />}
          title="Breaking Football News"
          href="/news"
        />
        <NewsSection limit={5} />
      </section>
    </div>
  );
}
