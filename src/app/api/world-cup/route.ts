import { NextResponse } from "next/server";
import { WC_FIXTURES, WC_TEAMS } from "@/lib/worldcup2026/data";
import { EspnProvider } from "@/lib/providers/espn";

export const runtime = "nodejs";
export const revalidate = 60;

const FINAL_DATE = new Date("2026-07-19T20:00:00Z");

export async function GET() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

  let nextMatches: object[] = [];
  let todayFixtureCount = 0;

  try {
    const espn = new EspnProvider();
    const [todayResult, tomorrowResult] = await Promise.allSettled([
      espn.getMatchesByDate(today, ["fifa-world-cup-2026"]),
      espn.getMatchesByDate(tomorrow, ["fifa-world-cup-2026"]),
    ]);

    const liveMatches = [
      ...(todayResult.status === "fulfilled" ? todayResult.value.data ?? [] : []),
      ...(tomorrowResult.status === "fulfilled" ? tomorrowResult.value.data ?? [] : []),
    ];

    if (liveMatches.length > 0) {
      todayFixtureCount = liveMatches.filter((m) => m.startTime.startsWith(today)).length;

      nextMatches = liveMatches
        .filter((m) => m.status === "NS")
        .slice(0, 3)
        .map((m) => {
          const homeWC = WC_TEAMS[m.homeTeam.code];
          const awayWC = WC_TEAMS[m.awayTeam.code];
          return {
            id: m.id,
            homeTeamCode: m.homeTeam.code,
            awayTeamCode: m.awayTeam.code,
            kickoffUtc: m.startTime,
            venue: m.venue?.name ?? "",
            city: m.venue?.city ?? "",
            homeTeam: homeWC ?? { name: m.homeTeam.name, shortName: m.homeTeam.shortName, flag: "", code: m.homeTeam.code },
            awayTeam: awayWC ?? { name: m.awayTeam.name, shortName: m.awayTeam.shortName, flag: "", code: m.awayTeam.code },
          };
        });
    }
  } catch {
    // fall through to static
  }

  // Static fallback if ESPN returned nothing
  if (nextMatches.length === 0) {
    const upcoming = WC_FIXTURES.filter((f) => new Date(f.kickoffUtc) > now);
    todayFixtureCount = WC_FIXTURES.filter((f) => f.kickoffUtc.startsWith(today)).length;
    nextMatches = upcoming.slice(0, 3).map((f) => ({
      ...f,
      homeTeam: WC_TEAMS[f.homeTeamCode] ?? { name: f.homeTeamCode, shortName: f.homeTeamCode, flag: "🏳️", code: f.homeTeamCode },
      awayTeam: WC_TEAMS[f.awayTeamCode] ?? { name: f.awayTeamCode, shortName: f.awayTeamCode, flag: "🏳️", code: f.awayTeamCode },
    }));
  }

  const daysUntilFinal = Math.max(
    0,
    Math.floor((FINAL_DATE.getTime() - now.getTime()) / 86_400_000),
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
