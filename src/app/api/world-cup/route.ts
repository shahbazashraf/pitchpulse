import { NextResponse } from "next/server";
import { WC_FIXTURES, WC_TEAMS } from "@/lib/worldcup2026/data";

export const runtime = "nodejs";

const FINAL_DATE = new Date("2026-07-19T20:00:00Z");

export async function GET() {
  const now = new Date();

  // Next 3 upcoming fixtures
  const nextMatches = WC_FIXTURES
    .filter((f) => new Date(f.kickoffUtc) > now)
    .slice(0, 3)
    .map((f) => ({
      ...f,
      homeTeam: WC_TEAMS[f.homeTeamCode],
      awayTeam: WC_TEAMS[f.awayTeamCode],
    }));

  // Today's fixture count
  const today = now.toISOString().slice(0, 10);
  const todayFixtureCount = WC_FIXTURES.filter((f) =>
    f.kickoffUtc.startsWith(today)
  ).length;

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
