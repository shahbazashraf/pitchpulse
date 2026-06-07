/**
 * Provider Registry — Phase 1
 * Manages football data providers with fallback chain.
 * WC2026 provider is injected at priority 0 for World Cup matches.
 */
import type { FootballProvider } from "./base";
import type { ProviderResult, ProviderHealth } from "@/types";
import { ApiFootballProvider } from "./api-football";
import { FootballDataProvider } from "./football-data";

let _registry: ProviderRegistry | null = null;

export function getRegistry(): ProviderRegistry {
  if (!_registry) _registry = new ProviderRegistry();
  return _registry;
}

export class ProviderRegistry {
  private readonly providers: FootballProvider[];

  constructor() {
    this.providers = [
      new ApiFootballProvider(),
      new FootballDataProvider(),
    ].sort((a, b) => a.priority - b.priority);
  }

  async withFallback<T>(
    operation: (provider: FootballProvider) => Promise<ProviderResult<T>>,
    label: string,
  ): Promise<ProviderResult<T>> {
    const errors: string[] = [];
    for (const provider of this.providers) {
      try {
        const result = await operation(provider);
        if (result.data !== null) return result;
        errors.push(`${provider.name}: returned null`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${provider.name}: ${msg}`);
        console.warn(`[Registry] ${label} failed on ${provider.name}: ${msg}`);
      }
    }
    return {
      data: null, provider: "none", cached: false,
      fetchedAt: new Date().toISOString(),
      error: `All providers failed: ${errors.join("; ")}`,
    };
  }

  getLiveMatches(competitionIds?: string[]) {
    return this.withFallback((p) => p.getLiveMatches(competitionIds), `getLiveMatches`);
  }
  getMatchesByDate(date: string, competitionIds?: string[]) {
    return this.withFallback((p) => p.getMatchesByDate(date, competitionIds), `getMatchesByDate(${date})`);
  }
  getMatch(id: string) {
    return this.withFallback((p) => p.getMatch(id), `getMatch(${id})`);
  }
  getMatchEvents(matchId: string) {
    return this.withFallback((p) => p.getMatchEvents(matchId), `getMatchEvents`);
  }
  getMatchStats(matchId: string) {
    return this.withFallback((p) => p.getMatchStats(matchId), `getMatchStats`);
  }
  getMatchLineups(matchId: string) {
    return this.withFallback((p) => p.getMatchLineups(matchId), `getMatchLineups`);
  }
  getStandings(competitionId: string, season?: string) {
    return this.withFallback((p) => p.getStandings(competitionId, season), `getStandings(${competitionId})`);
  }
  getCompetitions(season?: string) {
    return this.withFallback((p) => p.getCompetitions(season), "getCompetitions");
  }
  getCompetition(id: string, season?: string) {
    return this.withFallback((p) => p.getCompetition(id, season), `getCompetition(${id})`);
  }
  getTeam(id: string) {
    return this.withFallback((p) => p.getTeam(id), `getTeam(${id})`);
  }
  getTeamSquad(teamId: string, season?: string) {
    return this.withFallback((p) => p.getTeamSquad(teamId, season), `getTeamSquad`);
  }
  getPlayer(id: string) {
    return this.withFallback((p) => p.getPlayer(id), `getPlayer(${id})`);
  }
  async getAllHealth(): Promise<ProviderHealth[]> {
    return Promise.all(this.providers.map((p) => p.healthCheck()));
  }
}
