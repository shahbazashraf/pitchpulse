import { NextResponse } from "next/server";

export const runtime = "edge";

// Static star players — updated when real scorer data flows in
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

export async function GET() {
  return NextResponse.json({
    scorers: STATIC_SCORERS,
    fetchedAt: new Date().toISOString(),
  });
}
