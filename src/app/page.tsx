import { Trophy, Play, Newspaper, Compass } from "lucide-react";
import Link from "next/link";
import ScoresDashboard from "@/components/match/ScoresDashboard";
import { WorldCupHero } from "@/components/match/WorldCupHero";
import { HighlightsFeed } from "@/components/highlights/HighlightsFeed";
import { NewsSection } from "@/components/news/NewsSection";
import { CompetitionCards } from "@/components/competitions/CompetitionCards";

export const metadata = {
  title: "PitchPulse – World Cup 2026 Football Hub",
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
        <div className="w-8 h-8 rounded-lg bg-pitch-green/15 border border-pitch-green/20 flex items-center justify-center text-pitch-green">
          {icon}
        </div>
        <h2 className="text-xl font-bold text-pitch-text-primary">{title}</h2>
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
    <div className="space-y-10">
      {/* 1. World Cup Hero */}
      <WorldCupHero />

      {/* 2. Live Matches */}
      <section>
        <SectionHeader
          icon={<Trophy className="w-4 h-4" />}
          title="Matches"
        />
        <ScoresDashboard />
      </section>

      {/* 3. World Cup Highlights */}
      <section>
        <SectionHeader
          icon={<Play className="w-4 h-4" />}
          title="World Cup Highlights"
          href="/world-cup"
        />
        <HighlightsFeed limit={6} />
      </section>

      {/* 4. Breaking Football News */}
      <section>
        <SectionHeader
          icon={<Newspaper className="w-4 h-4" />}
          title="Breaking Football News"
          href="/news"
        />
        <NewsSection limit={5} />
      </section>

      {/* 5. Explore Competitions */}
      <section>
        <SectionHeader
          icon={<Compass className="w-4 h-4" />}
          title="Explore Competitions"
        />
        <CompetitionCards />
      </section>
    </div>
  );
}
