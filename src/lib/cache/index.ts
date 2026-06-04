/**
 * Cache Layer
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL is set,
 * falls back to in-memory LRU for development.
 */

// ─── TTL constants (seconds) ─────────────────────────────────────────────────

export const TTL = {
  LIVE_MATCH: 15,          // live scores refresh every 15s
  MATCH_EVENTS: 20,        // events slightly slower
  MATCH_STATS: 30,
  MATCH_LINEUPS: 300,      // lineups rarely change mid-match
  UPCOMING_MATCHES: 120,   // upcoming fixtures
  STANDINGS: 300,          // tables every 5 min
  TEAM: 3600,              // team info hourly
  PLAYER: 3600,
  COMPETITION: 3600,
  STREAMS: 120,            // stream availability check every 2 min
  NEWS: 300,
  COMMENTARY: 10,          // commentary very fresh
} as const;

// ─── Cache key builders ──────────────────────────────────────────────────────

export const CacheKey = {
  liveMatches: (competitionIds?: string[]) =>
    `live:${competitionIds?.sort().join(",") ?? "all"}`,
  matchesByDate: (date: string, compIds?: string[]) =>
    `matches:date:${date}:${compIds?.sort().join(",") ?? "all"}`,
  match: (id: string) => `match:${id}`,
  matchEvents: (id: string) => `match:events:${id}`,
  matchStats: (id: string) => `match:stats:${id}`,
  matchLineups: (id: string) => `match:lineups:${id}`,
  standings: (compId: string, season?: string) =>
    `standings:${compId}:${season ?? "current"}`,
  team: (id: string) => `team:${id}`,
  teamSquad: (id: string, season?: string) =>
    `team:squad:${id}:${season ?? "current"}`,
  player: (id: string) => `player:${id}`,
  competition: (id: string, season?: string) =>
    `competition:${id}:${season ?? "current"}`,
  streams: (matchId: string) => `streams:${matchId}`,
  news: (page: number, tags: string[]) =>
    `news:${page}:${tags.sort().join(",")}`,
  commentary: (matchId: string) => `commentary:${matchId}`,
};

// ─── Upstash Redis client ────────────────────────────────────────────────────

interface RedisSetOptions {
  ex?: number; // TTL in seconds
}

interface UpstashClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: RedisSetOptions): Promise<"OK">;
  del(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

async function getUpstashClient(): Promise<UpstashClient | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  // Dynamic import to avoid build errors when not installed
  try {
    const { Redis } = await import("@upstash/redis");
    return new Redis({ url, token }) as unknown as UpstashClient;
  } catch {
    console.warn("[Cache] @upstash/redis not installed; using memory cache");
    return null;
  }
}

// ─── In-memory fallback ──────────────────────────────────────────────────────

interface MemEntry {
  value: unknown;
  expiresAt: number;
}

class MemoryCache implements UpstashClient {
  private store = new Map<string, MemEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, opts?: RedisSetOptions): Promise<"OK"> {
    const ttlMs = (opts?.ex ?? 60) * 1000;
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    // Evict oldest entries if > 1000 to prevent memory leak
    if (this.store.size > 1000) {
      const oldest = Array.from(this.store.keys())[0];
      this.store.delete(oldest);
    }
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return Array.from(this.store.keys()).filter((k) => regex.test(k));
  }
}

const memoryCache = new MemoryCache();

// ─── Cache singleton ─────────────────────────────────────────────────────────

let _client: UpstashClient | null = null;
let _clientReady = false;

async function getClient(): Promise<UpstashClient> {
  if (!_clientReady) {
    _client = await getUpstashClient();
    _clientReady = true;
  }
  return _client ?? memoryCache;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await getClient();
      return client.get<T>(key);
    } catch (err) {
      console.error("[Cache] get error:", err);
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      const client = await getClient();
      await client.set(key, JSON.stringify(value), { ex: ttlSeconds });
    } catch (err) {
      console.error("[Cache] set error:", err);
    }
  },

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number,
  ): Promise<T> {
    const cached = await cache.get<string>(key);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        // corrupted — fall through to fetch
      }
    }
    const data = await fetcher();
    await cache.set(key, data, ttlSeconds);
    return data;
  },

  async invalidate(key: string): Promise<void> {
    try {
      const client = await getClient();
      await client.del(key);
    } catch (err) {
      console.error("[Cache] invalidate error:", err);
    }
  },

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const client = await getClient();
      const keys = await client.keys(pattern);
      await Promise.all(keys.map((k) => client.del(k)));
    } catch (err) {
      console.error("[Cache] invalidatePattern error:", err);
    }
  },
};
