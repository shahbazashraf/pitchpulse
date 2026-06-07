import type {
  NormalizedMatch, NormalizedStanding, NormalizedCompetition,
  NormalizedTeam, NormalizedPlayer, NormalizedMatchEvent,
  NormalizedMatchStats, NormalizedLineup, LineupPlayer,
  ProviderResult, ProviderHealth, MatchStatus, Position,
} from "@/types";
import { FootballProvider, ProviderHttpClient, makeProviderResult, makeProviderError } from "../base";

export class ApiFootballProvider implements FootballProvider {
  readonly name = "api-football";
  readonly priority = 1;
  private readonly client: ProviderHttpClient;
  private readonly PREFIX = "apifootball";

  static readonly COMPETITION_IDS: Record<string, number> = {
    "fifa-world-cup-2026": 1, "premier-league": 39, "la-liga": 140,
    "bundesliga": 78, "serie-a": 135, "ligue-1": 61,
    "champions-league": 2, "europa-league": 3, "mls": 253,
  };

  constructor() {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) console.warn("[ApiFootball] API_FOOTBALL_KEY not set");
    this.client = new ProviderHttpClient(
      "https://v3.football.api-sports.io",
      { "x-apisports-key": apiKey ?? "", "Accept": "application/json" },
      450,
    );
  }

  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const data = await this.client.get<any>("/status", { timeoutMs: 5000, retries: 1 });
      const r = data?.response;
      return {
        provider: this.name, isHealthy: true, latencyMs: Date.now() - start,
        lastSuccess: new Date().toISOString(), lastError: null,
        requestsToday: r?.requests?.current ?? 0,
        quotaLimit: r?.requests?.limit_day ?? null,
        quotaRemaining: r?.requests?.limit_day ? r.requests.limit_day - r.requests.current : null,
      };
    } catch (err) {
      return {
        provider: this.name, isHealthy: false, latencyMs: Date.now() - start,
        lastSuccess: null, lastError: err instanceof Error ? err.message : String(err),
        requestsToday: 0, quotaLimit: null, quotaRemaining: null,
      };
    }
  }

  async getCompetitions(season = currentSeason()): Promise<ProviderResult<NormalizedCompetition[]>> {
    try {
      const data = await this.client.get<any>("/leagues", { params: { season } });
      return makeProviderResult(data.response.map((i: any) => this.normalizeCompetition(i, season)), this.name);
    } catch (err) { return makeProviderError(err, this.name); }
  }

  async getCompetition(internalId: string, season = currentSeason()): Promise<ProviderResult<NormalizedCompetition>> {
    const leagueId = ApiFootballProvider.COMPETITION_IDS[internalId];
    if (!leagueId) return makeProviderError(`Unknown: ${internalId}`, this.name);
    try {
      const data = await this.client.get<any>("/leagues", { params: { id: leagueId, season } });
      if (!data.response.length) return makeProviderError("Not found", this.name);
      return makeProviderResult(this.normalizeCompetition(data.response[0], season), this.name);
    } catch (err) { return makeProviderError(err, this.name); }
  }

  async getLiveMatches(competitionIds?: string[]): Promise<ProviderResult<NormalizedMatch[]>> {
    try {
      const params: Record<string, string | number> = { live: "all" };
      if (competitionIds?.length) {
        const ids = competitionIds.map((id) => ApiFootballProvider.COMPETITION_IDS[id]).filter(Boolean).join("-");
        if (ids) params.league = ids;
      }
      const data = await this.client.get<any>("/fixtures", { params, timeoutMs: 8000 });
      return makeProviderResult(data.response.map((f: any) => this.normalizeMatch(f)), this.name);
    } catch (err) { return makeProviderError(err, this.name); }
  }

  async getMatchesByDate(date: string, competitionIds?: string[]): Promise<ProviderResult<NormalizedMatch[]>> {
    try {
      const params: Record<string, string | number> = { date };
      if (competitionIds?.length) {
        const ids = competitionIds.map((id) => ApiFootballProvider.COMPETITION_IDS[id]).filter(Boolean);
        if (ids.length === 1) params.league = ids[0];
      }
      const data = await this.client.get<any>("/fixtures", { params });
      return makeProviderResult(data.response.map((f: any) => this.normalizeMatch(f)), this.name);
    } catch (err) { return makeProviderError(err, this.name); }
  }

  async getMatch(id: string): Promise<ProviderResult<NormalizedMatch>> {
    try {
      const data = await this.client.get<any>("/fixtures", { params: { id: this.extractId(id) } });
      if (!data.response.length) return makeProviderError("Not found", this.name);
      return makeProviderResult(this.normalizeMatch(data.response[0]), this.name);
    } catch (err) { return makeProviderError(err, this.name); }
  }

  async getMatchEvents(matchId: string): Promise<ProviderResult<NormalizedMatchEvent[]>> {
    try {
      const data = await this.client.get<any>("/fixtures/events", { params: { fixture: this.extractId(matchId) } });
      return makeProviderResult(data.response.map((e: any, i: number) => this.normalizeEvent(e, matchId, i)), this.name);
    } catch (err) { return makeProviderError(err, this.name); }
  }

  async getMatchStats(matchId: string): Promise<ProviderResult<NormalizedMatchStats[]>> {
    try {
      const data = await this.client.get<any>("/fixtures/statistics", { params: { fixture: this.extractId(matchId) } });
      return makeProviderResult(data.response.map((s: any, i: number) => this.normalizeStats(s, matchId, i === 0 ? "home" : "away")), this.name);
    } catch (err) { return makeProviderError(err, this.name); }
  }

  async getMatchLineups(matchId: string): Promise<ProviderResult<NormalizedLineup[]>> {
    try {
      const data = await this.client.get<any>("/fixtures/lineups", { params: { fixture: this.extractId(matchId) } });
      return makeProviderResult(data.response.map((l: any, i: number) => this.normalizeLineup(l, matchId, i === 0 ? "home" : "away")), this.name);
    } catch (err) { return makeProviderError(err, this.name); }
  }

  async getStandings(competitionId: string, season = currentSeason()): Promise<ProviderResult<NormalizedStanding[]>> {
    const leagueId = ApiFootballProvider.COMPETITION_IDS[competitionId];
    if (!leagueId) return makeProviderError(`Unknown: ${competitionId}`, this.name);
    try {
      const data = await this.client.get<any>("/standings", { params: { league: leagueId, season } });
      if (!data.response.length) return makeProviderResult([], this.name);
      const leagueData = data.response[0]?.league;
      return makeProviderResult(
        (leagueData?.standings ?? []).map((g: any[]) => this.normalizeStanding(g, competitionId, season)),
        this.name,
      );
    } catch (err) { return makeProviderError(err, this.name); }
  }

  async getTeam(id: string): Promise<ProviderResult<NormalizedTeam>> {
    try {
      const data = await this.client.get<any>("/teams", { params: { id: this.extractId(id) } });
      if (!data.response.length) return makeProviderError("Not found", this.name);
      return makeProviderResult(this.normalizeTeam(data.response[0].team), this.name);
    } catch (err) { return makeProviderError(err, this.name); }
  }

  async getTeamSquad(teamId: string): Promise<ProviderResult<NormalizedPlayer[]>> {
    try {
      const data = await this.client.get<any>("/players/squads", { params: { team: this.extractId(teamId) } });
      return makeProviderResult((data.response[0]?.players ?? []).map((p: any) => this.normalizePlayer(p, teamId)), this.name);
    } catch (err) { return makeProviderError(err, this.name); }
  }

  async getPlayer(id: string): Promise<ProviderResult<NormalizedPlayer>> {
    try {
      const data = await this.client.get<any>("/players", { params: { id: this.extractId(id), season: currentSeason() } });
      if (!data.response.length) return makeProviderError("Not found", this.name);
      return makeProviderResult(this.normalizePlayer(data.response[0].player, null), this.name);
    } catch (err) { return makeProviderError(err, this.name); }
  }

  private normalizeMatch(f: any): NormalizedMatch {
    const { fixture, league, teams, goals, score } = f;
    return {
      id: `${this.PREFIX}:${fixture.id}`, provider: this.name, providerId: fixture.id,
      competitionId: `${this.PREFIX}:${league.id}`, season: String(league.season),
      round: league.round ?? null, roundType: normalizeRoundType(league.round ?? ""),
      group: null,
      homeTeam: this.normalizeTeam(teams.home), awayTeam: this.normalizeTeam(teams.away),
      homeScore: goals?.home ?? null, awayScore: goals?.away ?? null,
      homeScoreHT: score?.halftime?.home ?? null, awayScoreHT: score?.halftime?.away ?? null,
      homeScoreET: score?.extratime?.home ?? null, awayScoreET: score?.extratime?.away ?? null,
      homePenalties: score?.penalty?.home ?? null, awayPenalties: score?.penalty?.away ?? null,
      status: normalizeStatus(fixture.status?.short ?? "NS"),
      minute: fixture.status?.elapsed ?? null, injuryTime: fixture.status?.extra ?? null,
      venue: fixture.venue?.id ? { id: `${this.PREFIX}:${fixture.venue.id}`, name: fixture.venue.name ?? "", city: fixture.venue.city ?? "", country: "", capacity: null, surface: null, imageUrl: null } : null,
      referee: fixture.referee ?? null, startTime: fixture.date, timezone: fixture.timezone ?? "UTC",
      events: (f.events ?? []).map((e: any, i: number) => this.normalizeEvent(e, `${this.PREFIX}:${fixture.id}`, i)),
      stats: null, lineups: null, updatedAt: new Date().toISOString(),
    };
  }

  private normalizeTeam(t: any): NormalizedTeam {
    return {
      id: `${this.PREFIX}:${t.id}`, provider: this.name, providerId: t.id,
      name: t.name, shortName: t.name, code: t.code ?? t.name?.substring(0, 3).toUpperCase() ?? "",
      country: t.country ?? "", countryCode: "", logoUrl: t.logo ?? null,
    };
  }

  private normalizeEvent(e: any, matchId: string, idx: number): NormalizedMatchEvent {
    return {
      id: `${matchId}:event:${idx}`, matchId,
      type: normalizeEventType(e.type, e.detail),
      minute: e.time?.elapsed ?? 0, extraMinute: e.time?.extra ?? null,
      teamId: `${this.PREFIX}:${e.team?.id}`, teamSide: "home",
      playerId: e.player?.id ? `${this.PREFIX}:${e.player.id}` : null,
      playerName: e.player?.name ?? null,
      assistPlayerId: e.assist?.id ? `${this.PREFIX}:${e.assist.id}` : null,
      assistPlayerName: e.assist?.name ?? null,
      detail: e.detail ?? null, comments: e.comments ?? null,
    };
  }

  private normalizeStats(s: any, matchId: string, side: "home" | "away"): NormalizedMatchStats {
    const stat = (type: string): number | null => {
      const found = (s.statistics ?? []).find((st: any) => st.type === type);
      if (!found) return null;
      const v = found.value;
      if (v === null || v === undefined) return null;
      if (typeof v === "string" && v.endsWith("%")) return parseFloat(v);
      return typeof v === "number" ? v : null;
    };
    return {
      matchId, teamId: `${this.PREFIX}:${s.team?.id}`, side,
      shotsOnGoal: stat("Shots on Goal"), shotsOffGoal: stat("Shots off Goal"),
      totalShots: stat("Total Shots"), blockedShots: stat("Blocked Shots"),
      shotsInsidePenaltyArea: stat("Shots insidebox"), shotsOutsidePenaltyArea: stat("Shots outsidebox"),
      fouls: stat("Fouls"), cornerKicks: stat("Corner Kicks"), offsides: stat("Offsides"),
      ballPossession: stat("Ball Possession"), yellowCards: stat("Yellow Cards"),
      redCards: stat("Red Cards"), goalkeeperSaves: stat("Goalkeeper Saves"),
      totalPasses: stat("Total passes"), passesAccurate: stat("Passes accurate"),
      passAccuracy: stat("Passes %"), expectedGoals: stat("expected_goals"),
    };
  }

  private normalizeLineup(l: any, matchId: string, side: "home" | "away"): NormalizedLineup {
    const mapPlayer = (p: any): LineupPlayer => ({
      playerId: p.player?.id ? `${this.PREFIX}:${p.player.id}` : null,
      name: p.player?.name ?? "", number: p.player?.number ?? null,
      position: normalizePosition(p.player?.pos), grid: p.player?.grid ?? null,
      isCaptain: p.player?.captain ?? false, isSubstituted: false,
      rating: p.statistics?.[0]?.games?.rating ? parseFloat(p.statistics[0].games.rating) : null,
    });
    return {
      matchId, teamId: `${this.PREFIX}:${l.team?.id}`, side,
      formation: l.formation ?? null, coach: l.coach?.name ?? null,
      startingXI: (l.startXI ?? []).map(mapPlayer),
      substitutes: (l.substitutes ?? []).map(mapPlayer),
    };
  }

  private normalizeStanding(entries: any[], competitionId: string, season: string): NormalizedStanding {
    return {
      competitionId, season, group: entries[0]?.group ?? null,
      entries: entries.map((e: any) => ({
        rank: e.rank, team: this.normalizeTeam(e.team),
        played: e.all?.played ?? 0, win: e.all?.win ?? 0,
        draw: e.all?.draw ?? 0, lose: e.all?.lose ?? 0,
        goalsFor: e.all?.goals?.for ?? 0, goalsAgainst: e.all?.goals?.against ?? 0,
        goalDifference: e.goalsDiff ?? 0, points: e.points ?? 0,
        form: e.form ?? null, status: e.status ?? null, description: e.description ?? null,
      })),
    };
  }

  private normalizeCompetition(item: any, season: string): NormalizedCompetition {
    const { league, country } = item;
    return {
      id: `${this.PREFIX}:${league.id}`, provider: this.name, providerId: league.id,
      name: league.name, type: league.type === "Cup" ? "Cup" : "League",
      country: country?.name ?? null, countryCode: country?.code ?? null,
      logoUrl: league.logo ?? null, season: String(season),
      currentRound: item.seasons?.[0]?.currentRound ?? null,
      startDate: item.seasons?.[0]?.start ?? null, endDate: item.seasons?.[0]?.end ?? null,
    };
  }

  private normalizePlayer(p: any, teamId: string | null): NormalizedPlayer {
    return {
      id: `${this.PREFIX}:${p.id}`, provider: this.name, providerId: p.id,
      name: p.name, firstName: p.firstname ?? "", lastName: p.lastname ?? "",
      nationality: p.nationality ?? "", dateOfBirth: p.birth?.date ?? null,
      position: normalizePosition(p.position), number: p.number ?? null,
      photoUrl: p.photo ?? null, height: p.height ?? null, weight: p.weight ?? null, teamId,
    };
  }

  private extractId(id: string): string { return id.includes(":") ? id.split(":")[1] : id; }
}

