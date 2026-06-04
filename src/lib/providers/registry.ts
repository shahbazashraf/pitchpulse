/**
 * Provider Registry
 * Manages all football data providers and implements the fallback chain:
 * API-Football → SportMonks → FootballData → TheSportsDB
 */

import type { FootballProvider } from "./base";
import type { ProviderResult, ProviderHealth, NormalizedMatch, NormalizedStanding } from "@/types";
import { ApiFootballProvider } from "./api-football";
import { FootballDataProvider } from "./football-data";

// ─── Singleton instances ──────────────────────────────────────────────────────

let _registry: ProviderRegistry | null = null;

export function getRegistry(): ProviderRegistry {
  if (!_registry) _registry = new ProviderRegistry();
  return _registry;
}

// ─── Registry ────────────────────────────────────────────────────────────────

export class ProviderRegistry {
  private readonly providers: FootballProvider[];

  constructor() {
    this.providers = [
      new ApiFootballProvider(),
      new FootballDataProvider(),
      // new SportMonksProvider(),     // add when key available
      // new TheSportsDBProvider(),    // add when key available
    ].sort((a, b) => a.priority - b.priority);
  }

  // ─── Fallback wrapper ────────────────────────────────────────────────────

  /**
   * Try each provider in priority order. Returns first successful result.
   * Logs failures to console (replace with your logging service).
   */
  async withFallback<T>(
    operation: (provider: FootballProvider) => Promise<ProviderResult<T>>,
    label: string,
  ): Promise<ProviderResult<T>> {
    const errors: string[] = [];

    for (const provider of this.providers) {
      try {
        const result = await operation(provider);
        if (result.data !== null) {
          if (errors.length > 0) {
            console.info(`[Registry] ${label} succeeded on ${provider.name} after ${errors.length} failure(s)`);
          }
          return result;
        }
        errors.push(`${provider.name}: returned null`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${provider.name}: ${msg}`);
        console.warn(`[Registry] ${label} failed on ${provider.name}: ${msg}`);
      }
    }

    console.error(`[Registry] ${label} failed on all providers: ${errors.join(" | ")}`);
    return {
      data: null,
      provider: "none",
      cached: false,
      fetchedAt: new Date().toISOString(),
      error: `All providers failed: ${errors.join("; ")}`,
    };
  }

  // ─── Convenience methods ─────────────────────────────────────────────────

  getLiveMatches(competitionIds?: string[]) {
    return this.withFallback(
      (p) => p.getLiveMatches(competitionIds),
      `getLiveMatches(${competitionIds?.join(",") ?? "all"})`,
    );
  }

  getMatchesByDate(date: string, competitionIds?: string[]) {
    return this.withFallback(
      (p) => p.getMatchesByDate(date, competitionIds),
      `getMatchesByDate(${date})`,
    );
  }

  getMatch(id: string) {
    return this.withFallback(
      (p) => p.getMatch(id),
      `getMatch(${id})`,
    );
  }

  getMatchEvents(matchId: string) {
    return this.withFallback(
      (p) => p.getMatchEvents(matchId),
      `getMatchEvents(${matchId})`,
    );
  }

  getMatchStats(matchId: string) {
    return this.withFallback(
      (p) => p.getMatchStats(matchId),
      `getMatchStats(${matchId})`,
    );
  }

  getMatchLineups(matchId: string) {
    return this.withFallback(
      (p) => p.getMatchLineups(matchId),
      `getMatchLineups(${matchId})`,
    );
  }

  getStandings(competitionId: string, season?: string) {
    return this.withFallback(
      (p) => p.getStandings(competitionId, season),
      `getStandings(${competitionId})`,
    );
  }

  getCompetitions(season?: string) {
    return this.withFallback(
      (p) => p.getCompetitions(season),
      "getCompetitions",
    );
  }

  getCompetition(id: string, season?: string) {
    return this.withFallback(
      (p) => p.getCompetition(id, season),
      `getCompetition(${id})`,
    );
  }

  getTeam(id: string) {
    return this.withFallback(
      (p) => p.getTeam(id),
      `getTeam(${id})`,
    );
  }

  getTeamSquad(teamId: string, season?: string) {
    return this.withFallback(
      (p) => p.getTeamSquad(teamId, season),
      `getTeamSquad(${teamId})`,
    );
  }

  getPlayer(id: string) {
    return this.withFallback(
      (p) => p.getPlayer(id),
      `getPlayer(${id})`,
    );
  }

  // ─── Health checks ───────────────────────────────────────────────────────

  async getAllHealth(): Promise<ProviderHealth[]> {
    return Promise.all(this.providers.map((p) => p.healthCheck()));
  }
}
