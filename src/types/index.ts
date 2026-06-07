export type MatchStatus =
  | "NS" | "1H" | "HT" | "2H" | "ET" | "BT" | "P"
  | "SUSP" | "INT" | "FT" | "AET" | "PEN"
  | "PST" | "CANC" | "ABD" | "AWD" | "WO";

export type EventType =
  | "Goal" | "Own Goal" | "Yellow Card" | "Red Card"
  | "Yellow Red Card" | "Substitution" | "VAR"
  | "Penalty Missed" | "Penalty Goal";

export type Position = "G" | "D" | "M" | "F";

export interface NormalizedTeam {
  id: string; provider: string; providerId: string | number;
  name: string; shortName: string; code: string;
  country: string; countryCode: string; logoUrl: string | null;
  venueId?: string; founded?: number;
}

export interface NormalizedVenue {
  id: string; name: string; city: string; country: string;
  capacity: number | null; surface: string | null; imageUrl: string | null;
}

export interface NormalizedPlayer {
  id: string; provider: string; providerId: string | number;
  name: string; firstName: string; lastName: string;
  nationality: string; dateOfBirth: string | null;
  position: Position | null; number: number | null;
  photoUrl: string | null; height: string | null;
  weight: string | null; teamId: string | null;
}

export interface NormalizedMatchEvent {
  id: string; matchId: string; type: EventType;
  minute: number; extraMinute: number | null;
  teamId: string; teamSide: "home" | "away";
  playerId: string | null; playerName: string | null;
  assistPlayerId: string | null; assistPlayerName: string | null;
  detail: string | null; comments: string | null;
}

export interface NormalizedMatchStats {
  matchId: string; teamId: string; side: "home" | "away";
  shotsOnGoal: number | null; shotsOffGoal: number | null;
  totalShots: number | null; blockedShots: number | null;
  shotsInsidePenaltyArea: number | null; shotsOutsidePenaltyArea: number | null;
  fouls: number | null; cornerKicks: number | null; offsides: number | null;
  ballPossession: number | null; yellowCards: number | null; redCards: number | null;
  goalkeeperSaves: number | null; totalPasses: number | null;
  passesAccurate: number | null; passAccuracy: number | null; expectedGoals: number | null;
}

export interface LineupPlayer {
  playerId: string | null; name: string; number: number | null;
  position: Position | null; grid: string | null;
  isCaptain: boolean; isSubstituted: boolean; rating: number | null;
}

export interface NormalizedLineup {
  matchId: string; teamId: string; side: "home" | "away";
  formation: string | null; coach: string | null;
  startingXI: LineupPlayer[]; substitutes: LineupPlayer[];
}

export interface NormalizedMatch {
  id: string; provider: string; providerId: string | number;
  competitionId: string; season: string;
  round: string | null;
  roundType: "group" | "round_of_32" | "round_of_16" | "quarter_final" | "semi_final" | "final" | "other";
  group: string | null;
  homeTeam: NormalizedTeam; awayTeam: NormalizedTeam;
  homeScore: number | null; awayScore: number | null;
  homeScoreHT: number | null; awayScoreHT: number | null;
  homeScoreET: number | null; awayScoreET: number | null;
  homePenalties: number | null; awayPenalties: number | null;
  status: MatchStatus; minute: number | null; injuryTime: number | null;
  venue: NormalizedVenue | null; referee: string | null;
  startTime: string; timezone: string;
  events: NormalizedMatchEvent[];
  stats: NormalizedMatchStats[] | null;
  lineups: NormalizedLineup[] | null;
  updatedAt: string;
}

export interface StandingEntry {
  rank: number; team: NormalizedTeam;
  played: number; win: number; draw: number; lose: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number; points: number;
  form: string | null; status: "same" | "up" | "down" | null; description: string | null;
}

export interface NormalizedStanding {
  competitionId: string; season: string; group: string | null;
  entries: StandingEntry[];
}

export interface NormalizedCompetition {
  id: string; provider: string; providerId: string | number;
  name: string; type: "Cup" | "League" | "Super Cup" | "Friendly" | "Qualification";
  country: string | null; countryCode: string | null; logoUrl: string | null;
  season: string; currentRound: string | null; startDate: string | null; endDate: string | null;
}

export interface StreamSource {
  id: string; matchId: string; broadcaster: string; broadcasterId: string;
  title: string; url: string; embedUrl: string | null;
  streamType: "live" | "replay" | "highlight";
  quality: "SD" | "HD" | "FHD" | "4K"; language: string; region: string[];
  isOfficial: boolean; isGeoRestricted: boolean;
  requiresAuth: boolean; requiresSubscription: boolean;
  isFree: boolean; isAvailable: boolean;
  availableFrom: string | null; availableUntil: string | null;
  lastVerified: string; thumbnailUrl: string | null;
  platform: "youtube" | "twitch" | "facebook" | "web" | "app";
}

export interface NewsArticle {
  id: string; headline: string; summary: string; body: string | null;
  source: string; sourceName: string; sourceLogoUrl: string | null;
  author: string | null; imageUrl: string | null; url: string;
  publishedAt: string; tags: string[];
  competitionId: string | null; teamIds: string[]; playerIds: string[];
  matchId: string | null; language: string;
  aiSummary?: string;
}

export interface Highlight {
  id: string;
  matchId: string | null;
  title: string;
  competition: string;
  year: number;
  thumbnail: string | null;
  duration: string | null;
  source: string;
  provider: string;
  videoUrl: string | null;
  embedUrl: string | null;
  publishedAt: string;
  verified: boolean;
}

export interface Commentary {
  id: string; matchId: string; minute: number | null; extraMinute: number | null;
  text: string; isHighlight: boolean; eventId: string | null;
  eventType: EventType | null; source: "provider" | "ai_generated"; createdAt: string;
}

export interface MatchPrediction {
  matchId: string; source: "user" | "ai"; userId: string | null;
  homeWinProbability: number; drawProbability: number; awayWinProbability: number;
  predictedHomeScore: number | null; predictedAwayScore: number | null;
  confidence: number; reasoning: string | null; createdAt: string;
}

export interface ProviderResult<T> {
  data: T | null; provider: string; cached: boolean;
  fetchedAt: string; error: string | null;
}

export interface ProviderHealth {
  provider: string; isHealthy: boolean; latencyMs: number | null;
  lastSuccess: string | null; lastError: string | null;
  requestsToday: number; quotaLimit: number | null; quotaRemaining: number | null;
}