function currentSeason(): string {
  const now = new Date();
  return now.getMonth() >= 7 ? String(now.getFullYear()) : String(now.getFullYear() - 1);
}

function normalizeStatus(short: string): MatchStatus {
  const map: Record<string, MatchStatus> = {
    NS: "NS", "1H": "1H", HT: "HT", "2H": "2H", ET: "ET", BT: "BT", P: "P",
    SUSP: "SUSP", INT: "INT", FT: "FT", AET: "AET", PEN: "PEN",
    PST: "PST", CANC: "CANC", ABD: "ABD", AWD: "AWD", WO: "WO",
  };
  return map[short] ?? "NS";
}

function normalizeEventType(type: string, detail: string): import("@/types").EventType {
  if (type === "Goal") {
    if (detail?.toLowerCase().includes("own goal")) return "Own Goal";
    if (detail?.toLowerCase().includes("penalty")) return "Penalty Goal";
    return "Goal";
  }
  if (type === "Card") {
    if (detail === "Yellow Card") return "Yellow Card";
    if (detail === "Red Card") return "Red Card";
    if (detail === "Second Yellow card") return "Yellow Red Card";
  }
  if (type === "subst") return "Substitution";
  if (type === "Var") return "VAR";
  return "Goal";
}

function normalizePosition(pos: string | null | undefined): Position | null {
  if (!pos) return null;
  const map: Record<string, Position> = {
    G: "G", GK: "G", Goalkeeper: "G", D: "D", Defender: "D",
    M: "M", Midfielder: "M", F: "F", Forward: "F", A: "F", Attacker: "F",
  };
  return map[pos] ?? null;
}

function normalizeRoundType(round: string): NormalizedMatch["roundType"] {
  const r = round.toLowerCase();
  if (r.includes("group")) return "group";
  if (r.includes("round of 32")) return "round_of_32";
  if (r.includes("round of 16")) return "round_of_16";
  if (r.includes("quarter")) return "quarter_final";
  if (r.includes("semi")) return "semi_final";
  if (r.includes("final")) return "final";
  return "other";
}
