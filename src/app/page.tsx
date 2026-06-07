import ScoresDashboard from '@/components/match/ScoresDashboard';
import { WorldCupBanner } from '@/components/match/WorldCupBanner';

export const metadata = {
  title: 'PitchPulse – Live Football Scores',
  description: 'Real‑time football scores, World Cup 2026 standings, streams, and AI commentary.',
};

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-hero-gradient p-8 text-center text-text-primary shadow-glass">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 animate-float">
          Welcome to PitchPulse
        </h1>
        <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto">
          Live scores, World Cup 2026 groups & standings, free streams, and AI‑powered match commentary—all in one premium experience.
        </p>
      </section>

      {/* World Cup Banner – shows next WC match if any */}
      <WorldCupBanner />

      {/* Live Scores */}
      <section>
        <h2 className="text-2xl font-semibold text-text-primary mb-4">Live Matches</h2>
        <ScoresDashboard />
      </section>
    </div>
  );
}
