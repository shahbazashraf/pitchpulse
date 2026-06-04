"""
PitchPulse Commentary Service
===============================
Generates natural-language commentary from real match events.
Uses Anthropic Claude API to convert structured event data into
broadcast-quality text. Never invents events — only narrates what happened.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import aiohttp

from pathlib import Path
from dotenv import load_dotenv

# Load .env.local from project root
dotenv_path = Path(__file__).resolve().parents[3] / '.env.local'
load_dotenv(dotenv_path)

logger = logging.getLogger("commentary")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s - %(message)s")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
FIREBASE_SERVICE_ACCOUNT = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
if FIREBASE_SERVICE_ACCOUNT.startswith("./"):
    FIREBASE_SERVICE_ACCOUNT = str(Path(__file__).resolve().parents[3] / FIREBASE_SERVICE_ACCOUNT[2:])

# ─── Event → text templates (rule-based, no AI needed for simple events) ──────

EVENT_TEMPLATES: dict[str, list[str]] = {
    "Goal": [
        "{minute}' ⚽ GOAL! {player} puts the ball in the net! {home_score}-{away_score}",
        "{minute}' ⚽ {player} scores! What a moment! It's {home_score}-{away_score}",
    ],
    "Own Goal": [
        "{minute}' ⚽ Own goal! {player} unfortunately deflects into their own net. {home_score}-{away_score}",
    ],
    "Penalty Goal": [
        "{minute}' ⚽ PENALTY! {player} steps up and converts from the spot. {home_score}-{away_score}",
    ],
    "Penalty Missed": [
        "{minute}' ❌ Penalty missed! {player} fails to convert from twelve yards.",
    ],
    "Yellow Card": [
        "{minute}' 🟨 Yellow card for {player}.",
        "{minute}' 🟨 Booking! {player} is cautioned by the referee.",
    ],
    "Red Card": [
        "{minute}' 🟥 RED CARD! {player} is sent off! Down to ten men.",
    ],
    "Yellow Red Card": [
        "{minute}' 🟥 Second yellow! {player} is dismissed after picking up a second caution.",
    ],
    "Substitution": [
        "{minute}' 🔄 Substitution: {player} replaces {detail}.",
    ],
    "VAR": [
        "{minute}' 📺 VAR review underway. The referee is checking the decision.",
        "{minute}' 📺 VAR: Checking for {detail}.",
    ],
}

import random

def rule_based_commentary(event: dict, home_score: int, away_score: int) -> Optional[str]:
    """Generate commentary from templates — no AI needed for standard events."""
    event_type = event.get("type", "")
    templates = EVENT_TEMPLATES.get(event_type)
    if not templates:
        return None

    template = random.choice(templates)
    return template.format(
        minute=event.get("minute", "?"),
        player=event.get("playerName") or "Unknown",
        detail=event.get("detail") or event.get("assistPlayerName") or "",
        home_score=home_score,
        away_score=away_score,
    )


# ─── AI commentary for significant moments ────────────────────────────────────

class CommentaryAI:
    """
    Uses Claude to generate richer commentary for significant events.
    Only called for goals, red cards, penalties — not every event.
    Falls back to rule-based if API unavailable.
    """

    API_URL = "https://api.anthropic.com/v1/messages"

    def __init__(self):
        self._session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        self._session = aiohttp.ClientSession(
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            timeout=aiohttp.ClientTimeout(total=20),
        )
        return self

    async def __aexit__(self, *_):
        if self._session:
            await self._session.close()

    async def generate(self, event: dict, match_context: dict) -> Optional[str]:
        """Generate AI commentary for an event given full match context."""
        if not ANTHROPIC_API_KEY:
            return None

        prompt = self._build_prompt(event, match_context)
        payload = {
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 150,
            "system": (
                "You are a professional football commentator. "
                "Write a single sentence of live match commentary (max 40 words) "
                "for the event described. Be energetic and concise. "
                "Never add information not in the event data. "
                "Do not include emojis. Output only the commentary text, nothing else."
            ),
            "messages": [{"role": "user", "content": prompt}],
        }

        try:
            assert self._session
            async with self._session.post(self.API_URL, json=payload) as resp:
                if resp.status != 200:
                    logger.warning("[CommentaryAI] API returned %d", resp.status)
                    return None
                data = await resp.json()
                return data["content"][0]["text"].strip()
        except Exception as e:
            logger.warning("[CommentaryAI] Generation failed: %s", e)
            return None

    def _build_prompt(self, event: dict, ctx: dict) -> str:
        home = ctx.get("homeTeamName", "Home")
        away = ctx.get("awayTeamName", "Away")
        hs = ctx.get("homeScore", 0)
        aws = ctx.get("awayScore", 0)
        minute = event.get("minute", "?")
        player = event.get("playerName", "")
        etype = event.get("type", "")
        detail = event.get("detail", "")
        assist = event.get("assistPlayerName", "")

        parts = [
            f"Match: {home} {hs}-{aws} {away}",
            f"Minute: {minute}'",
            f"Event: {etype}",
        ]
        if player:
            parts.append(f"Player: {player}")
        if assist:
            parts.append(f"Assist: {assist}")
        if detail:
            parts.append(f"Detail: {detail}")

        return "\n".join(parts)


# ─── Important event types that get AI commentary ────────────────────────────

AI_WORTHY_EVENTS = {"Goal", "Penalty Goal", "Own Goal", "Red Card", "Yellow Red Card"}


# ─── Commentary service ───────────────────────────────────────────────────────

class CommentaryService:
    def __init__(self):
        self._firebase_db = None

    def _get_db(self):
        if self._firebase_db is None:
            import firebase_admin
            from firebase_admin import credentials, firestore as fs
            if not firebase_admin._apps:
                cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT)
                firebase_admin.initialize_app(cred)
            self._firebase_db = fs.client()
        return self._firebase_db

    async def generate_for_match(self, match: dict, events: list[dict]) -> list[dict]:
        """
        Generate commentary entries for all events in a match.
        Uses AI for important events, templates for the rest.
        """
        match_id = match.get("id", "")
        logger.info("[Commentary] Generating for match %s (%d events)", match_id, len(events))

        results: list[dict] = []
        home_score = 0
        away_score = 0

        async with CommentaryAI() as ai:
            for event in sorted(events, key=lambda e: e.get("minute", 0)):
                event_type = event.get("type", "")

                # Track score for context
                if event_type in ("Goal", "Penalty Goal") and event.get("teamSide") == "home":
                    home_score += 1
                elif event_type in ("Goal", "Penalty Goal") and event.get("teamSide") == "away":
                    away_score += 1
                elif event_type == "Own Goal" and event.get("teamSide") == "home":
                    away_score += 1
                elif event_type == "Own Goal" and event.get("teamSide") == "away":
                    home_score += 1

                # Generate text
                text: Optional[str] = None

                if event_type in AI_WORTHY_EVENTS and ANTHROPIC_API_KEY:
                    text = await ai.generate(event, {
                        **match,
                        "homeScore": home_score,
                        "awayScore": away_score,
                    })

                if not text:
                    text = rule_based_commentary(event, home_score, away_score)

                if not text:
                    continue

                entry = {
                    "id": f"{match_id}:commentary:{event.get('id', len(results))}",
                    "matchId": match_id,
                    "minute": event.get("minute"),
                    "extraMinute": event.get("extraMinute"),
                    "text": text,
                    "isHighlight": event_type in AI_WORTHY_EVENTS,
                    "eventId": event.get("id"),
                    "eventType": event_type,
                    "source": "ai_generated" if event_type in AI_WORTHY_EVENTS and ANTHROPIC_API_KEY else "rule_based",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                }
                results.append(entry)

        logger.info("[Commentary] Generated %d entries for %s", len(results), match_id)
        return results

    async def sync_to_firestore(self, match_id: str, commentary: list[dict]) -> None:
        from firebase_admin import firestore as fs
        db = self._get_db()
        batch = db.batch()
        for i, entry in enumerate(commentary):
            ref = db.collection("commentary").document(entry["id"])
            batch.set(ref, {**entry, "updatedAt": fs.SERVER_TIMESTAMP}, merge=True)
            if i > 0 and i % 450 == 0:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, batch.commit)
                batch = db.batch()
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, batch.commit)
        logger.info("[Commentary] Synced %d entries to Firestore", len(commentary))


if __name__ == "__main__":
    import sys

    async def main():
        data = json.loads(sys.stdin.read())
        match = data["match"]
        events = data["events"]
        svc = CommentaryService()
        commentary = await svc.generate_for_match(match, events)
        print(json.dumps(commentary, indent=2))

    asyncio.run(main())
