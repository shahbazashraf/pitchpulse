/**
 * PitchPulse Broadcaster Registry
 * ==================================
 * Static list of official free-to-air broadcasters for FIFA World Cup 2026.
 * No dynamic discovery needed — these are confirmed rights holders.
 *
 * CazéTV is the gold standard: YouTube embeds work everywhere,
 * no geo-block for highlights, confirmed FIFA rights for Brazil
 * (international viewers also get access through YouTube's global delivery).
 */

export interface Broadcaster {
  id: string;
  name: string;
  language: string;
  regions: string[];   // ISO 3166-1 alpha-2; [] = worldwide
  platform: "youtube" | "web" | "app";
  channelId?: string;  // YouTube channel ID
  baseUrl: string;
  isFree: boolean;
  requiresAuth: boolean;
  requiresSubscription: boolean;
  quality: "SD" | "HD" | "FHD" | "4K";
  notes?: string;
}

export const FREE_BROADCASTERS: Broadcaster[] = [
  {
    id: "cazé-tv",
    name: "CazéTV",
    language: "pt",
    regions: [],           // global via YouTube
    platform: "youtube",
    channelId: "UCsV9ovtNxDMnOp3KvmBrLsw",
    baseUrl: "https://www.youtube.com/@CazéTV/live",
    isFree: true,
    requiresAuth: false,
    requiresSubscription: false,
    quality: "FHD",
    notes: "All 104 WC matches. Official FIFA rights for Brazil. Global YouTube delivery.",
  },
  {
    id: "sbs-au",
    name: "SBS On Demand",
    language: "en",
    regions: ["AU"],
    platform: "web",
    baseUrl: "https://www.sbs.com.au/ondemand/live/sbs",
    isFree: true,
    requiresAuth: false,
    requiresSubscription: false,
    quality: "HD",
    notes: "Free in Australia, no login required.",
  },
  {
    id: "bbc-iplayer",
    name: "BBC iPlayer",
    language: "en",
    regions: ["GB"],
    platform: "web",
    baseUrl: "https://www.bbc.co.uk/iplayer/live/bbcone",
    isFree: true,
    requiresAuth: false,
    requiresSubscription: false,
    quality: "FHD",
    notes: "Free in UK. No login required for live TV.",
  },
  {
    id: "itvx",
    name: "ITVX",
    language: "en",
    regions: ["GB"],
    platform: "web",
    baseUrl: "https://www.itv.com/watch/live/itv1",
    isFree: true,
    requiresAuth: true,
    requiresSubscription: false,
    quality: "HD",
    notes: "Free in UK. Free account registration required.",
  },
  {
    id: "tv-azteca",
    name: "TV Azteca Deportes",
    language: "es",
    regions: ["MX"],
    platform: "web",
    baseUrl: "https://www.tvazteca.com/aztecadeportes/en-vivo",
    isFree: true,
    requiresAuth: false,
    requiresSubscription: false,
    quality: "HD",
    notes: "Free in Mexico.",
  },
  {
    id: "tubi",
    name: "Tubi",
    language: "en",
    regions: ["US"],
    platform: "web",
    baseUrl: "https://tubitv.com/live",
    isFree: true,
    requiresAuth: false,
    requiresSubscription: false,
    quality: "4K",
    notes: "2 matches free in 4K (USA). No login required.",
  },
  {
    id: "fifa-plus",
    name: "FIFA+",
    language: "en",
    regions: [],           // worldwide
    platform: "web",
    baseUrl: "https://plus.fifa.com",
    isFree: true,
    requiresAuth: true,
    requiresSubscription: false,
    quality: "HD",
    notes: "Official FIFA platform. Free account. Select markets only for live; all markets for highlights.",
  },
  {
    id: "tsn-ca",
    name: "TSN Direct",
    language: "en",
    regions: ["CA"],
    platform: "web",
    baseUrl: "https://www.tsn.ca/live",
    isFree: false,
    requiresAuth: true,
    requiresSubscription: true,
    quality: "HD",
    notes: "Canada — requires cable/streaming subscription.",
  },
  {
    id: "rmc-sport-fr",
    name: "M6 / TF1",
    language: "fr",
    regions: ["FR"],
    platform: "web",
    baseUrl: "https://www.tf1.fr/tf1/direct",
    isFree: true,
    requiresAuth: false,
    requiresSubscription: false,
    quality: "HD",
    notes: "Free-to-air in France.",
  },
  {
    id: "ard-de",
    name: "ARD Mediathek",
    language: "de",
    regions: ["DE"],
    platform: "web",
    baseUrl: "https://www.ardmediathek.de/live/Y3JpZDovL2Rhc2Vyc3RlLmRlL2xpdmUvY2xpcC8x",
    isFree: true,
    requiresAuth: false,
    requiresSubscription: false,
    quality: "HD",
    notes: "Free in Germany. Das Erste / ARD.",
  },
  {
    id: "rai-it",
    name: "RAI Play",
    language: "it",
    regions: ["IT"],
    platform: "web",
    baseUrl: "https://www.raiplay.it/dirette/rai1",
    isFree: true,
    requiresAuth: false,
    requiresSubscription: false,
    quality: "HD",
    notes: "Free in Italy.",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get broadcasters available in a specific region (+ worldwide ones). */
export function getBroadcastersForRegion(countryCode: string): Broadcaster[] {
  return FREE_BROADCASTERS.filter(
    (b) => b.regions.length === 0 || b.regions.includes(countryCode.toUpperCase()),
  );
}

/** Get only free broadcasters for a region. */
export function getFreeBroadcastersForRegion(countryCode: string): Broadcaster[] {
  return getBroadcastersForRegion(countryCode).filter((b) => b.isFree);
}

/**
 * Build a StreamSource-compatible object from a broadcaster for a specific match.
 * Used by the streams API route.
 */
export function broadcasterToStream(
  broadcaster: Broadcaster,
  matchId: string,
  isAvailable = false,
): Record<string, unknown> {
  return {
    id: `${matchId}:${broadcaster.id}`,
    matchId,
    broadcaster: broadcaster.name,
    broadcaster_id: broadcaster.id,
    title: `${broadcaster.name} — World Cup 2026 Live`,
    url: broadcaster.baseUrl,
    embed_url: broadcaster.platform === "youtube" && broadcaster.channelId
      ? `https://www.youtube.com/embed/live_stream?channel=${broadcaster.channelId}`
      : null,
    stream_type: "live",
    quality: broadcaster.quality,
    language: broadcaster.language,
    region: broadcaster.regions,
    is_official: true,
    is_geo_restricted: broadcaster.regions.length > 0,
    requires_auth: broadcaster.requiresAuth,
    requires_subscription: broadcaster.requiresSubscription,
    is_free: broadcaster.isFree,
    is_available: isAvailable,
    platform: broadcaster.platform,
    thumbnail_url: null,
    last_verified: new Date().toISOString(),
    notes: broadcaster.notes ?? null,
  };
}

/** World Cup broadcasters that are available everywhere (no geo-restriction). */
export const GLOBAL_WC_BROADCASTERS = FREE_BROADCASTERS.filter(
  (b) => b.regions.length === 0,
);
