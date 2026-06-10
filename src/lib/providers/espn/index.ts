import type {
  NormalizedMatch, NormalizedStanding, NormalizedCompetition,
  NormalizedTeam, NormalizedPlayer, NormalizedVenue, NormalizedMatchEvent,
  NormalizedMatchStats, NormalizedLineup, LineupPlayer,
  ProviderResult, ProviderHealth, MatchStatus, EventType, Position,
} from "@/types";
import {
  FootballProvider, ProviderHttpClient,
  makeProviderResult, makeProviderError,
} from "../base";

const BASE_URL = "https://site.api.espn.com";

export class EspnProvider implements FootballProvider {
  readonly name = "espn";
  readonly priority = 0;

  private readonly http: ProviderHttpClient;

  static readonly LEAGUE_SLUGS: Record<string, string> = {
    "premier-league":   "eng.1",
    "la-liga":          "esp.1",
    "bundesliga":       "ger.1",
    "serie-a":          "ita.1",
    "ligue-1":          "fra.1",
    "champions-league": "uefa.champions",
    "europa-league":    "uefa.europa",
    "mls":              "usa.1",
  };

  // Reverse: espn slug → internal competition ID
  private static readonly SLUG_TO_ID: Record<string, string> = Object.fromEntries(
    Object.entries(EspnProvider.LEAGUE_SLUGS).map(([id, slug]) => [slug, id])
  );

