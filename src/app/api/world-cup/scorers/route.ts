import { NextResponse } from "next/server";
import { EspnProvider } from "@/lib/providers/espn";
import { WC_TEAMS } from "@/lib/worldcup2026/data";

export const runtime = "nodejs";
export const revalidate = 120;

const WC_START_DATE = "2026-06-11";

const STATIC_SCORERS = [
  { rank: 1, name: "Kylian Mbappé",     team: "FRA", flag: "🇫🇷", goals: 0, assists: 0 },
  { rank: 2, name: "Lionel Messi",       team: "ARG", flag: "🇦🇷", goals: 0, assists: 0 },
  { rank: 3, name: "Erling Haaland",     team: "NOR", flag: "🇳🇴", goals: 0, assists: 0 },
  { rank: 4, name: "Vinicius Jr",        team: "BRA", flag: "🇧🇷", goals: 0, assists: 0 },
  { rank: 5, name: "Jude Bellingham",    team: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", goals: 0, assists: 0 },
  { rank: 6, name: "Lamine Yamal",       team: "ESP", flag: "🇪🇸", goals: 0, assists: 0 },
  { rank: 7, name: "Pedri",              team: "ESP", flag: "🇪🇸", goals: 0, assists: 0 },
  { rank: 8, name: "Florian Wirtz",      team: "GER", flag: "🇩🇪", goals: 0, assists: 0 },
  { rank: 9, name: "Rafael Leão",        team: "POR", flag: "🇵🇹", goals: 0, assists: 0 },
  { rank: 10, name: "Phil Foden",        team: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", goals: 0, assists: 0 },
];

type ScorerRow = { name: string; team: string; flag: string; goals: number; assists: number };

export async function GET() {
  try {
    const espn = new EspnProvider();
    const start = new Date(WC_START_DATE);
    const today = new Date();
    const dates: string[] = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }

    // Fetch all WC match days
    const dayResults = await Promise.allSettled(
      dates.map((d) => espn.getMatchesByDate(d, ["fifa-world-cup-2026"])),
    );

    const completedMatches = dayResults
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof espn.getMatchesByDate>>> => r.status === "fulfilled")
      .flatMap((r) => r.value.data ?? [])
      .filter((m) => ["FT", "AET", "PEN"].includes(m.status));

    if (!completedMatches.length) {
      return NextResponse.json({ scorers: STATIC_SCORERS, fetchedAt: new Date().toISOString() });
    }

    // Fetch match summaries (with keyEvents) — cap at 48 to avoid over-fetching
    const matchIds = completedMatches.map((m) => m.id).slice(0, 48);
    const summaries = await Promise.allSettled(
      matchIds.map((id) => espn.getMatch(id)),
    );

    const scorers: Record<string, ScorerRow> = {};

    for (const s of summaries) {
      if (s.status !== "fulfilled" || !s.value.data) continue;
      const match = s.value.data;
      const homeTeam = match.homeTeam as typeof match.homeTeam & { flag?: string };
      const awayTeam = match.awayTeam as typeof match.awayTeam & { flag?: string };

      for (const ev of match.events ?? []) {
        if (!["Goal", "Penalty Goal"].includes(ev.type)) continue;
        if (!ev.playerName) continue;

        const team = ev.teamSide === "home" ? homeTeam : awayTeam;
        const flag = team.flag ?? WC_TEAMS[team.code]?.flag ?? "";

        const key = ev.playerName;
        if (!scorers[key]) {
          scorers[key] = { name: ev.playerName, team: team.code, flag, goals: 0, assists: 0 };
        }
        scorers[key].goals++;

        if (ev.assistPlayerName) {
          const assistKey = ev.assistPlayerName;
          if (!scorers[assistKey]) {
            scorers[assistKey] = { name: ev.assistPlayerName, team: team.code, flag, goals: 0, assists: 0 };
          }
          scorers[assistKey].assists++;
        }
      }
    }

    const ranked = Object.values(scorers)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
      .slice(0, 10)
      .map((s, i) => ({ rank: i + 1, ...s }));

    if (!ranked.length) {
      return NextResponse.json({ scorers: STATIC_SCORERS, fetchedAt: new Date().toISOString() });
    }

    return NextResponse.json({ scorers: ranked, fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ scorers: STATIC_SCORERS, fetchedAt: new Date().toISOString() });
  }
}
