"""
PitchPulse Live Scores Ingestion Service
=========================================
Polls API-Football for live match data and syncs to Firestore.
Designed to run as a Cloud Function on a 30s schedule during live matches.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Optional

import aiohttp
from pydantic import BaseModel, field_validator

from pathlib import Path
from dotenv import load_dotenv

# Load .env.local from project root
dotenv_path = Path(__file__).resolve().parents[3] / '.env.local'
load_dotenv(dotenv_path)

import logging
logger = logging.getLogger("live_scores")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s - %(message)s")

# ─── Config ───────────────────────────────────────────────────────────────────

API_FOOTBALL_KEY = os.getenv("API_FOOTBALL_KEY", "")
API_FOOTBALL_BASE = "https://v3.football.api-sports.io"
FIREBASE_SERVICE_ACCOUNT = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
if FIREBASE_SERVICE_ACCOUNT.startswith("./"):
    FIREBASE_SERVICE_ACCOUNT = str(Path(__file__).resolve().parents[3] / FIREBASE_SERVICE_ACCOUNT[2:])

# Competition IDs to track (API-Football IDs)
TRACKED_COMPETITIONS = [
    1,    # FIFA World Cup
    2,    # UEFA Champions League
    39,   # Premier League
    140,  # La Liga
    78,   # Bundesliga
    135,  # Serie A
    61,   # Ligue 1
    253,  # MLS
]

# ─── API Client ───────────────────────────────────────────────────────────────

class APIFootballClient:
    BASE = API_FOOTBALL_BASE

    def __init__(self):
        self._session: Optional[aiohttp.ClientSession] = None
        self._calls_this_minute = 0
        self._window_start = time.monotonic()
        self.CALLS_PER_MINUTE = 450

    async def __aenter__(self):
        self._session = aiohttp.ClientSession(
            headers={
                "x-apisports-key": API_FOOTBALL_KEY,
                "Accept": "application/json",
            },
            timeout=aiohttp.ClientTimeout(total=15),
        )
        return self

    async def __aexit__(self, *_):
        if self._session:
            await self._session.close()

    async def _throttle(self):
        now = time.monotonic()
        if now - self._window_start > 60:
            self._window_start = now
            self._calls_this_minute = 0
        if self._calls_this_minute >= self.CALLS_PER_MINUTE:
            wait = 60 - (now - self._window_start)
            logger.info("Rate limit reached; sleeping %.1fs", wait)
            await asyncio.sleep(max(wait, 0))
            self._window_start = time.monotonic()
            self._calls_this_minute = 0
        self._calls_this_minute += 1

    async def get(self, endpoint: str, params: dict = None) -> dict:
        await self._throttle()
        url = f"{self.BASE}{endpoint}"
        for attempt in range(3):
            try:
                assert self._session
                async with self._session.get(url, params=params or {}) as resp:
                    if resp.status == 429:
                        await asyncio.sleep(60)
                        continue
                    resp.raise_for_status()
                    return await resp.json()
            except aiohttp.ClientError as e:
                if attempt == 2:
                    raise
                await asyncio.sleep(2 ** attempt)
        return {}

    async def get_live_fixtures(self, league_ids: Optional[list[int]] = None) -> list[dict]:
        params: dict[str, Any] = {"live": "all"}
        if league_ids:
            params["league"] = "-".join(str(i) for i in league_ids)
        data = await self.get("/fixtures", params)
        return data.get("response", [])

    async def get_fixture(self, fixture_id: int) -> Optional[dict]:
        data = await self.get("/fixtures", {"id": fixture_id})
        items = data.get("response", [])
        return items[0] if items else None

    async def get_fixture_events(self, fixture_id: int) -> list[dict]:
        data = await self.get("/fixtures/events", {"fixture": fixture_id})
        return data.get("response", [])

    async def get_fixture_stats(self, fixture_id: int) -> list[dict]:
        data = await self.get("/fixtures/statistics", {"fixture": fixture_id})
        return data.get("response", [])

    async def get_fixture_lineups(self, fixture_id: int) -> list[dict]:
        data = await self.get("/fixtures/lineups", {"fixture": fixture_id})
        return data.get("response", [])

    async def get_fixtures_by_date(self, date: str, league_ids: Optional[list[int]] = None) -> list[dict]:
        params: dict[str, Any] = {"date": date}
        if league_ids and len(league_ids) == 1:
            params["league"] = league_ids[0]
        data = await self.get("/fixtures", params)
        return data.get("response", [])

# ─── Firestore sync ───────────────────────────────────────────────────────────

class FirestoreSync:
    def __init__(self):
        self._db = None

    def _get_db(self):
        if self._db is None:
            import firebase_admin
            from firebase_admin import credentials, firestore as fs
            if not firebase_admin._apps:
                cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT)
                firebase_admin.initialize_app(cred)
            self._db = fs.client()
        return self._db

    def upsert_match(self, match_data: dict) -> None:
        """Write/update a single match document."""
        from firebase_admin import firestore as fs
        db = self._get_db()
        match_id = f"apifootball:{match_data['fixture']['id']}"
        doc = db.collection("matches").document(match_id)
        doc.set({
            "providerId": match_data["fixture"]["id"],
            "provider": "api-football",
            "status": match_data["fixture"]["status"]["short"],
            "minute": match_data["fixture"]["status"]["elapsed"],
            "homeTeamId": f"apifootball:{match_data['teams']['home']['id']}",
            "awayTeamId": f"apifootball:{match_data['teams']['away']['id']}",
            "homeTeamName": match_data["teams"]["home"]["name"],
            "awayTeamName": match_data["teams"]["away"]["name"],
            "homeTeamLogo": match_data["teams"]["home"]["logo"],
            "awayTeamLogo": match_data["teams"]["away"]["logo"],
            "homeScore": match_data["goals"]["home"],
            "awayScore": match_data["goals"]["away"],
            "homeScoreHT": match_data["score"]["halftime"]["home"],
            "awayScoreHT": match_data["score"]["halftime"]["away"],
            "homePenalties": match_data["score"]["penalty"]["home"],
            "awayPenalties": match_data["score"]["penalty"]["away"],
            "startTime": match_data["fixture"]["date"],
            "venue": match_data["fixture"]["venue"]["name"],
            "city": match_data["fixture"]["venue"]["city"],
            "competitionId": f"apifootball:{match_data['league']['id']}",
            "competitionName": match_data["league"]["name"],
            "competitionLogo": match_data["league"]["logo"],
            "round": match_data["league"]["round"],
            "season": str(match_data["league"]["season"]),
            "updatedAt": fs.SERVER_TIMESTAMP,
        }, merge=True)

    def upsert_events_batch(self, match_id: str, events: list[dict]) -> None:
        from firebase_admin import firestore as fs
        db = self._get_db()
        batch = db.batch()
        for i, event in enumerate(events):
            event_id = f"{match_id}:event:{i}"
            ref = db.collection("events").document(event_id)
            batch.set(ref, {
                "matchId": match_id,
                "minute": event.get("time", {}).get("elapsed"),
                "extraMinute": event.get("time", {}).get("extra"),
                "type": event.get("type"),
                "detail": event.get("detail"),
                "teamId": f"apifootball:{event.get('team', {}).get('id')}",
                "teamName": event.get("team", {}).get("name"),
                "playerName": event.get("player", {}).get("name"),
                "assistName": event.get("assist", {}).get("name"),
                "comments": event.get("comments"),
                "updatedAt": fs.SERVER_TIMESTAMP,
            }, merge=True)
        batch.commit()

    def upsert_stats(self, match_id: str, stats: list[dict]) -> None:
        from firebase_admin import firestore as fs
        db = self._get_db()
        for i, team_stats in enumerate(stats):
            side = "home" if i == 0 else "away"
            doc_id = f"{match_id}:stats:{side}"
            stat_map = {s["type"]: s["value"] for s in team_stats.get("statistics", [])}
            db.collection("matchStats").document(doc_id).set({
                "matchId": match_id,
                "teamId": f"apifootball:{team_stats['team']['id']}",
                "side": side,
                "stats": stat_map,
                "updatedAt": fs.SERVER_TIMESTAMP,
            }, merge=True)


# ─── Sync logic ───────────────────────────────────────────────────────────────

async def sync_live_matches():
    """Main sync loop: fetch all live matches and update Firestore."""
    logger.info("[LiveScores] Starting live match sync")

    async with APIFootballClient() as api:
        fixtures = await api.get_live_fixtures(TRACKED_COMPETITIONS)

    if not fixtures:
        logger.info("[LiveScores] No live matches found")
        return {"synced": 0}

    logger.info("[LiveScores] Found %d live fixtures", len(fixtures))
    sync = FirestoreSync()

    for fixture in fixtures:
        try:
            fixture_id = fixture["fixture"]["id"]
            match_id = f"apifootball:{fixture_id}"

            # Upsert match document
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: sync.upsert_match(fixture))

            # Fetch and sync events + stats concurrently
            async with APIFootballClient() as api:
                events_task = api.get_fixture_events(fixture_id)
                stats_task = api.get_fixture_stats(fixture_id)
                events, stats = await asyncio.gather(events_task, stats_task)

            await loop.run_in_executor(None, lambda: sync.upsert_events_batch(match_id, events))
            await loop.run_in_executor(None, lambda: sync.upsert_stats(match_id, stats))

            logger.info("[LiveScores] Synced %s (events: %d)", match_id, len(events))

        except Exception as e:
            logger.error("[LiveScores] Error syncing fixture %s: %s", fixture.get("fixture", {}).get("id"), e)

    return {"synced": len(fixtures)}


async def sync_matches_by_date(date: str):
    """Sync all matches for a given date (YYYY-MM-DD)."""
    logger.info("[LiveScores] Syncing matches for date: %s", date)

    async with APIFootballClient() as api:
        fixtures = await api.get_fixtures_by_date(date, TRACKED_COMPETITIONS)

    sync = FirestoreSync()
    loop = asyncio.get_event_loop()

    for fixture in fixtures:
        try:
            await loop.run_in_executor(None, lambda: sync.upsert_match(fixture))
        except Exception as e:
            logger.error("[LiveScores] Error syncing %s: %s", fixture.get("fixture", {}).get("id"), e)

    logger.info("[LiveScores] Synced %d fixtures for %s", len(fixtures), date)
    return {"synced": len(fixtures), "date": date}


if __name__ == "__main__":
    import sys
    date_arg = sys.argv[1] if len(sys.argv) > 1 else None
    if date_arg:
        asyncio.run(sync_matches_by_date(date_arg))
    else:
        asyncio.run(sync_live_matches())
