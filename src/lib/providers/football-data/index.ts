/**
 * Football-Data.org v4 Provider
 * Docs: https://www.football-data.org/documentation/quickstart
 * Priority: 3 (fallback)
 * Free tier: 10 req/min
 */

import type {
  NormalizedMatch,
  NormalizedStanding,
  NormalizedCompetition,
  NormalizedTeam,
  NormalizedPlayer,
  ProviderResult,
  ProviderHealth,
  MatchStatus,
} from "@/types";
import {
  FootballProvider,
  ProviderHttpClient,
  makeProviderResult,
  makeProviderError,
} from "../base";

export class FootballDataProvider implements FootballProvider {
  readonly name = "football-data";
  readonly priority = 3;

  private readonly client: ProviderHttpClient;
  private readonly PREFIX = "footballdata";

  // Football-Data competition codes
  static readonly COMPETITION_CODES: Record<string, string> = {
    "premier-league": "PL",
    "champions-league": "CL",
    "bundesliga": "BL1",
    "serie-a": "SA",
    "ligue-1": "FL1",
    "la-liga": "PD",
    "eredivisie": "DED",
    "primera-liga-portugal": "PPL",
    "championship": "ELC",
    "euro-2024": "EC",
    "world-cup": "WC",
  };

  constructor() {
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) {
      console.warn("[FootballData] FOOTBALL_DATA_API_KEY not set");
    }
    this.client = new ProviderHttpClient(
      "https://api.football-data.org/v4",
      {
        "X-Auth-Token": apiKey ?? "",
        "Accept": "application/json",
      },
      10, // free tier: 10 req/min
    );
  }

  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.client.get("/competitions?plan=TIER_ONE", { timeoutMs: 5000, retries: 1 });
      return {
        provider: this.name,
        isHealthy: true,
        latencyMs: Date.now() - start,
        lastSuccess: new Date().toISOString(),
        lastError: null,
        requestsToday: 0,
        quotaLimit: null,
        quotaRemaining: null,
      };
    } catch (err) {
      return {
        provider: this.name,
        isHealthy: false,
        latencyMs: Date.now() - start,
        lastSuccess: null,
        lastError: err instanceof Error ? err.message : String(err),
        requestsToday: 0,
        quotaLimit: null,
        quotaRemaining: null,
      };
    }
  }

  async getCompetitions(): Promise<ProviderResult<NormalizedCompetition[]>> {
    try {
      const data = await this.client.get<any>("/competitions");
      const comps = (data.competitions ?? []).map((c: any) =>
        this.normalizeCompetition(c),
      );
      return makeProviderResult(comps, this.name);
    } catch (err) {
      return makeProviderError(err, this.name);
    }
  }

  async getCompetition(internalId: string): Promise<ProviderResult<NormalizedCompetition>> {
    const code = FootballDataProvider.COMPETITION_CODES[internalId];
    if (!code) return makeProviderError(`Unknown: ${internalId}`, this.name);
    try {
      const data = await this.client.get<any>(`/competitions/${code}`);
      return makeProviderResult(this.normalizeCompetition(data), this.name);
    } catch (err) {
      return makeProviderError(err, this.name);
    }
  }

  async getLiveMatches(): Promise<ProviderResult<NormalizedMatch[]>> {
    try {
      const data = await this.client.get<any>("/matches?status=LIVE");
      const matches = (data.matches ?? []).map((m: any) => this.normalizeMatch(m));
      return makeProviderResult(matches, this.name);
    } catch (err) {
      return makeProviderError(err, this.name);
    }
  }

  async getMatchesByDate(date: string): Promise<ProviderResult<NormalizedMatch[]>> {
    try {
      const data = await this.client.get<any>(`/matches?dateFrom=${date}&dateTo=${date}`);
      return makeProviderResult(
        (data.matches ?? []).map((m: any) => this.normalizeMatch(m)),
        this.name,
      );
    } catch (err) {
      return makeProviderError(err, this.name);
    }
  }

  async getMatch(id: string): Promise<ProviderResult<NormalizedMatch>> {
    const providerId = this.extractProviderId(id);
    try {
      const data = await this.client.get<any>(`/matches/${providerId}`);
      return makeProviderResult(this.normalizeMatch(data), this.name);
    } catch (err) {
      return makeProviderError(err, this.name);
    }
  }

  async getMatchEvents(matchId: string): Promise<ProviderResult<NormalizedMatch["events"]>> {
    // Football-data includes goals in match response but no granular events endpoint on free tier
    const result = await this.getMatch(matchId);
    return makeProviderResult(result.data?.events ?? [], this.name);
  }

  async getMatchStats(matchId: string): Promise<ProviderResult<NormalizedMatch["stats"]>> {
    return makeProviderResult(null, this.name);
  }

  async getMatchLineups(matchId: string): Promise<ProviderResult<NormalizedMatch["lineups"]>> {
    const providerId = this.extractProviderId(matchId);
    try {
      const data = await this.client.get<any>(`/matches/${providerId}`);
      if (!data.homeTeam?.lineup?.length) return makeProviderResult(null, this.name);
      return makeProviderResult(
        [
          this.normalizeLineup(data.homeTeam, matchId, "home"),
          this.normalizeLineup(data.awayTeam, matchId, "away"),
        ],
        this.name,
      );
    } catch (err) {
      return makeProviderError(err, this.name);
    }
  }

  async getStandings(competitionId: string, season?: string): Promise<ProviderResult<NormalizedStanding[]>> {
    const code = FootballDataProvider.COMPETITION_CODES[competitionId];
    if (!code) return makeProviderError(`Unknown: ${competitionId}`, this.name);
    try {
      const params = season ? `?season=${season}` : "";
      const data = await this.client.get<any>(`/competitions/${code}/standings${params}`);
      const standings = (data.standings ?? []).map((s: any) =>
        this.normalizeStanding(s, competitionId, season ?? ""),
      );
      return makeProviderResult(standings, this.name);
    } catch (err) {
      return makeProviderError(err, this.name);
    }
  }

  async getTeam(id: string): Promise<ProviderResult<NormalizedTeam>> {
    const providerId = this.extractProviderId(id);
    try {
      const data = await this.client.get<any>(`/teams/${providerId}`);
      return makeProviderResult(this.normalizeTeam(data), this.name);
    } catch (err) {
      return makeProviderError(err, this.name);
    }
  }

  async getTeamSquad(teamId: string): Promise<ProviderResult<NormalizedPlayer[]>> {
    const providerId = this.extractProviderId(teamId);
    try {
      const data = await this.client.get<any>(`/teams/${providerId}`);
      const players = (data.squad ?? []).map((p: any) =>
        this.normalizePlayer(p, teamId),
      );
      return makeProviderResult(players, this.name);
    } catch (err) {
      return makeProviderError(err, this.name);
    }
  }

  async getPlayer(id: string): Promise<ProviderResult<NormalizedPlayer>> {
    return makeProviderError("Not supported on free tier", this.name);
  }

  // ─── Normalizers ─────────────────────────────────────────────────────────

  private normalizeMatch(m: any): NormalizedMatch {
    return {
      id: `${this.PREFIX}:${m.id}`,
      provider: this.name,
      providerId: m.id,
      competitionId: m.competition?.id ? `${this.PREFIX}:${m.competition.id}` : "",
      season: m.season?.startDate?.substring(0, 4) ?? "",
      round: m.matchday ? `Matchday ${m.matchday}` : null,
      roundType: "other",
      group: m.group ?? null,
      homeTeam: this.normalizeTeam(m.homeTeam),
      awayTeam: this.normalizeTeam(m.awayTeam),
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      homeScoreHT: m.score?.halfTime?.home ?? null,
      awayScoreHT: m.score?.halfTime?.away ?? null,
      homeScoreET: m.score?.extraTime?.home ?? null,
      awayScoreET: m.score?.extraTime?.away ?? null,
      homePenalties: m.score?.penalties?.home ?? null,
      awayPenalties: m.score?.penalties?.away ?? null,
      status: normalizeFDStatus(m.status),
      minute: null,
      injuryTime: null,
      venue: m.venue ? { id: "", name: m.venue, city: "", country: "", capacity: null, surface: null, imageUrl: null } : null,
      referee: m.referees?.[0]?.name ?? null,
      startTime: m.utcDate,
      timezone: "UTC",
      events: [],
      stats: null,
      lineups: null,
      updatedAt: new Date().toISOString(),
    };
  }

  private normalizeTeam(t: any): NormalizedTeam {
    return {
      id: `${this.PREFIX}:${t.id}`,
      provider: this.name,
      providerId: t.id,
      name: t.name ?? t.shortName ?? "",
      shortName: t.shortName ?? t.tla ?? t.name ?? "",
      code: t.tla ?? "",
      country: t.area?.name ?? "",
      countryCode: t.area?.code ?? "",
      logoUrl: t.crest ?? null,
    };
  }

  private normalizePlayer(p: any, teamId: string): NormalizedPlayer {
    return {
      id: `${this.PREFIX}:${p.id}`,
      provider: this.name,
      providerId: p.id,
      name: p.name,
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? p.name ?? "",
      nationality: p.nationality ?? "",
      dateOfBirth: p.dateOfBirth ?? null,
      position: normalizePosition(p.position),
      number: p.shirtNumber ?? null,
      photoUrl: null,
      height: null,
      weight: null,
      teamId,
    };
  }

  private normalizeLineup(team: any, matchId: string, side: "home" | "away"): import("@/types").NormalizedLineup {
    return {
      matchId,
      teamId: `${this.PREFIX}:${team.id}`,
      side,
      formation: team.formation ?? null,
      coach: team.coach?.name ?? null,
      startingXI: (team.lineup ?? []).map((p: any) => ({
        playerId: p.id ? `${this.PREFIX}:${p.id}` : null,
        name: p.name ?? "",
        number: p.shirtNumber ?? null,
        position: normalizePosition(p.position),
        grid: null,
        isCaptain: p.captain ?? false,
        isSubstituted: false,
        rating: null,
      })),
      substitutes: (team.bench ?? []).map((p: any) => ({
        playerId: p.id ? `${this.PREFIX}:${p.id}` : null,
        name: p.name ?? "",
        number: p.shirtNumber ?? null,
        position: normalizePosition(p.position),
        grid: null,
        isCaptain: false,
        isSubstituted: false,
        rating: null,
      })),
    };
  }

  private normalizeStanding(s: any, competitionId: string, season: string): NormalizedStanding {
    return {
      competitionId,
      season,
      group: s.group ?? null,
      entries: (s.table ?? []).map((e: any) => ({
        rank: e.position,
        team: this.normalizeTeam(e.team),
        played: e.playedGames ?? 0,
        win: e.won ?? 0,
        draw: e.draw ?? 0,
        lose: e.lost ?? 0,
        goalsFor: e.goalsFor ?? 0,
        goalsAgainst: e.goalsAgainst ?? 0,
        goalDifference: e.goalDifference ?? 0,
        points: e.points ?? 0,
        form: e.form ?? null,
        status: null,
        description: null,
      })),
    };
  }

  private normalizeCompetition(c: any): NormalizedCompetition {
    return {
      id: `${this.PREFIX}:${c.id}`,
      provider: this.name,
      providerId: c.id,
      name: c.name,
      type: c.type === "CUP" ? "Cup" : "League",
      country: c.area?.name ?? null,
      countryCode: c.area?.code ?? null,
      logoUrl: c.emblem ?? null,
      season: c.currentSeason?.startDate?.substring(0, 4) ?? "",
      currentRound: c.currentSeason?.currentMatchday
        ? `Matchday ${c.currentSeason.currentMatchday}`
        : null,
      startDate: c.currentSeason?.startDate ?? null,
      endDate: c.currentSeason?.endDate ?? null,
    };
  }

  private extractProviderId(id: string): string {
    return id.includes(":") ? id.split(":")[1] : id;
  }
}

function normalizeFDStatus(s: string): MatchStatus {
  const map: Record<string, MatchStatus> = {
    SCHEDULED: "NS",
    TIMED: "NS",
    IN_PLAY: "1H",
    PAUSED: "HT",
    FINISHED: "FT",
    SUSPENDED: "SUSP",
    POSTPONED: "PST",
    CANCELLED: "CANC",
    AWARDED: "AWD",
  };
  return map[s] ?? "NS";
}

function normalizePosition(pos: string | null | undefined): import("@/types").Position | null {
  if (!pos) return null;
  if (pos.toLowerCase().includes("goalkeeper") || pos === "G") return "G";
  if (pos.toLowerCase().includes("defend") || pos === "D") return "D";
  if (pos.toLowerCase().includes("midfield") || pos === "M") return "M";
  if (pos.toLowerCase().includes("forward") || pos.toLowerCase().includes("attack") || pos === "F") return "F";
  return null;
}
