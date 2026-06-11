import { EspnProvider } from "@/lib/providers/espn";
import type { WCFixture } from "./data";
import { WC_TEAMS } from "./data";

/** Overlay WC_TEAMS names + flag emoji onto any NormalizedMatch from any WC source. */
export function enrichWCMatch(match: any): any {
  if (match.competitionId !== "fifa-world-cup-2026") return match;
  const homeCode = match.homeTeam?.code?.toUpperCase();
  const awayCode = match.awayTeam?.code?.toUpperCase();
  const homeWC = homeCode ? WC_TEAMS[homeCode] : null;
  const awayWC = awayCode ? WC_TEAMS[awayCode] : null;
  return {
    ...match,
    homeTeam: homeWC
      ? { ...match.homeTeam, name: homeWC.name, shortName: homeWC.shortName, flag: homeWC.flag }
      : match.homeTeam,
    awayTeam: awayWC
      ? { ...match.awayTeam, name: awayWC.name, shortName: awayWC.shortName, flag: awayWC.flag }
      : match.awayTeam,
  };
}

const espn = new EspnProvider();

// Maps ESPN round text → WCFixture stage values
function deriveStage(roundType: string, roundText: string | null): WCFixture["stage"] {
  if (roundType === "group") return "group";
  const t = (roundText ?? "").toLowerCase();
  if (t.includes("final") && t.includes("semi")) return "semi_final";
  if (t.includes("quarter")) return "quarter_final";
  if (t.includes("round of 16") || t.includes("last 16")) return "round_of_16";
  if (t.includes("round of 32") || t.includes("last 32")) return "round_of_32";
  if (t.includes("final")) return "final";
  return "group";
}

// Coerce venue country string to the WCFixture union
function deriveCountry(country: string): "USA" | "CAN" | "MEX" {
  const c = country.toUpperCase();
  if (c.includes("CANADA") || c === "CAN") return "CAN";
  if (c.includes("MEXICO") || c === "MEX") return "MEX";
  return "USA";
}

export async function fetchWCFixturesFromESPN(dateStr: string): Promise<WCFixture[]> {
  try {
    const result = await espn.getMatchesByDate(dateStr, ["fifa-world-cup-2026"]);
    if (!result.data?.length) return [];

    return result.data.map((match): WCFixture => {
      // Prefer WC_TEAMS code if it exists (guarantees flag/shortName lookup works)
      const homeCode = match.homeTeam.code?.toUpperCase() ?? "";
      const awayCode = match.awayTeam.code?.toUpperCase() ?? "";

      // Extract group letter from "Group A" → "A"
      const groupLetter = match.group
        ? match.group.replace(/^group\s+/i, "").trim()
        : null;

      return {
        id: String(match.providerId),
        group: groupLetter,
        stage: deriveStage(match.roundType ?? "group", match.round),
        homeTeamCode: WC_TEAMS[homeCode] ? homeCode : homeCode,
        awayTeamCode: WC_TEAMS[awayCode] ? awayCode : awayCode,
        kickoffUtc: match.startTime,
        venue: match.venue?.name ?? "",
        city: match.venue?.city ?? "",
        country: deriveCountry(match.venue?.country ?? "USA"),
      };
    });
  } catch {
    return [];
  }
}
