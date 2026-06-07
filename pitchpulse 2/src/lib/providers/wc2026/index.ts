/**
 * WC2026API.com Provider
 * ========================
 * Free tier: 100 req/day — no credit card required
 * Sign up: https://www.wc2026api.com (click "Get API Key")
 * Add to .env.local: WC2026_API_KEY=wc2026_your_key_here
 *
 * Priority: 0 — highest priority for all World Cup matches.
 * Pure fetch() — no npm packages — works in Edge Runtime.
 */

export interface WC2026Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string; // "live" | "scheduled" | "finished"
  minute: number | null;
  kickoff: string; // ISO date
  venue: string;
  city: string;
  country: string;
  group: string | null;
  stage: string;
  homeFlag: string;
  awayFlag: string;
}

export interface WC2026Standing {
  group: string;
  entries: WC2026StandingEntry[];
}

export interface WC2026StandingEntry {
  position: number;
  team: string;
  flag: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string;
}

class WC2026Provider {
  private readonly BASE = "https://api.wc2026api.com";
  private readonly key: string;

  constructor() {
    this.key = process.env.WC2026_API_KEY ?? "";
  }

  get isConfigured(): boolean {
    return Boolean(this.key);
  }

  private async fetchJson<T>(path: string): Promise<T> {
    if (!this.key) {
      throw new Error("WC2026_API_KEY not set");
    }

    const res = await fetch(`${this.BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this.key}`,
        Accept: "application/json",
      },
      // Next.js ISR — revalidate every 60s
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error(`WC2026API: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  async getLiveMatches(): Promise<WC2026Match[]> {
    try {
      const data = await this.fetchJson<{ matches: WC2026Match[] }>("/matches?status=live");
      return data.matches ?? [];
    } catch {
      return [];
    }
  }

  async getAllMatches(): Promise<WC2026Match[]> {
    try {
      const data = await this.fetchJson<{ matches: WC2026Match[] }>("/matches");
      return data.matches ?? [];
    } catch {
      return [];
    }
  }

  async getMatchesByDate(date: string): Promise<WC2026Match[]> {
    try {
      const data = await this.fetchJson<{ matches: WC2026Match[] }>(`/matches?date=${date}`);
      return data.matches ?? [];
    } catch {
      return [];
    }
  }

  async getStandings(): Promise<WC2026Standing[]> {
    try {
      const data = await this.fetchJson<{ standings: WC2026Standing[] }>("/standings");
      return data.standings ?? [];
    } catch {
      return [];
    }
  }

  async getMatchById(id: number): Promise<WC2026Match | null> {
    try {
      const data = await this.fetchJson<{ match: WC2026Match }>(`/matches/${id}`);
      return data.match ?? null;
    } catch {
      return null;
    }
  }
}

// Singleton
export const wc2026Provider = new WC2026Provider();
