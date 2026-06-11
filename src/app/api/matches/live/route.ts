import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/providers/registry";
import { cache, CacheKey, TTL } from "@/lib/cache";
import { wc2026Provider } from "@/lib/providers/wc2026";
import { WC_TEAMS } from "@/lib/worldcup2026/data";
import { enrichWCMatch } from "@/lib/worldcup2026/espnSync";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const competitions = searchParams.get("competitions")?.split(",").filter(Boolean);
  const cacheKey = CacheKey.liveMatches(competitions);

  try {
    const data = await cache.getOrFetch(
      cacheKey,
      async () => {
        // Run WC2026 provider + API-Football in parallel
        const [wcMatches, registryResult] = await Promise.allSettled([
          fetchWCLiveMatches(),
          getRegistry().getLiveMatches(competitions),
        ]);

        const wc = wcMatches.status === "fulfilled" ? wcMatches.value : [];
        const registryMatches = registryResult.status === "fulfilled" ? (registryResult.value.data ?? []) : [];

        // Only strip WC from registry when wc2026Provider returned its own data.
        // If wc is empty, keep registry WC matches (ESPN live data) so live WC games still show.
        const others = wc.length > 0
          ? registryMatches.filter((m) => m.competitionId !== "fifa-world-cup-2026")
          : registryMatches;

        const wcTeamPairs = new Set(wc.map((m: any) => `${m.homeTeam?.name}|${m.awayTeam?.name}`));
        const filteredOthers = others.filter(
          (m) => !wcTeamPairs.has(`${m.homeTeam.name}|${m.awayTeam.name}`),
        );

        return [...wc, ...filteredOthers].map(enrichWCMatch);
      },
      TTL.LIVE_MATCH,
    );

    return NextResponse.json(
      { matches: data, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": `public, s-maxage=${TTL.LIVE_MATCH}, stale-while-revalidate=10` } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch live matches" },
      { status: 503 },
    );
  }
}

async function fetchWCLiveMatches() {
  if (!wc2026Provider.isConfigured) return [];
  try {
    const raw = await wc2026Provider.getLiveMatches();
    return raw.map((m) => normalizeWCMatch(m));
  } catch {
    return [];
  }
}

function normalizeWCMatch(m: any) {
  const homeTeam = Object.values(WC_TEAMS).find((t) => t.name === m.homeTeam || t.code === m.homeTeam);
  const awayTeam = Object.values(WC_TEAMS).find((t) => t.name === m.awayTeam || t.code === m.awayTeam);

  return {
    id: `wc2026:${m.id}`,
    provider: "wc2026",
    providerId: m.id,
    competitionId: "fifa-world-cup-2026",
    season: "2026",
    round: m.stage ?? "Group Stage",
    roundType: m.group ? "group" : "other",
    group: m.group ?? null,
    homeTeam: {
      id: `wc2026:${m.homeTeam}`,
      provider: "wc2026",
      providerId: m.homeTeam,
      name: homeTeam?.name ?? m.homeTeam,
      shortName: homeTeam?.shortName ?? m.homeTeam,
      code: homeTeam?.code ?? m.homeTeam,
      country: homeTeam?.name ?? "",
      countryCode: homeTeam?.code ?? "",
      logoUrl: null,
      flag: homeTeam?.flag ?? "🏳️",
    },
    awayTeam: {
      id: `wc2026:${m.awayTeam}`,
      provider: "wc2026",
      providerId: m.awayTeam,
      name: awayTeam?.name ?? m.awayTeam,
      shortName: awayTeam?.shortName ?? m.awayTeam,
      code: awayTeam?.code ?? m.awayTeam,
      country: awayTeam?.name ?? "",
      countryCode: awayTeam?.code ?? "",
      logoUrl: null,
      flag: awayTeam?.flag ?? "🏳️",
    },
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    homeScoreHT: null,
    awayScoreHT: null,
    homeScoreET: null,
    awayScoreET: null,
    homePenalties: null,
    awayPenalties: null,
    status: normalizeWCStatus(m.status, m.minute),
    minute: m.minute ?? null,
    injuryTime: null,
    venue: m.venue ? { id: "", name: m.venue, city: m.city ?? "", country: "", capacity: null, surface: null, imageUrl: null } : null,
    referee: null,
    startTime: m.kickoff,
    timezone: "UTC",
    events: [],
    stats: null,
    lineups: null,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeWCStatus(status: string, minute?: number | null): string {
  const s = status?.toLowerCase();
  if (s === "live") return minute && minute > 45 ? "2H" : "1H";
  if (s === "halftime") return "HT";
  if (s === "finished") return "FT";
  if (s === "scheduled") return "NS";
  return "NS";
}
