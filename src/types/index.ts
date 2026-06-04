// ─── Core Football Types ────────────────────────────────────────────────────

export type MatchStatus =
  | "NS"        // Not Started
  | "1H"        // First Half
  | "HT"        // Halftime
  | "2H"        // Second Half
  | "ET"        // Extra Time
  | "BT"        // Break Time (ET halftime)
  | "P"         // Penalties
  | "SUSP"      // Suspended
  | "INT"       // Interrupted
  | "FT"        // Full Time
  | "AET"       // After Extra Time
  | "PEN"       // After Penalties
  | "PST"       // Postponed
  | "CANC"      // Cancelled
  | "ABD"       // Abandoned
  | "AWD"       // Technical Loss
  | "WO";       // Walkover

export type EventType =
  | "Goal"
  | "Own Goal"
  | "Yellow Card"
  | "Red Card"
  | "Yellow Red Card"
  | "Substitution"
  | "VAR"
  | "Penalty Missed"
  | "Penalty Goal";

export type Position = "G" | "D" | "M" | "F";

// ─── Normalized Entities ────────────────────────────────────────────────────

export interface NormalizedTeam {
  id: string;            // internal id: provider:originalId
  provider: string;
  providerId: string | number;
  name: string;
  shortName: string;
  code: string;          // 3-letter
  country: string;
  countryCode: string;
  logoUrl: string | null;
  venueId?: string;
  founded?: number;
}

export interface NormalizedVenue {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number | null;
  surface: string | null;
  imageUrl: string | null;
}

export interface NormalizedPlayer {
  id: string;
  provider: string;
  providerId: string | number;
  name: string;
  firstName: string;
  lastName: string;
  nationality: string;
  dateOfBirth: string | null;
  position: Position | null;
  number: number | null;
  photoUrl: string | null;
  height: string | null;
  weight: string | null;
  teamId: string | null;
}

export interface NormalizedMatchEvent {
  id: string;
  matchId: string;
  type: EventType;
  minute: number;
  extraMinute: number | null;
  teamId: string;
  teamSide: "home" | "away";
  playerId: string | null;
  playerName: string | null;
  assistPlayerId: string | null;
  assistPlayerName: string | null;
  detail: string | null;
  comments: string | null;
}

export interface NormalizedMatchStats {
  matchId: string;
  teamId: string;
  side: "home" | "away";
  shotsOnGoal: number | null;
  shotsOffGoal: number | null;
  totalShots: number | null;
  blockedShots: number | null;
  shotsInsidePenaltyArea: number | null;
  shotsOutsidePenaltyArea: number | null;
  fouls: number | null;
  cornerKicks: number | null;
  offsides: number | null;
  ballPossession: number | null;
  yellowCards: number | null;
  redCards: number | null;
  goalkeeperSaves: number | null;
  totalPasses: number | null;
  passesAccurate: number | null;
  passAccuracy: number | null;
  expectedGoals: number | null;
}

export interface NormalizedLineup {
  matchId: string;
  teamId: string;
  side: "home" | "away";
  formation: string | null;
  coach: string | null;
  startingXI: LineupPlayer[];
  substitutes: LineupPlayer[];
}

export interface LineupPlayer {
  playerId: string | null;
  name: string;
  number: number | null;
  position: Position | null;
  grid: string | null; // e.g. "1:1", "2:1", for visual positioning
  isCaptain: boolean;
  isSubstituted: boolean;
  rating: number | null;
}

export interface NormalizedMatch {
  id: string;
  provider: string;
  providerId: string | number;
  competitionId: string;
  season: string;
  round: string | null;
  roundType: "group" | "round_of_32" | "round_of_16" | "quarter_final" | "semi_final" | "final" | "other";
  group: string | null;
  homeTeam: NormalizedTeam;
  awayTeam: NormalizedTeam;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreHT: number | null;
  awayScoreHT: number | null;
  homeScoreET: number | null;
  awayScoreET: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  status: MatchStatus;
  minute: number | null;
  injuryTime: number | null;
  venue: NormalizedVenue | null;
  referee: string | null;
  startTime: string;   // ISO 8601 UTC
  timezone: string;
  events: NormalizedMatchEvent[];
  stats: NormalizedMatchStats[] | null;
  lineups: NormalizedLineup[] | null;
  updatedAt: string;
}

export interface NormalizedStanding {
  competitionId: string;
  season: string;
  group: string | null;
  entries: StandingEntry[];
}

export interface StandingEntry {
  rank: number;
  team: NormalizedTeam;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string | null;
  status: "same" | "up" | "down" | null;
  description: string | null;
}

export interface NormalizedCompetition {
  id: string;
  provider: string;
  providerId: string | number;
  name: string;
  type: "Cup" | "League" | "Super Cup" | "Friendly" | "Qualification";
  country: string | null;
  countryCode: string | null;
  logoUrl: string | null;
  season: string;
  currentRound: string | null;
  startDate: string | null;
  endDate: string | null;
}

// ─── Stream Discovery ────────────────────────────────────────────────────────

export interface StreamSource {
  id: string;
  matchId: string;
  broadcaster: string;
  broadcasterId: string;
  title: string;
  url: string;
  embedUrl: string | null;
  streamType: "live" | "replay" | "highlight";
  quality: "SD" | "HD" | "FHD" | "4K";
  language: string;
  region: string[];           // ISO 3166-1 alpha-2 codes; [] = worldwide
  isOfficial: boolean;
  isGeoRestricted: boolean;
  requiresAuth: boolean;
  requiresSubscription: boolean;
  isFree: boolean;
  isAvailable: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
  lastVerified: string;
  thumbnailUrl: string | null;
  platform: "youtube" | "twitch" | "facebook" | "web" | "app";
}

// ─── News ────────────────────────────────────────────────────────────────────

export interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  body: string | null;
  source: string;
  sourceName: string;
  sourceLogoUrl: string | null;
  author: string | null;
  imageUrl: string | null;
  url: string;
  publishedAt: string;
  tags: string[];
  competitionId: string | null;
  teamIds: string[];
  playerIds: string[];
  matchId: string | null;
  language: string;
}

// ─── Commentary ──────────────────────────────────────────────────────────────

export interface Commentary {
  id: string;
  matchId: string;
  minute: number | null;
  extraMinute: number | null;
  text: string;
  isHighlight: boolean;
  eventId: string | null;
  eventType: EventType | null;
  source: "provider" | "ai_generated";
  createdAt: string;
}

// ─── Predictions ─────────────────────────────────────────────────────────────

export interface MatchPrediction {
  matchId: string;
  source: "user" | "ai";
  userId: string | null;
  homeWinProbability: number;
  drawProbability: number;
  awayWinProbability: number;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  confidence: number;
  reasoning: string | null;
  createdAt: string;
}

// ─── Provider Response Types ─────────────────────────────────────────────────

export interface ProviderResult<T> {
  data: T | null;
  provider: string;
  cached: boolean;
  fetchedAt: string;
  error: string | null;
}

export interface ProviderHealth {
  provider: string;
  isHealthy: boolean;
  latencyMs: number | null;
  lastSuccess: string | null;
  lastError: string | null;
  requestsToday: number;
  quotaLimit: number | null;
  quotaRemaining: number | null;
}