  constructor() {
    // 300 req/min is a safe conservative limit for ESPN's undocumented API
    this.http = new ProviderHttpClient(BASE_URL, {}, 300);
  }

  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.http.get(`/apis/site/v2/sports/soccer/eng.1/scoreboard`, { timeoutMs: 5000, retries: 1 });
      return {
        provider: this.name, isHealthy: true,
        latencyMs: Date.now() - start, lastSuccess: new Date().toISOString(),
        lastError: null, requestsToday: 0, quotaLimit: null, quotaRemaining: null,
      };
    } catch (err) {
      return {
        provider: this.name, isHealthy: false,
        latencyMs: Date.now() - start, lastSuccess: null,
        lastError: err instanceof Error ? err.message : String(err),
        requestsToday: 0, quotaLimit: null, quotaRemaining: null,
      };
    }
  }

  async getLiveMatches(competitionIds?: string[]): Promise<ProviderResult<NormalizedMatch[]>> {
    try {
      const slugs = this.resolveSlugs(competitionIds);
      const results = await Promise.allSettled(
        slugs.map((slug) => this.fetchScoreboard(slug))
      );
      const matches: NormalizedMatch[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") {
          matches.push(...r.value.filter((m) => isLiveStatus(m.status)));
        }
      }
      return makeProviderResult(matches, this.name);
    } catch (err) {
      return makeProviderError(err, this.name);
    }
  }

  async getMatchesByDate(date: string, competitionIds?: string[]): Promise<ProviderResult<NormalizedMatch[]>> {
    try {
      const espnDate = date.replace(/-/g, ""); // YYYYMMDD
      const slugs = this.resolveSlugs(competitionIds);
      const results = await Promise.allSettled(
        slugs.map((slug) => this.fetchScoreboard(slug, espnDate))
      );
      const matches: NormalizedMatch[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") matches.push(...r.value);
      }
      return makeProviderResult(matches, this.name);
    } catch (err) {
      return makeProviderError(err, this.name);
    }
  }

  async getMatch(id: string): Promise<ProviderResult<NormalizedMatch>> {
    try {
      const { slug, eventId } = parseMatchId(id);
      if (!slug || !eventId) return makeProviderError(new Error(`Invalid ESPN match id: ${id}`), this.name);

      const data = await this.http.get<any>(
        `/apis/site/v2/sports/soccer/${slug}/summary`,
        { params: { event: eventId } }
      );

      const header = data?.header;
      const comp = header?.competitions?.[0];
      if (!comp) return makeProviderError(new Error("No competition in summary"), this.name);

      const internalId = EspnProvider.SLUG_TO_ID[slug] ?? slug;
      const match = normalizeMatch(
        { id: eventId, date: comp.date, competitions: [comp] },
        slug,
        internalId
      );

      // Attach events
      match.events = normalizeKeyEvents(data?.keyEvents ?? [], id, comp);
      // Attach stats
      match.stats = normalizeBoxscoreStats(data?.boxscore?.teams ?? [], id, comp);
      // Attach lineups
      match.lineups = normalizeRosters(data?.rosters ?? [], id);

      // Half-time scores from boxscore (not always available)
      const htHome = comp?.competitors?.find((c: any) => c.homeAway === "home")?.linescores?.[0]?.value;
      const htAway = comp?.competitors?.find((c: any) => c.homeAway === "away")?.linescores?.[0]?.value;
      if (htHome != null) match.homeScoreHT = Number(htHome);
      if (htAway != null) match.awayScoreHT = Number(htAway);

      return makeProviderResult(match, this.name);
    } catch (err) {
      return makeProviderError(err, this.name);
    }
  }

  async getMatchEvents(matchId: string): Promise<ProviderResult<NormalizedMatch["events"]>> {
    const r = await this.getMatch(matchId);
    if (r.data) return makeProviderResult(r.data.events, this.name);
    return makeProviderError(r.error ?? "getMatch failed", this.name);
  }

  async getMatchStats(matchId: string): Promise<ProviderResult<NormalizedMatch["stats"]>> {
    const r = await this.getMatch(matchId);
    if (r.data) return makeProviderResult(r.data.stats, this.name);
    return makeProviderError(r.error ?? "getMatch failed", this.name);
  }

  async getMatchLineups(matchId: string): Promise<ProviderResult<NormalizedMatch["lineups"]>> {
    const r = await this.getMatch(matchId);
    if (r.data) return makeProviderResult(r.data.lineups, this.name);
    return makeProviderError(r.error ?? "getMatch failed", this.name);
  }

  async getStandings(competitionId: string): Promise<ProviderResult<NormalizedStanding[]>> {
    try {
      const slug = EspnProvider.LEAGUE_SLUGS[competitionId];
      if (!slug) return makeProviderError(new Error(`No ESPN slug for: ${competitionId}`), this.name);

      const data = await this.http.get<any>(`/apis/site/v2/sports/soccer/${slug}/standings`);
      const standings = normalizeStandings(data, competitionId);
      return makeProviderResult(standings, this.name);
    } catch (err) {
      return makeProviderError(err, this.name);
    }
  }

  // Stubs — not needed for core match/standings functionality
  async getCompetitions(): Promise<ProviderResult<NormalizedCompetition[]>> {
    return makeProviderError(new Error("not implemented"), this.name);
  }
  async getCompetition(): Promise<ProviderResult<NormalizedCompetition>> {
    return makeProviderError(new Error("not implemented"), this.name);
  }
  async getTeam(): Promise<ProviderResult<NormalizedTeam>> {
    return makeProviderError(new Error("not implemented"), this.name);
  }
  async getTeamSquad(): Promise<ProviderResult<NormalizedPlayer[]>> {
    return makeProviderError(new Error("not implemented"), this.name);
  }
  async getPlayer(): Promise<ProviderResult<NormalizedPlayer>> {
    return makeProviderError(new Error("not implemented"), this.name);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private resolveSlugs(competitionIds?: string[]): string[] {
    if (!competitionIds?.length) return Object.values(EspnProvider.LEAGUE_SLUGS);
    return competitionIds
      .map((id) => EspnProvider.LEAGUE_SLUGS[id])
      .filter((s): s is string => Boolean(s));
  }

  private async fetchScoreboard(slug: string, dates?: string): Promise<NormalizedMatch[]> {
    const params: Record<string, string> = {};
    if (dates) params.dates = dates;
    const data = await this.http.get<any>(
      `/apis/site/v2/sports/soccer/${slug}/scoreboard`,
      { params }
    );
    const internalId = EspnProvider.SLUG_TO_ID[slug] ?? slug;
    return (data?.events ?? []).map((event: any) => normalizeMatch(event, slug, internalId));
  }
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeMatch(event: any, leagueSlug: string, internalCompId: string): NormalizedMatch {
  const comp = event?.competitions?.[0] ?? {};
  const competitors: any[] = comp?.competitors ?? [];
  const home = competitors.find((c: any) => c.homeAway === "home");
  const away = competitors.find((c: any) => c.homeAway === "away");
  const status = normalizeStatus(comp?.status);
  const minute = parseMinute(comp?.status?.displayClock);

  return {
    id: `espn:${leagueSlug}:${event.id}`,
    provider: "espn",
    providerId: event.id,
    competitionId: internalCompId,
    season: String(new Date(event.date ?? "").getFullYear() || new Date().getFullYear()),
    round: comp?.notes?.[0]?.headline ?? event.week?.text ?? null,
    roundType: "other",
    group: null,
    homeTeam: normalizeTeam(home),
    awayTeam: normalizeTeam(away),
    homeScore: parseScore(home?.score, status),
    awayScore: parseScore(away?.score, status),
    homeScoreHT: null,
    awayScoreHT: null,
    homeScoreET: null,
    awayScoreET: null,
    homePenalties: null,
    awayPenalties: null,
    status,
    minute,
    injuryTime: null,
    venue: normalizeVenue(comp?.venue ?? event?.venue),
    referee: null,
    startTime: event.date ?? new Date().toISOString(),
    timezone: "UTC",
    events: [],
    stats: null,
    lineups: null,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeTeam(competitor: any): NormalizedTeam {
  const team = competitor?.team ?? {};
  return {
    id: `espn:${team.id ?? "unknown"}`,
    provider: "espn",
    providerId: team.id ?? "",
    name: team.displayName ?? team.name ?? "Unknown",
    shortName: team.shortDisplayName ?? team.name ?? "Unknown",
    code: team.abbreviation ?? (team.shortDisplayName ?? "???").slice(0, 3).toUpperCase(),
    country: team.location ?? "",
    countryCode: "",
    logoUrl: team.logo ?? null,
  };
}

function normalizeVenue(venue: any): NormalizedVenue | null {
  if (!venue?.fullName) return null;
  return {
    id: String(venue.id ?? ""),
    name: venue.fullName,
    city: venue.address?.city ?? "",
    country: venue.address?.country ?? "",
    capacity: null,
    surface: null,
    imageUrl: null,
  };
}

function normalizeStatus(espnStatus: any): MatchStatus {
  const name: string = espnStatus?.type?.name ?? "";
  const period: number = espnStatus?.period ?? 1;
  const description: string = espnStatus?.type?.description ?? "";

  if (name === "STATUS_SCHEDULED") return "NS";
  if (name === "STATUS_HALFTIME") return "HT";
  if (name === "STATUS_IN_PROGRESS") {
    if (description.toLowerCase().includes("halftime")) return "HT";
    if (period >= 3) return "ET";
    return period >= 2 ? "2H" : "1H";
  }
  if (name === "STATUS_FULL_TIME" || name === "STATUS_FINAL") return "FT";
  if (name === "STATUS_FINAL_AET") return "AET";
  if (name === "STATUS_FINAL_PEN") return "PEN";
  if (name === "STATUS_POSTPONED") return "PST";
  if (name === "STATUS_CANCELED") return "CANC";
  if (name === "STATUS_SUSPENDED") return "SUSP";
  if (name === "STATUS_ABANDONED") return "ABD";
  // Fallback: check state
  const state: string = espnStatus?.type?.state ?? "";
  if (state === "in") return "1H";
  if (state === "post") return "FT";
  return "NS";
}

function parseMinute(displayClock: string | undefined): number | null {
  if (!displayClock) return null;
  const match = displayClock.match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function parseScore(score: string | number | undefined, status: MatchStatus): number | null {
  if (status === "NS") return null;
  if (score == null || score === "") return null;
  const n = Number(score);
  return isNaN(n) ? null : n;
}

function normalizeKeyEvents(keyEvents: any[], matchId: string, comp: any): NormalizedMatchEvent[] {
  const competitors: any[] = comp?.competitors ?? [];
  const homeId = competitors.find((c: any) => c.homeAway === "home")?.team?.id;

  return keyEvents
    .map((e: any): NormalizedMatchEvent | null => {
      const type = normalizeEventType(e?.type?.type ?? "");
      if (!type) return null;

      const participants: any[] = e?.participants ?? [];
      const primary = participants[0]?.athlete;
      const assist = participants[1]?.athlete;
      const teamId = e?.team?.id ? `espn:${e.team.id}` : null;
      const teamSide: "home" | "away" = e?.team?.id === homeId ? "home" : "away";

      return {
        id: String(e.id),
        matchId,
        type,
        minute: parseMinute(e?.clock?.displayValue) ?? 0,
        extraMinute: null,
        teamId: teamId ?? "",
        teamSide,
        playerId: primary?.id ? `espn:${primary.id}` : null,
        playerName: primary?.displayName ?? null,
        assistPlayerId: assist?.id ? `espn:${assist.id}` : null,
        assistPlayerName: assist?.displayName ?? null,
        detail: e?.shortText ?? null,
        comments: e?.text ?? null,
      };
    })
    .filter((e): e is NormalizedMatchEvent => e !== null);
}

function normalizeEventType(espnType: string): EventType | null {
  if (!espnType) return null;
  const t = espnType.toLowerCase();
  if (t.includes("goal") && t.includes("own")) return "Own Goal";
  if (t.includes("goal") && t.includes("penalty")) return "Penalty Goal";
  if (t.includes("goal") && t.includes("miss")) return "Penalty Missed";
  if (t.includes("goal")) return "Goal";
  if (t.includes("yellow-red") || t.includes("second-yellow")) return "Yellow Red Card";
  if (t.includes("red")) return "Red Card";
  if (t.includes("yellow")) return "Yellow Card";
  if (t.includes("substitution") || t.includes("sub")) return "Substitution";
  if (t.includes("var")) return "VAR";
  return null;
}

function normalizeBoxscoreStats(teams: any[], matchId: string, comp: any): NormalizedMatchStats[] | null {
  if (!teams?.length) return null;

  return teams.map((t: any): NormalizedMatchStats => {
    const side: "home" | "away" = t.homeAway === "home" ? "home" : "away";
    const teamId = t?.team?.id ? `espn:${t.team.id}` : "";
    const stats: any[] = t?.statistics ?? [];
    const s = (name: string) => {
      const found = stats.find((x: any) => x.name === name);
      if (!found) return null;
      const n = parseFloat(found.displayValue);
      return isNaN(n) ? null : n;
    };

    return {
      matchId,
      teamId,
      side,
      shotsOnGoal: s("shotsOnTarget"),
      shotsOffGoal: s("totalShots") != null && s("shotsOnTarget") != null
        ? (s("totalShots")! - s("shotsOnTarget")!) : null,
      totalShots: s("totalShots"),
      blockedShots: s("blockedShots"),
      shotsInsidePenaltyArea: null,
      shotsOutsidePenaltyArea: null,
      fouls: s("foulsCommitted"),
      cornerKicks: s("wonCorners"),
      offsides: s("offsides"),
      ballPossession: s("possessionPct") != null ? Math.round(s("possessionPct")! * 100) : null,
      yellowCards: s("yellowCards"),
      redCards: s("redCards"),
      goalkeeperSaves: s("saves"),
      totalPasses: s("totalPasses"),
      passesAccurate: s("accuratePasses"),
      passAccuracy: s("passPct") != null ? Math.round(s("passPct")! * 100) : null,
      expectedGoals: null,
    };
  });
}

function normalizeRosters(rosters: any[], matchId: string): NormalizedLineup[] | null {
  if (!rosters?.length) return null;

  return rosters.map((r: any): NormalizedLineup => {
    const side: "home" | "away" = r.homeAway === "home" ? "home" : "away";
    const teamId = r?.team?.id ? `espn:${r.team.id}` : "";
    const players: any[] = r?.roster ?? [];

    const startingXI: LineupPlayer[] = players
      .filter((p: any) => p.starter)
      .map((p: any) => normalizeLineupPlayer(p));

    const substitutes: LineupPlayer[] = players
      .filter((p: any) => !p.starter)
      .map((p: any) => normalizeLineupPlayer(p));

    return {
      matchId,
      teamId,
      side,
      formation: r.formation ?? null,
      coach: null,
      startingXI,
      substitutes,
    };
  });
}

function normalizeLineupPlayer(p: any): LineupPlayer {
  const athlete = p?.athlete ?? {};
  return {
    playerId: athlete.id ? `espn:${athlete.id}` : null,
    name: athlete.displayName ?? athlete.shortName ?? "Unknown",
    number: p.jersey ? parseInt(p.jersey) : null,
    position: normalizePosition(p?.position?.abbreviation),
    grid: p.formationPlace ? String(p.formationPlace) : null,
    isCaptain: false,
    isSubstituted: p.subbedOut === true,
    rating: null,
  };
}

function normalizePosition(abbr: string | undefined): Position | null {
  if (!abbr) return null;
  const a = abbr.toUpperCase();
  if (a === "GK" || a === "G") return "G";
  if (a === "D" || a.startsWith("CB") || a.startsWith("LB") || a.startsWith("RB") || a === "SW") return "D";
  if (a === "M" || a.startsWith("CM") || a.startsWith("DM") || a.startsWith("AM") || a === "LM" || a === "RM") return "M";
  if (a === "F" || a === "FW" || a.startsWith("CF") || a === "SS" || a === "LW" || a === "RW" || a === "ST" || a === "ATT") return "F";
  return null;
}

function normalizeStandings(data: any, competitionId: string): NormalizedStanding[] {
  // ESPN standings can come back as {} (empty) for some leagues
  const children: any[] = data?.children ?? [];
  if (!children.length) return [];

  const entries = children.flatMap((child: any) => {
    const group: string | null = child.name ?? null;
    const standingsData = child?.standings?.entries ?? [];
    return standingsData.map((e: any, rank: number) => {
      const team = e?.team ?? {};
      const stats: any[] = e?.stats ?? [];
      const s = (name: string) => {
        const found = stats.find((x: any) => x.name === name);
        return found ? (parseInt(found.value) || 0) : 0;
      };

      return {
        rank: rank + 1,
        team: {
          id: `espn:${team.id}`,
          provider: "espn",
          providerId: team.id ?? "",
          name: team.displayName ?? "",
          shortName: team.shortDisplayName ?? team.name ?? "",
          code: team.abbreviation ?? "",
          country: team.location ?? "",
          countryCode: "",
          logoUrl: team.logos?.[0]?.href ?? null,
        } as NormalizedTeam,
        played: s("gamesPlayed"),
        win: s("wins"),
        draw: s("ties"),
        lose: s("losses"),
        goalsFor: s("pointsFor"),
        goalsAgainst: s("pointsAgainst"),
        goalDifference: s("pointDifferential"),
        points: s("points"),
        form: null,
        status: null,
        description: null,
        group,
      };
    });
  });

  return [{
    competitionId,
    season: String(new Date().getFullYear()),
    group: null,
    entries,
  }];
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function isLiveStatus(status: MatchStatus): boolean {
  return ["1H", "2H", "HT", "ET", "P", "BT"].includes(status);
}

function parseMatchId(id: string): { slug: string; eventId: string } {
  // Format: "espn:{leagueSlug}:{eventId}"
  const parts = id.split(":");
  if (parts.length < 3 || parts[0] !== "espn") return { slug: "", eventId: "" };
  const eventId = parts[parts.length - 1];
  const slug = parts.slice(1, -1).join(":");
  return { slug, eventId };
}
