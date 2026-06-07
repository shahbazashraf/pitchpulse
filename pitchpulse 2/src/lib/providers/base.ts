import type {
  NormalizedMatch, NormalizedStanding, NormalizedCompetition,
  NormalizedTeam, NormalizedPlayer, ProviderResult, ProviderHealth,
} from "@/types";

export interface FootballProvider {
  readonly name: string;
  readonly priority: number;
  healthCheck(): Promise<ProviderHealth>;
  getCompetitions(season?: string): Promise<ProviderResult<NormalizedCompetition[]>>;
  getCompetition(id: string, season?: string): Promise<ProviderResult<NormalizedCompetition>>;
  getLiveMatches(competitionIds?: string[]): Promise<ProviderResult<NormalizedMatch[]>>;
  getMatchesByDate(date: string, competitionIds?: string[]): Promise<ProviderResult<NormalizedMatch[]>>;
  getMatch(id: string): Promise<ProviderResult<NormalizedMatch>>;
  getMatchEvents(matchId: string): Promise<ProviderResult<NormalizedMatch["events"]>>;
  getMatchStats(matchId: string): Promise<ProviderResult<NormalizedMatch["stats"]>>;
  getMatchLineups(matchId: string): Promise<ProviderResult<NormalizedMatch["lineups"]>>;
  getStandings(competitionId: string, season?: string): Promise<ProviderResult<NormalizedStanding[]>>;
  getTeam(id: string): Promise<ProviderResult<NormalizedTeam>>;
  getTeamSquad(teamId: string, season?: string): Promise<ProviderResult<NormalizedPlayer[]>>;
  getPlayer(id: string): Promise<ProviderResult<NormalizedPlayer>>;
}

export interface RequestOptions {
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
}

export class ProviderHttpClient {
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly windowMs = 60_000;

  constructor(
    private readonly baseUrl: string,
    private readonly defaultHeaders: Record<string, string>,
    private readonly requestsPerMinute: number,
  ) {}

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    await this.throttle();
    const url = new URL(path, this.baseUrl);
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        url.searchParams.set(k, String(v));
      }
    }
    const retries = options.retries ?? 3;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url.toString(), {
          headers: { ...this.defaultHeaders, ...options.headers },
          signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
          next: { revalidate: 30 },
        });
        if (!res.ok) {
          if (res.status === 429) {
            const retryAfter = Number(res.headers.get("Retry-After") ?? 60);
            await sleep(retryAfter * 1000);
            continue;
          }
          throw new ProviderError(`HTTP ${res.status}: ${res.statusText}`, res.status, url.toString());
        }
        return res.json() as Promise<T>;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < retries - 1) await sleep(Math.pow(2, attempt) * 1000);
      }
    }
    throw lastError ?? new Error("Unknown provider error");
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    if (now - this.windowStart > this.windowMs) {
      this.windowStart = now;
      this.requestCount = 0;
    }
    if (this.requestCount >= this.requestsPerMinute) {
      const waitMs = this.windowMs - (now - this.windowStart);
      await sleep(waitMs);
      this.windowStart = Date.now();
      this.requestCount = 0;
    }
    this.requestCount++;
  }
}

export class ProviderError extends Error {
  constructor(message: string, public readonly statusCode?: number, public readonly url?: string) {
    super(message);
    this.name = "ProviderError";
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export function makeProviderResult<T>(data: T, provider: string, cached = false): ProviderResult<T> {
  return { data, provider, cached, fetchedAt: new Date().toISOString(), error: null };
}

export function makeProviderError<T>(error: unknown, provider: string): ProviderResult<T> {
  return {
    data: null, provider, cached: false, fetchedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  };
}
