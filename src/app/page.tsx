import { Suspense } from "react";
import { ScoresDashboard } from "@/components/match/ScoresDashboard";
import { WorldCupBanner } from "@/components/match/WorldCupBanner";

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      <WorldCupBanner />
      <Suspense fallback={<ScoresDashboardSkeleton />}>
        <ScoresDashboard />
      </Suspense>
    </div>
  );
}

function ScoresDashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-xl skeleton" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl skeleton" />
        ))}
      </div>
    </div>
  );
}
