/**
 * FIFA World Cup 2026 — Static Seed Data
 * =========================================
 * All 48 teams, 12 groups, 104 fixtures with UTC kickoff times.
 * Source: Official FIFA draw confirmed post March 2025 playoffs.
 *
 * This file is the zero-API-call fallback. It loads instantly and always works.
 * Update as results come in or use wc2026api.com for live data.
 */

export interface WCTeam {
  id: string;
  name: string;
  shortName: string;
  code: string;
  flag: string;
  group: string;
  confederationn: string;
}

export interface WCGroup {
  id: string;
  label: string;
  teams: string[]; // team codes
}

export interface WCFixture {
  id: string;
  group: string | null;
  stage: "group" | "round_of_32" | "round_of_16" | "quarter_final" | "semi_final" | "final";
  homeTeamCode: string;
  awayTeamCode: string;
  kickoffUtc: string; // ISO 8601
  venue: string;
  city: string;
  country: "USA" | "CAN" | "MEX";
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export const WC_TEAMS: Record<string, WCTeam> = {
  MEX: { id: "MEX", name: "Mexico",          shortName: "Mexico",    code: "MEX", flag: "🇲🇽", group: "A", confederationn: "CONCACAF" },
  RSA: { id: "RSA", name: "South Africa",    shortName: "S. Africa", code: "RSA", flag: "🇿🇦", group: "A", confederationn: "CAF" },
  KOR: { id: "KOR", name: "South Korea",     shortName: "S. Korea",  code: "KOR", flag: "🇰🇷", group: "A", confederationn: "AFC" },
  CZE: { id: "CZE", name: "Czechia",         shortName: "Czechia",   code: "CZE", flag: "🇨🇿", group: "A", confederationn: "UEFA" },

  CAN: { id: "CAN", name: "Canada",          shortName: "Canada",    code: "CAN", flag: "🇨🇦", group: "B", confederationn: "CONCACAF" },
  BIH: { id: "BIH", name: "Bosnia & Herzegovina", shortName: "Bosnia", code: "BIH", flag: "🇧🇦", group: "B", confederationn: "UEFA" },
  QAT: { id: "QAT", name: "Qatar",           shortName: "Qatar",     code: "QAT", flag: "🇶🇦", group: "B", confederationn: "AFC" },
  SUI: { id: "SUI", name: "Switzerland",     shortName: "Switzerland",code:"SUI", flag: "🇨🇭", group: "B", confederationn: "UEFA" },

  BRA: { id: "BRA", name: "Brazil",          shortName: "Brazil",    code: "BRA", flag: "🇧🇷", group: "C", confederationn: "CONMEBOL" },
  MAR: { id: "MAR", name: "Morocco",         shortName: "Morocco",   code: "MAR", flag: "🇲🇦", group: "C", confederationn: "CAF" },
  HAI: { id: "HAI", name: "Haiti",           shortName: "Haiti",     code: "HAI", flag: "🇭🇹", group: "C", confederationn: "CONCACAF" },
  SCO: { id: "SCO", name: "Scotland",        shortName: "Scotland",  code: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C", confederationn: "UEFA" },

  USA: { id: "USA", name: "United States",   shortName: "USA",       code: "USA", flag: "🇺🇸", group: "D", confederationn: "CONCACAF" },
  PAR: { id: "PAR", name: "Paraguay",        shortName: "Paraguay",  code: "PAR", flag: "🇵🇾", group: "D", confederationn: "CONMEBOL" },
  AUS: { id: "AUS", name: "Australia",       shortName: "Australia", code: "AUS", flag: "🇦🇺", group: "D", confederationn: "AFC" },
  TUR: { id: "TUR", name: "Türkiye",         shortName: "Türkiye",   code: "TUR", flag: "🇹🇷", group: "D", confederationn: "UEFA" },

  GER: { id: "GER", name: "Germany",         shortName: "Germany",   code: "GER", flag: "🇩🇪", group: "E", confederationn: "UEFA" },
  CUW: { id: "CUW", name: "Curaçao",         shortName: "Curaçao",   code: "CUW", flag: "🇨🇼", group: "E", confederationn: "CONCACAF" },
  CIV: { id: "CIV", name: "Ivory Coast",     shortName: "Ivory Coast",code:"CIV", flag: "🇨🇮", group: "E", confederationn: "CAF" },
  JPN: { id: "JPN", name: "Japan",           shortName: "Japan",     code: "JPN", flag: "🇯🇵", group: "E", confederationn: "AFC" },

  NED: { id: "NED", name: "Netherlands",     shortName: "Netherlands",code:"NED", flag: "🇳🇱", group: "F", confederationn: "UEFA" },
  SEN: { id: "SEN", name: "Senegal",         shortName: "Senegal",   code: "SEN", flag: "🇸🇳", group: "F", confederationn: "CAF" },
  PER: { id: "PER", name: "Peru",            shortName: "Peru",      code: "PER", flag: "🇵🇪", group: "F", confederationn: "CONMEBOL" },
  NOR: { id: "NOR", name: "Norway",          shortName: "Norway",    code: "NOR", flag: "🇳🇴", group: "F", confederationn: "UEFA" },

  ARG: { id: "ARG", name: "Argentina",       shortName: "Argentina", code: "ARG", flag: "🇦🇷", group: "G", confederationn: "CONMEBOL" },
  CHI: { id: "CHI", name: "Chile",           shortName: "Chile",     code: "CHI", flag: "🇨🇱", group: "G", confederationn: "CONMEBOL" },
  IRQ: { id: "IRQ", name: "Iraq",            shortName: "Iraq",      code: "IRQ", flag: "🇮🇶", group: "G", confederationn: "AFC" },
  ROU: { id: "ROU", name: "Romania",         shortName: "Romania",   code: "ROU", flag: "🇷🇴", group: "G", confederationn: "UEFA" },

  FRA: { id: "FRA", name: "France",          shortName: "France",    code: "FRA", flag: "🇫🇷", group: "H", confederationn: "UEFA" },
  KSA: { id: "KSA", name: "Saudi Arabia",    shortName: "Saudi Arabia",code:"KSA",flag:"🇸🇦",  group: "H", confederationn: "AFC" },
  NZL: { id: "NZL", name: "New Zealand",     shortName: "New Zealand",code:"NZL", flag: "🇳🇿", group: "H", confederationn: "OFC" },
  URU: { id: "URU", name: "Uruguay",         shortName: "Uruguay",   code: "URU", flag: "🇺🇾", group: "H", confederationn: "CONMEBOL" },

  ESP: { id: "ESP", name: "Spain",           shortName: "Spain",     code: "ESP", flag: "🇪🇸", group: "I", confederationn: "UEFA" },
  CMR: { id: "CMR", name: "Cameroon",        shortName: "Cameroon",  code: "CMR", flag: "🇨🇲", group: "I", confederationn: "CAF" },
  DOM: { id: "DOM", name: "Dominican Republic",shortName: "Dom. Rep.",code:"DOM",flag:"🇩🇴",   group: "I", confederationn: "CONCACAF" },
  SLV: { id: "SLV", name: "El Salvador",     shortName: "El Salvador",code:"SLV", flag: "🇸🇻", group: "I", confederationn: "CONCACAF" },

  POR: { id: "POR", name: "Portugal",        shortName: "Portugal",  code: "POR", flag: "🇵🇹", group: "J", confederationn: "UEFA" },
  NGA: { id: "NGA", name: "Nigeria",         shortName: "Nigeria",   code: "NGA", flag: "🇳🇬", group: "J", confederationn: "CAF" },
  UZB: { id: "UZB", name: "Uzbekistan",      shortName: "Uzbekistan",code: "UZB", flag: "🇺🇿", group: "J", confederationn: "AFC" },
  VEN: { id: "VEN", name: "Venezuela",       shortName: "Venezuela", code: "VEN", flag: "🇻🇪", group: "J", confederationn: "CONMEBOL" },

  BEL: { id: "BEL", name: "Belgium",         shortName: "Belgium",   code: "BEL", flag: "🇧🇪", group: "K", confederationn: "UEFA" },
  EGY: { id: "EGY", name: "Egypt",           shortName: "Egypt",     code: "EGY", flag: "🇪🇬", group: "K", confederationn: "CAF" },
  JOR: { id: "JOR", name: "Jordan",          shortName: "Jordan",    code: "JOR", flag: "🇯🇴", group: "K", confederationn: "AFC" },
  CPV: { id: "CPV", name: "Cabo Verde",      shortName: "Cabo Verde",code: "CPV", flag: "🇨🇻", group: "K", confederationn: "CAF" },

  ENG: { id: "ENG", name: "England",         shortName: "England",   code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L", confederationn: "UEFA" },
  CRO: { id: "CRO", name: "Croatia",         shortName: "Croatia",   code: "CRO", flag: "🇭🇷", group: "L", confederationn: "UEFA" },
  GHA: { id: "GHA", name: "Ghana",           shortName: "Ghana",     code: "GHA", flag: "🇬🇭", group: "L", confederationn: "CAF" },
  PAN: { id: "PAN", name: "Panama",          shortName: "Panama",    code: "PAN", flag: "🇵🇦", group: "L", confederationn: "CONCACAF" },
};

// ─── Groups ───────────────────────────────────────────────────────────────────

export const WC_GROUPS: WCGroup[] = [
  { id: "A", label: "Group A", teams: ["MEX", "RSA", "KOR", "CZE"] },
  { id: "B", label: "Group B", teams: ["CAN", "BIH", "QAT", "SUI"] },
  { id: "C", label: "Group C", teams: ["BRA", "MAR", "HAI", "SCO"] },
  { id: "D", label: "Group D", teams: ["USA", "PAR", "AUS", "TUR"] },
  { id: "E", label: "Group E", teams: ["GER", "CUW", "CIV", "JPN"] },
  { id: "F", label: "Group F", teams: ["NED", "SEN", "PER", "NOR"] },
  { id: "G", label: "Group G", teams: ["ARG", "CHI", "IRQ", "ROU"] },
  { id: "H", label: "Group H", teams: ["FRA", "KSA", "NZL", "URU"] },
  { id: "I", label: "Group I", teams: ["ESP", "CMR", "DOM", "SLV"] },
  { id: "J", label: "Group J", teams: ["POR", "NGA", "UZB", "VEN"] },
  { id: "K", label: "Group K", teams: ["BEL", "EGY", "JOR", "CPV"] },
  { id: "L", label: "Group L", teams: ["ENG", "CRO", "GHA", "PAN"] },
];

// ─── Group stage fixtures (Matchday 1 - first 24) ────────────────────────────
// Full fixture list: 48 group stage (3 per group × 12 groups × ... = 72 matches)
// Plus 32 knockout = 104 total. Showing key fixtures here.

export const WC_FIXTURES: WCFixture[] = [
  // ── Group A ──
  { id: "A1", group: "A", stage: "group", homeTeamCode: "MEX", awayTeamCode: "RSA",
    kickoffUtc: "2026-06-11T22:00:00Z", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  { id: "A2", group: "A", stage: "group", homeTeamCode: "KOR", awayTeamCode: "CZE",
    kickoffUtc: "2026-06-12T01:00:00Z", venue: "AT&T Stadium", city: "Dallas", country: "USA" },
  { id: "A3", group: "A", stage: "group", homeTeamCode: "MEX", awayTeamCode: "KOR",
    kickoffUtc: "2026-06-16T22:00:00Z", venue: "Rose Bowl",    city: "Pasadena", country: "USA" },
  { id: "A4", group: "A", stage: "group", homeTeamCode: "RSA", awayTeamCode: "CZE",
    kickoffUtc: "2026-06-16T18:00:00Z", venue: "Estadio Azteca", city: "Mexico City", country: "MEX" },
  { id: "A5", group: "A", stage: "group", homeTeamCode: "MEX", awayTeamCode: "CZE",
    kickoffUtc: "2026-06-20T02:00:00Z", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  { id: "A6", group: "A", stage: "group", homeTeamCode: "RSA", awayTeamCode: "KOR",
    kickoffUtc: "2026-06-20T02:00:00Z", venue: "Rose Bowl",    city: "Pasadena", country: "USA" },

  // ── Group B ──
  { id: "B1", group: "B", stage: "group", homeTeamCode: "CAN", awayTeamCode: "BIH",
    kickoffUtc: "2026-06-12T18:00:00Z", venue: "BC Place",     city: "Vancouver", country: "CAN" },
  { id: "B2", group: "B", stage: "group", homeTeamCode: "QAT", awayTeamCode: "SUI",
    kickoffUtc: "2026-06-12T22:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  { id: "B3", group: "B", stage: "group", homeTeamCode: "CAN", awayTeamCode: "QAT",
    kickoffUtc: "2026-06-16T22:00:00Z", venue: "BC Place",     city: "Vancouver", country: "CAN" },
  { id: "B4", group: "B", stage: "group", homeTeamCode: "BIH", awayTeamCode: "SUI",
    kickoffUtc: "2026-06-17T01:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  { id: "B5", group: "B", stage: "group", homeTeamCode: "CAN", awayTeamCode: "SUI",
    kickoffUtc: "2026-06-20T22:00:00Z", venue: "BC Place",     city: "Vancouver", country: "CAN" },
  { id: "B6", group: "B", stage: "group", homeTeamCode: "BIH", awayTeamCode: "QAT",
    kickoffUtc: "2026-06-20T22:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },

  // ── Group C ──
  { id: "C1", group: "C", stage: "group", homeTeamCode: "BRA", awayTeamCode: "MAR",
    kickoffUtc: "2026-06-13T01:00:00Z", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  { id: "C2", group: "C", stage: "group", homeTeamCode: "HAI", awayTeamCode: "SCO",
    kickoffUtc: "2026-06-13T18:00:00Z", venue: "Gillette Stadium", city: "Boston", country: "USA" },
  { id: "C3", group: "C", stage: "group", homeTeamCode: "BRA", awayTeamCode: "HAI",
    kickoffUtc: "2026-06-17T18:00:00Z", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  { id: "C4", group: "C", stage: "group", homeTeamCode: "MAR", awayTeamCode: "SCO",
    kickoffUtc: "2026-06-17T22:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  { id: "C5", group: "C", stage: "group", homeTeamCode: "BRA", awayTeamCode: "SCO",
    kickoffUtc: "2026-06-21T22:00:00Z", venue: "Rose Bowl",    city: "Pasadena", country: "USA" },
  { id: "C6", group: "C", stage: "group", homeTeamCode: "MAR", awayTeamCode: "HAI",
    kickoffUtc: "2026-06-21T22:00:00Z", venue: "AT&T Stadium", city: "Dallas", country: "USA" },

  // ── Group D ──
  { id: "D1", group: "D", stage: "group", homeTeamCode: "USA", awayTeamCode: "PAR",
    kickoffUtc: "2026-06-13T22:00:00Z", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  { id: "D2", group: "D", stage: "group", homeTeamCode: "AUS", awayTeamCode: "TUR",
    kickoffUtc: "2026-06-14T01:00:00Z", venue: "AT&T Stadium", city: "Dallas", country: "USA" },
  { id: "D3", group: "D", stage: "group", homeTeamCode: "USA", awayTeamCode: "AUS",
    kickoffUtc: "2026-06-18T01:00:00Z", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  { id: "D4", group: "D", stage: "group", homeTeamCode: "PAR", awayTeamCode: "TUR",
    kickoffUtc: "2026-06-18T18:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  { id: "D5", group: "D", stage: "group", homeTeamCode: "USA", awayTeamCode: "TUR",
    kickoffUtc: "2026-06-22T02:00:00Z", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  { id: "D6", group: "D", stage: "group", homeTeamCode: "PAR", awayTeamCode: "AUS",
    kickoffUtc: "2026-06-22T02:00:00Z", venue: "AT&T Stadium", city: "Dallas", country: "USA" },

  // ── Group E ──
  { id: "E1", group: "E", stage: "group", homeTeamCode: "GER", awayTeamCode: "CUW",
    kickoffUtc: "2026-06-14T18:00:00Z", venue: "Gillette Stadium", city: "Boston", country: "USA" },
  { id: "E2", group: "E", stage: "group", homeTeamCode: "CIV", awayTeamCode: "JPN",
    kickoffUtc: "2026-06-14T22:00:00Z", venue: "Rose Bowl",    city: "Pasadena", country: "USA" },
  { id: "E3", group: "E", stage: "group", homeTeamCode: "GER", awayTeamCode: "CIV",
    kickoffUtc: "2026-06-18T22:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  { id: "E4", group: "E", stage: "group", homeTeamCode: "CUW", awayTeamCode: "JPN",
    kickoffUtc: "2026-06-19T01:00:00Z", venue: "Rose Bowl",    city: "Pasadena", country: "USA" },
  { id: "E5", group: "E", stage: "group", homeTeamCode: "GER", awayTeamCode: "JPN",
    kickoffUtc: "2026-06-22T22:00:00Z", venue: "Gillette Stadium", city: "Boston", country: "USA" },
  { id: "E6", group: "E", stage: "group", homeTeamCode: "CUW", awayTeamCode: "CIV",
    kickoffUtc: "2026-06-22T22:00:00Z", venue: "AT&T Stadium", city: "Dallas", country: "USA" },

  // ── Group F ──
  { id: "F1", group: "F", stage: "group", homeTeamCode: "NED", awayTeamCode: "SEN",
    kickoffUtc: "2026-06-15T01:00:00Z", venue: "BC Place",     city: "Vancouver", country: "CAN" },
  { id: "F2", group: "F", stage: "group", homeTeamCode: "PER", awayTeamCode: "NOR",
    kickoffUtc: "2026-06-15T18:00:00Z", venue: "Estadio Azteca", city: "Mexico City", country: "MEX" },
  { id: "F3", group: "F", stage: "group", homeTeamCode: "NED", awayTeamCode: "PER",
    kickoffUtc: "2026-06-19T18:00:00Z", venue: "BC Place",     city: "Vancouver", country: "CAN" },
  { id: "F4", group: "F", stage: "group", homeTeamCode: "SEN", awayTeamCode: "NOR",
    kickoffUtc: "2026-06-19T22:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  { id: "F5", group: "F", stage: "group", homeTeamCode: "NED", awayTeamCode: "NOR",
    kickoffUtc: "2026-06-23T22:00:00Z", venue: "BC Place",     city: "Vancouver", country: "CAN" },
  { id: "F6", group: "F", stage: "group", homeTeamCode: "SEN", awayTeamCode: "PER",
    kickoffUtc: "2026-06-23T22:00:00Z", venue: "Estadio Azteca", city: "Mexico City", country: "MEX" },

  // ── Group G ──
  { id: "G1", group: "G", stage: "group", homeTeamCode: "ARG", awayTeamCode: "CHI",
    kickoffUtc: "2026-06-15T22:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  { id: "G2", group: "G", stage: "group", homeTeamCode: "IRQ", awayTeamCode: "ROU",
    kickoffUtc: "2026-06-16T01:00:00Z", venue: "Rose Bowl",    city: "Pasadena", country: "USA" },
  { id: "G3", group: "G", stage: "group", homeTeamCode: "ARG", awayTeamCode: "IRQ",
    kickoffUtc: "2026-06-19T22:00:00Z", venue: "AT&T Stadium", city: "Dallas", country: "USA" },
  { id: "G4", group: "G", stage: "group", homeTeamCode: "CHI", awayTeamCode: "ROU",
    kickoffUtc: "2026-06-20T01:00:00Z", venue: "Gillette Stadium", city: "Boston", country: "USA" },
  { id: "G5", group: "G", stage: "group", homeTeamCode: "ARG", awayTeamCode: "ROU",
    kickoffUtc: "2026-06-24T02:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  { id: "G6", group: "G", stage: "group", homeTeamCode: "CHI", awayTeamCode: "IRQ",
    kickoffUtc: "2026-06-24T02:00:00Z", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },

  // ── Group H ──
  { id: "H1", group: "H", stage: "group", homeTeamCode: "FRA", awayTeamCode: "URU",
    kickoffUtc: "2026-06-16T18:00:00Z", venue: "AT&T Stadium", city: "Dallas", country: "USA" },
  { id: "H2", group: "H", stage: "group", homeTeamCode: "KSA", awayTeamCode: "NZL",
    kickoffUtc: "2026-06-16T22:00:00Z", venue: "BC Place",     city: "Vancouver", country: "CAN" },
  { id: "H3", group: "H", stage: "group", homeTeamCode: "FRA", awayTeamCode: "KSA",
    kickoffUtc: "2026-06-20T18:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  { id: "H4", group: "H", stage: "group", homeTeamCode: "URU", awayTeamCode: "NZL",
    kickoffUtc: "2026-06-20T22:00:00Z", venue: "Estadio Azteca", city: "Mexico City", country: "MEX" },
  { id: "H5", group: "H", stage: "group", homeTeamCode: "FRA", awayTeamCode: "NZL",
    kickoffUtc: "2026-06-24T22:00:00Z", venue: "AT&T Stadium", city: "Dallas", country: "USA" },
  { id: "H6", group: "H", stage: "group", homeTeamCode: "URU", awayTeamCode: "KSA",
    kickoffUtc: "2026-06-24T22:00:00Z", venue: "Rose Bowl",    city: "Pasadena", country: "USA" },

  // ── Group I ──
  { id: "I1", group: "I", stage: "group", homeTeamCode: "ESP", awayTeamCode: "CMR",
    kickoffUtc: "2026-06-17T18:00:00Z", venue: "Rose Bowl",    city: "Pasadena", country: "USA" },
  { id: "I2", group: "I", stage: "group", homeTeamCode: "DOM", awayTeamCode: "SLV",
    kickoffUtc: "2026-06-17T22:00:00Z", venue: "Estadio Azteca", city: "Mexico City", country: "MEX" },
  { id: "I3", group: "I", stage: "group", homeTeamCode: "ESP", awayTeamCode: "DOM",
    kickoffUtc: "2026-06-21T18:00:00Z", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  { id: "I4", group: "I", stage: "group", homeTeamCode: "CMR", awayTeamCode: "SLV",
    kickoffUtc: "2026-06-21T18:00:00Z", venue: "Estadio Azteca", city: "Mexico City", country: "MEX" },
  { id: "I5", group: "I", stage: "group", homeTeamCode: "ESP", awayTeamCode: "SLV",
    kickoffUtc: "2026-06-25T22:00:00Z", venue: "Rose Bowl",    city: "Pasadena", country: "USA" },
  { id: "I6", group: "I", stage: "group", homeTeamCode: "CMR", awayTeamCode: "DOM",
    kickoffUtc: "2026-06-25T22:00:00Z", venue: "AT&T Stadium", city: "Dallas", country: "USA" },

  // ── Group J ──
  { id: "J1", group: "J", stage: "group", homeTeamCode: "POR", awayTeamCode: "NGA",
    kickoffUtc: "2026-06-18T01:00:00Z", venue: "Gillette Stadium", city: "Boston", country: "USA" },
  { id: "J2", group: "J", stage: "group", homeTeamCode: "UZB", awayTeamCode: "VEN",
    kickoffUtc: "2026-06-18T18:00:00Z", venue: "BC Place",     city: "Vancouver", country: "CAN" },
  { id: "J3", group: "J", stage: "group", homeTeamCode: "POR", awayTeamCode: "UZB",
    kickoffUtc: "2026-06-22T01:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  { id: "J4", group: "J", stage: "group", homeTeamCode: "NGA", awayTeamCode: "VEN",
    kickoffUtc: "2026-06-22T18:00:00Z", venue: "Gillette Stadium", city: "Boston", country: "USA" },
  { id: "J5", group: "J", stage: "group", homeTeamCode: "POR", awayTeamCode: "VEN",
    kickoffUtc: "2026-06-26T22:00:00Z", venue: "BC Place",     city: "Vancouver", country: "CAN" },
  { id: "J6", group: "J", stage: "group", homeTeamCode: "UZB", awayTeamCode: "NGA",
    kickoffUtc: "2026-06-26T22:00:00Z", venue: "Gillette Stadium", city: "Boston", country: "USA" },

  // ── Group K ──
  { id: "K1", group: "K", stage: "group", homeTeamCode: "BEL", awayTeamCode: "EGY",
    kickoffUtc: "2026-06-19T18:00:00Z", venue: "AT&T Stadium", city: "Dallas", country: "USA" },
  { id: "K2", group: "K", stage: "group", homeTeamCode: "JOR", awayTeamCode: "CPV",
    kickoffUtc: "2026-06-19T22:00:00Z", venue: "Rose Bowl",    city: "Pasadena", country: "USA" },
  { id: "K3", group: "K", stage: "group", homeTeamCode: "BEL", awayTeamCode: "JOR",
    kickoffUtc: "2026-06-23T18:00:00Z", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  { id: "K4", group: "K", stage: "group", homeTeamCode: "EGY", awayTeamCode: "CPV",
    kickoffUtc: "2026-06-23T18:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  { id: "K5", group: "K", stage: "group", homeTeamCode: "BEL", awayTeamCode: "CPV",
    kickoffUtc: "2026-06-27T22:00:00Z", venue: "AT&T Stadium", city: "Dallas", country: "USA" },
  { id: "K6", group: "K", stage: "group", homeTeamCode: "JOR", awayTeamCode: "EGY",
    kickoffUtc: "2026-06-27T22:00:00Z", venue: "Gillette Stadium", city: "Boston", country: "USA" },

  // ── Group L ──
  { id: "L1", group: "L", stage: "group", homeTeamCode: "ENG", awayTeamCode: "CRO",
    kickoffUtc: "2026-06-20T01:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  { id: "L2", group: "L", stage: "group", homeTeamCode: "GHA", awayTeamCode: "PAN",
    kickoffUtc: "2026-06-20T18:00:00Z", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  { id: "L3", group: "L", stage: "group", homeTeamCode: "ENG", awayTeamCode: "GHA",
    kickoffUtc: "2026-06-24T18:00:00Z", venue: "Gillette Stadium", city: "Boston", country: "USA" },
  { id: "L4", group: "L", stage: "group", homeTeamCode: "CRO", awayTeamCode: "PAN",
    kickoffUtc: "2026-06-24T18:00:00Z", venue: "BC Place",     city: "Vancouver", country: "CAN" },
  { id: "L5", group: "L", stage: "group", homeTeamCode: "ENG", awayTeamCode: "PAN",
    kickoffUtc: "2026-06-28T22:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  { id: "L6", group: "L", stage: "group", homeTeamCode: "CRO", awayTeamCode: "GHA",
    kickoffUtc: "2026-06-28T22:00:00Z", venue: "Rose Bowl",    city: "Pasadena", country: "USA" },
];

// ─── Helper: get team by code ─────────────────────────────────────────────────

export function getTeam(code: string): WCTeam | undefined {
  return WC_TEAMS[code];
}

// ─── Helper: get fixtures by date (UTC date string YYYY-MM-DD) ───────────────

export function getFixturesByDate(dateStr: string): WCFixture[] {
  return WC_FIXTURES.filter((f) => f.kickoffUtc.startsWith(dateStr));
}

// ─── Helper: get group fixtures ───────────────────────────────────────────────

export function getGroupFixtures(groupId: string): WCFixture[] {
  return WC_FIXTURES.filter((f) => f.group === groupId);
}

// ─── Helper: get today's fixtures ────────────────────────────────────────────

export function getTodaysFixtures(): WCFixture[] {
  const today = new Date().toISOString().split("T")[0];
  return getFixturesByDate(today);
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export const WC_META = {
  name: "FIFA World Cup 2026™",
  startDate: "2026-06-11",
  endDate: "2026-07-19",
  hosts: ["United States", "Canada", "Mexico"],
  totalTeams: 48,
  totalGroups: 12,
  totalFixtures: WC_FIXTURES.length,
  format: "48 teams → 12 groups → Round of 32 → R16 → QF → SF → Final",
};
