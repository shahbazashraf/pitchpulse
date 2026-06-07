"""
PitchPulse FotMob Scraper
==========================
Uses FotMob's undocumented-but-public JSON API as a fallback
when API-Football and WC2026API quotas are exhausted.

No API key required. Rate limit: ~60 req/min.
Returns JSON — no HTML parsing needed.

Usage:
    python3 services/python/scraper/fotmob.py
    python3 services/python/scraper/fotmob.py --date 2026-06-15
    python3 services/python/scraper/fotmob.py --match-id 4198765
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Optional

import aiohttp

from pathlib import Path
from dotenv import load_dotenv

dotenv_path = Path(__file__).resolve().parents[3] / ".env.local"
load_dotenv(dotenv_path)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("fotmob")

BASE = "https://api.fotmob.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; PitchPulse/1.0)",
    "Accept": "application/json",
    "Referer": "https://www.fotmob.com/",
}
TIMEOUT = aiohttp.ClientTimeout(total=15)

# FotMob League IDs
LEAGUE_IDS = {
    "fifa-world-cup-2026": 73,
    "premier-league": 47,
    "champions-league": 42,
    "la-liga": 87,
    "bundesliga": 54,
    "serie-a": 55,
    "ligue-1": 53,
}

# ─── Normalised types (mirrors src/types/index.ts) ────────────────────────────

def normalise_status(fotmob_status: str) -> str:
    """Map FotMob status strings to our internal MatchStatus codes."""
    mapping = {
        "notstarted": "NS",
        "live":       "1H",
        "halftime":   "HT",
        "finished":   "FT",
        "postponed":  "PST",
        "cancelled":  "CANC",
        "abandoned":  "ABD",
    }
    return mapping.get(fotmob_status.lower(), "NS")


def normalise_match(raw: dict) -> dict:
    """Convert a FotMob match object to our NormalizedMatch shape."""
    status_obj  = raw.get("status", {})
    home        = raw.get("home", {})
    away        = raw.get("away", {})
    score_str   = raw.get("score", "")

    # Parse "2 - 1" → (2, 1)
    home_score = away_score = None
    if score_str and " - " in score_str:
        parts = score_str.split(" - ")
        try:
            home_score = int(parts[0].strip())
            away_score = int(parts[1].strip())
        except (ValueError, IndexError):
            pass

    return {
        "id":            f"fotmob:{raw.get('id')}",
        "provider":      "fotmob",
        "providerId":    raw.get("id"),
        "competitionId": f"fotmob:{raw.get('leagueId')}",
        "season":        str(raw.get("season", "")),
        "round":         raw.get("round"),
        "roundType":     "other",
        "group":         raw.get("group"),
        "homeTeam": {
            "id":        f"fotmob:{home.get('id')}",
            "name":      home.get("name", ""),
            "shortName": home.get("shortName") or home.get("name", ""),
            "code":      home.get("shortName", "")[:3].upper(),
            "logoUrl":   home.get("imageUrl"),
        },
        "awayTeam": {
            "id":        f"fotmob:{away.get('id')}",
            "name":      away.get("name", ""),
            "shortName": away.get("shortName") or away.get("name", ""),
            "code":      away.get("shortName", "")[:3].upper(),
            "logoUrl":   away.get("imageUrl"),
        },
        "homeScore":     home_score,
        "awayScore":     away_score,
        "homeScoreHT":   None,
        "awayScoreHT":   None,
        "status":        normalise_status(status_obj.get("started", False) and
                                          not status_obj.get("finished", False)
                                          and "live" or
                                          ("finished" if status_obj.get("finished") else "notstarted")),
        "minute":        status_obj.get("liveTime", {}).get("short"),
        "injuryTime":    None,
        "venue":         {
            "name": raw.get("venue", {}).get("name", ""),
            "city": raw.get("venue", {}).get("city", ""),
        } if raw.get("venue") else None,
        "startTime":     raw.get("status", {}).get("utcTime", ""),
        "timezone":      "UTC",
        "events":        [],
        "stats":         None,
        "lineups":       None,
        "updatedAt":     datetime.now(timezone.utc).isoformat(),
    }


# ─── API calls ────────────────────────────────────────────────────────────────

async def get_live_matches(session: aiohttp.ClientSession) -> list[dict]:
    """Fetch all currently live matches across all tracked leagues."""
    url = f"{BASE}/worldfootball?timezone=UTC"
    try:
        async with session.get(url, headers=HEADERS) as resp:
            resp.raise_for_status()
            data = await resp.json()
            live_raw = data.get("liveMatches", [])
            logger.info("[FotMob] %d live matches found", len(live_raw))
            return [normalise_match(m) for m in live_raw]
    except Exception as e:
        logger.error("[FotMob] get_live_matches failed: %s", e)
        return []


async def get_matches_by_date(session: aiohttp.ClientSession, date: str) -> list[dict]:
    """
    Fetch all matches for a given date (YYYY-MM-DD).
    FotMob uses yyyymmdd format.
    """
    date_compact = date.replace("-", "")
    url = f"{BASE}/matches?date={date_compact}"
    try:
        async with session.get(url, headers=HEADERS) as resp:
            resp.raise_for_status()
            data = await resp.json()

            matches: list[dict] = []
            for league_block in data.get("leagues", []):
                for m in league_block.get("matches", []):
                    matches.append(normalise_match(m))

            logger.info("[FotMob] %d matches on %s", len(matches), date)
            return matches
    except Exception as e:
        logger.error("[FotMob] get_matches_by_date(%s) failed: %s", date, e)
        return []


async def get_match_details(session: aiohttp.ClientSession, match_id: int) -> Optional[dict]:
    """Fetch full match detail including events, stats, lineups."""
    url = f"{BASE}/matchDetails?matchId={match_id}"
    try:
        async with session.get(url, headers=HEADERS) as resp:
            resp.raise_for_status()
            data = await resp.json()

            # Extract events
            events_raw = data.get("content", {}).get("matchFacts", {}).get("events", {}).get("events", [])
            events = []
            for i, e in enumerate(events_raw):
                event_type = e.get("type", "")
                events.append({
                    "id":              f"fotmob:{match_id}:event:{i}",
                    "matchId":         f"fotmob:{match_id}",
                    "type":            _map_event_type(event_type),
                    "minute":          e.get("time", 0),
                    "extraMinute":     e.get("addedTime"),
                    "teamId":          f"fotmob:{e.get('teamId')}",
                    "teamSide":        "home" if e.get("isHome") else "away",
                    "playerName":      e.get("player", {}).get("name"),
                    "assistPlayerName":e.get("assistPlayer", {}).get("name"),
                    "detail":          e.get("subType"),
                    "comments":        None,
                })

            # Extract stats
            stats_raw = data.get("content", {}).get("stats", {}).get("Periods", {}).get("All", {}).get("stats", [])
            home_stats: dict[str, Any] = {}
            away_stats: dict[str, Any] = {}
            for stat_group in stats_raw:
                for stat in stat_group.get("stats", []):
                    key = stat.get("key", "")
                    vals = stat.get("stats", [])
                    if len(vals) >= 2:
                        home_stats[key] = vals[0]
                        away_stats[key] = vals[1]

            return {
                "matchId":  f"fotmob:{match_id}",
                "events":   events,
                "homeStats": home_stats,
                "awayStats": away_stats,
            }
    except Exception as e:
        logger.error("[FotMob] get_match_details(%d) failed: %s", match_id, e)
        return None


async def get_wc_standings(session: aiohttp.ClientSession) -> list[dict]:
    """Fetch World Cup group standings from FotMob (league ID 73)."""
    url = f"{BASE}/leagues?id=73&ccode=INT&timezone=UTC"
    try:
        async with session.get(url, headers=HEADERS) as resp:
            resp.raise_for_status()
            data = await resp.json()

            tables = data.get("table", [])
            standings: list[dict] = []

            for table in tables:
                group_name = table.get("name", "")
                rows = table.get("rows", [])
                entries = []
                for row in rows:
                    entries.append({
                        "rank":           row.get("idx", 0),
                        "team": {
                            "id":       f"fotmob:{row.get('id')}",
                            "name":     row.get("name", ""),
                            "shortName":row.get("shortName") or row.get("name", ""),
                            "logoUrl":  row.get("imageUrl"),
                        },
                        "played":         row.get("played", 0),
                        "win":            row.get("wins", 0),
                        "draw":           row.get("draws", 0),
                        "lose":           row.get("losses", 0),
                        "goalsFor":       row.get("scoresStr", "0:0").split(":")[0] if ":" in row.get("scoresStr", "") else 0,
                        "goalsAgainst":   row.get("scoresStr", "0:0").split(":")[1] if ":" in row.get("scoresStr", "") else 0,
                        "goalDifference": row.get("goalConDiff", 0),
                        "points":         row.get("pts", 0),
                        "form":           "".join(row.get("form", [])),
                    })

                standings.append({
                    "group":   group_name,
                    "entries": entries,
                })

            logger.info("[FotMob] %d groups in WC standings", len(standings))
            return standings
    except Exception as e:
        logger.error("[FotMob] get_wc_standings failed: %s", e)
        return []


# ─── Event type mapping ───────────────────────────────────────────────────────

def _map_event_type(fotmob_type: str) -> str:
    mapping = {
        "Goal":          "Goal",
        "OwnGoal":       "Own Goal",
        "PenaltyGoal":   "Penalty Goal",
        "PenaltyMissed": "Penalty Missed",
        "Card":          "Yellow Card",
        "YellowCard":    "Yellow Card",
        "RedCard":       "Red Card",
        "YellowRedCard": "Yellow Red Card",
        "Substitution":  "Substitution",
        "VAR":           "VAR",
    }
    return mapping.get(fotmob_type, fotmob_type)


# ─── Firestore writer ─────────────────────────────────────────────────────────

async def write_to_firestore(matches: list[dict]) -> None:
    """Write normalised matches to Firestore."""
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore as fs

        service_account = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
        if service_account.startswith("./"):
            service_account = str(Path(__file__).resolve().parents[3] / service_account[2:])

        if not firebase_admin._apps:
            cred = credentials.Certificate(service_account)
            firebase_admin.initialize_app(cred)

        db = fs.client()
        loop = asyncio.get_event_loop()
        batch = db.batch()

        for i, match in enumerate(matches):
            ref = db.collection("matches").doc(match["id"])
            batch.set(ref, {**match, "updatedAt": fs.SERVER_TIMESTAMP}, merge=True)

            if i > 0 and i % 450 == 0:
                await loop.run_in_executor(None, batch.commit)
                batch = db.batch()

        await loop.run_in_executor(None, batch.commit)
        logger.info("[FotMob] Wrote %d matches to Firestore", len(matches))
    except ImportError:
        # firebase-admin not installed — just print
        print(json.dumps(matches, indent=2, default=str))
    except Exception as e:
        logger.error("[FotMob] Firestore write failed: %s", e)


# ─── CLI entry point ──────────────────────────────────────────────────────────

async def main() -> None:
    parser = argparse.ArgumentParser(description="PitchPulse FotMob scraper")
    parser.add_argument("--date",     help="Fetch matches for YYYY-MM-DD")
    parser.add_argument("--match-id", type=int, help="Fetch single match detail")
    parser.add_argument("--live",     action="store_true", help="Fetch live matches")
    parser.add_argument("--wc-standings", action="store_true", help="Fetch WC group standings")
    parser.add_argument("--push",     action="store_true", help="Push results to Firestore")
    args = parser.parse_args()

    async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
        if args.match_id:
            detail = await get_match_details(session, args.match_id)
            print(json.dumps(detail, indent=2, default=str))

        elif args.wc_standings:
            standings = await get_wc_standings(session)
            print(json.dumps(standings, indent=2, default=str))

        elif args.date:
            matches = await get_matches_by_date(session, args.date)
            if args.push:
                await write_to_firestore(matches)
            else:
                print(json.dumps(matches, indent=2, default=str))

        elif args.live:
            matches = await get_live_matches(session)
            if args.push:
                await write_to_firestore(matches)
            else:
                print(json.dumps(matches, indent=2, default=str))

        else:
            # Default: today's matches
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            matches = await get_matches_by_date(session, today)
            if args.push:
                await write_to_firestore(matches)
            else:
                print(json.dumps(matches, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
