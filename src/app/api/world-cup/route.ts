import { NextResponse } from "next/server";
import { WC_FIXTURES, WC_TEAMS } from "@/lib/worldcup2026/data";
import { fetchWCFixturesFromESPN } from "@/lib/worldcup2026/espnSync";

export const runtime = "nodejs";
export const revalidate = 60;

const FINAL_DATE = new Date("2026-07-19T20:00:00Z");

export async function GET() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

  // Fetch today + tomorrow from ESPN in parallel
  const [todayResult, tomorrowResult] = await Promise.allSettled([
    fetchWCFixturesFromESPN(today),
    fetchWCFixturesFromESPN(tomorrow),
  ]);

  const liveFixtures = [
    ...(todayResult.status === "fulfilled" ? todayResult.value : []),
    ...(tomorrowResult.status === "fulfilled" ? tomorrowResult.value : []),
  ];

  // Fall back to static data if ESPN returned nothing
  const sourceFixtures = liveFixtures.length > 0 ? liveFixtures : WC_FIXTURES;

  // Next 3 upcoming fixtures
  const nextMatches = sourceFixtures
    .filter((f) => new Date(f.kickoffUtc) > now)
    .slice(0, 3)
    .map((f) => ({
      ...f,
      homeTeam: WC_TEAMS[f.homeTeamCode] ?? { name: f.homeTeamCode, shortName: f.homeTeamCode, flag: "🏳️", code: f.homeTeamCode },
      awayTeam: WC_TEAMS[f.awayTeamCode] ?? { name: f.awayTeamCode, shortName: f.awayTeamCode, flag: "🏳️", code: f.awayTeamCode },
    }));

  // Today's count — use full static list for accuracy if ESPN only returned 2 days
  const todayFixtureCount = (liveFixtures.length > 0 ? liveFixtures : WC_FIXTURES)
    .filter((f) => f.kickoffUtc.startsWith(today))
    .length;

  const daysUntilFinal = Math.max(
    0,
    Math.floor((FINAL_DATE.getTime() - now.getTime()) / 86_400_000)
  );

  return NextResponse.json({
    nextMatches,
    todayFixtureCount,
    daysUntilFinal,
    totalTeams: 48,
    totalMatches: 104,
    hostCities: 16,
  });
}
