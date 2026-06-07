"""
PitchPulse Commentary Service — Phase 1 Update
================================================
Primary AI: Groq (llama3-8b-8192) — 14,400 req/day free, ~200ms latency
Fallback AI: Google AI Studio (Gemini Flash) — rate-limited, not req-limited
Last resort: Rule-based templates (zero API calls)

PHASE 1 CHANGE: Switched from Anthropic API to Groq OpenAI-compatible endpoint.
Set GROQ_API_KEY in .env.local (free at console.groq.com, no credit card).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
from datetime import datetime, timezone
from typing import Optional

import aiohttp
from pathlib import Path
from dotenv import load_dotenv

dotenv_path = Path(__file__).resolve().parents[3] / ".env.local"
load_dotenv(dotenv_path)

logger = logging.getLogger("commentary")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)

# ─── Config ───────────────────────────────────────────────────────────────────

# Primary: Groq (fastest, most generous free tier)
GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_MODEL    = os.getenv("GROQ_MODEL", "llama3-8b-8192")

# Fallback: OpenRouter (free models available)
OPENROUTER_KEY      = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL    = os.getenv("OPENROUTER_MODEL", "mistralai/mistral-7b-instruct:free")

# Legacy Anthropic key (kept for backwards compat, not used for commentary)
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

FIREBASE_SERVICE_ACCOUNT = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
if FIREBASE_SERVICE_ACCOUNT.startswith("./"):
    FIREBASE_SERVICE_ACCOUNT = str(
        Path(__file__).resolve().parents[3] / FIREBASE_SERVICE_ACCOUNT[2:]
    )

# ─── Rule-based templates ─────────────────────────────────────────────────────

EVENT_TEMPLATES: dict[str, list[str]] = {
    "Goal": [
        "{minute}' ⚽ GOAL! {player} finds the back of the net! Score: {home_score}-{away_score}",
        "{minute}' ⚽ {player} scores! The crowd erupts! {home_score}-{away_score}",
        "{minute}' ⚽ It's a goal! {player} with the finish! {home_score}-{away_score}",
    ],
    "Own Goal": [
        "{minute}' ⚽ Own goal! {player} puts it in their own net. Score: {home_score}-{away_score}",
        "{minute}' ⚽ Unfortunate! {player} deflects into their own goal. {home_score}-{away_score}",
    ],
    "Penalty Goal": [
        "{minute}' ⚽ PENALTY CONVERTED! {player} steps up and scores from the spot. {home_score}-{away_score}",
        "{minute}' ⚽ Cool as you like! {player} dispatches the penalty. {home_score}-{away_score}",
    ],
    "Penalty Missed": [
        "{minute}' ❌ Penalty missed! {player} fails to convert from twelve yards.",
        "{minute}' ❌ The goalkeeper saves it! {player}'s penalty is stopped.",
    ],
    "Yellow Card": [
        "{minute}' 🟨 Yellow card for {player}.",
        "{minute}' 🟨 Booking! The referee cautions {player}.",
    ],
    "Red Card": [
        "{minute}' 🟥 RED CARD! {player} is sent off! Down to ten men.",
        "{minute}' 🟥 Dismissed! {player} receives a straight red card.",
    ],
    "Yellow Red Card": [
        "{minute}' 🟥 Second yellow! {player} picks up a second caution and is off.",
        "{minute}' 🟥 {player} is dismissed after two bookings.",
    ],
    "Substitution": [
        "{minute}' 🔄 Substitution: {player} comes on.",
        "{minute}' 🔄 Change made — {player} enters the field.",
    ],
    "VAR": [
        "{minute}' 📺 VAR review underway. The referee is checking the decision.",
        "{minute}' 📺 Video review in progress — checking for {detail}.",
    ],
}


def rule_based_commentary(event: dict, home_score: int, away_score: int) -> Optional[str]:
    event_type = event.get("type", "")
    templates = EVENT_TEMPLATES.get(event_type)
    if not templates:
        return None
    template = random.choice(templates)
    return template.format(
        minute=event.get("minute", "?"),
        player=event.get("playerName") or "Unknown",
        detail=event.get("detail") or event.get("assistPlayerName") or "infringement",
        home_score=home_score,
        away_score=away_score,
    )


# ─── AI commentary (OpenAI-compatible — works with Groq, OpenRouter, etc.) ───

class CommentaryAI:
    """
    Generates richer commentary for significant events using any
    OpenAI-compatible API. Primary: Groq. Fallback: OpenRouter.
    Falls back to rule-based if both are unavailable.
    """

    def __init__(self):
        self._session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=20),
        )
        return self

    async def __aexit__(self, *_):
        if self._session:
            await self._session.close()

    async def generate(self, event: dict, match_context: dict) -> Optional[str]:
        """Try Groq first, then OpenRouter, return None if both fail."""
        if GROQ_API_KEY:
            result = await self._call_openai_compatible(
                base_url=GROQ_BASE_URL,
                api_key=GROQ_API_KEY,
                model=GROQ_MODEL,
                event=event,
                match_context=match_context,
            )
            if result:
                return result

        if OPENROUTER_KEY:
            result = await self._call_openai_compatible(
                base_url=OPENROUTER_BASE_URL,
                api_key=OPENROUTER_KEY,
                model=OPENROUTER_MODEL,
                event=event,
                match_context=match_context,
            )
            if result:
                return result

        return None

    async def _call_openai_compatible(
        self,
        base_url: str,
        api_key: str,
        model: str,
        event: dict,
        match_context: dict,
    ) -> Optional[str]:
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a professional football commentator. "
                        "Write a single sentence of live match commentary (max 40 words). "
                        "Be energetic and concise. Never add information not in the event. "
                        "Do not use emojis. Output only the commentary text."
                    ),
                },
                {
                    "role": "user",
                    "content": self._build_prompt(event, match_context),
                },
            ],
            "max_tokens": 100,
            "temperature": 0.7,
        }

        try:
            assert self._session
            async with self._session.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            ) as resp:
                if resp.status != 200:
                    logger.warning("[CommentaryAI] %s returned %d", base_url, resp.status)
                    return None
                data = await resp.json()
                return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning("[CommentaryAI] %s failed: %s", base_url, e)
            return None

    def _build_prompt(self, event: dict, ctx: dict) -> str:
        home  = ctx.get("homeTeamName", "Home")
        away  = ctx.get("awayTeamName", "Away")
        hs    = ctx.get("homeScore", 0)
        aws   = ctx.get("awayScore", 0)
        parts = [
            f"Match: {home} {hs}-{aws} {away}",
            f"Minute: {event.get('minute', '?')}'",
            f"Event: {event.get('type', '')}",
        ]
        if event.get("playerName"):
            parts.append(f"Player: {event['playerName']}")
        if event.get("assistPlayerName"):
            parts.append(f"Assist: {event['assistPlayerName']}")
        if event.get("detail"):
            parts.append(f"Detail: {event['detail']}")
        return "\n".join(parts)


# ─── Important event types for AI commentary ──────────────────────────────────

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
        match_id = match.get("id", "")
        logger.info("[Commentary] Generating for match %s (%d events)", match_id, len(events))

        results: list[dict] = []
        home_score = 0
        away_score = 0

        has_ai = bool(GROQ_API_KEY or OPENROUTER_KEY)

        async with CommentaryAI() as ai:
            for event in sorted(events, key=lambda e: e.get("minute", 0)):
                event_type = event.get("type", "")

                # Track score
                if event_type in ("Goal", "Penalty Goal"):
                    if event.get("teamSide") == "home":
                        home_score += 1
                    else:
                        away_score += 1
                elif event_type == "Own Goal":
                    if event.get("teamSide") == "home":
                        away_score += 1
                    else:
                        home_score += 1

                text: Optional[str] = None
                source = "rule_based"

                if event_type in AI_WORTHY_EVENTS and has_ai:
                    text = await ai.generate(event, {
                        **match,
                        "homeScore": home_score,
                        "awayScore": away_score,
                    })
                    if text:
                        source = "ai_generated"

                if not text:
                    text = rule_based_commentary(event, home_score, away_score)

                if not text:
                    continue

                entry = {
                    "id":          f"{match_id}:commentary:{event.get('id', len(results))}",
                    "matchId":     match_id,
                    "minute":      event.get("minute"),
                    "extraMinute": event.get("extraMinute"),
                    "text":        text,
                    "isHighlight": event_type in AI_WORTHY_EVENTS,
                    "eventId":     event.get("id"),
                    "eventType":   event_type,
                    "source":      source,
                    "createdAt":   datetime.now(timezone.utc).isoformat(),
                }
                results.append(entry)

        logger.info("[Commentary] Generated %d entries for %s", len(results), match_id)
        return results

    async def sync_to_firestore(self, match_id: str, commentary: list[dict]) -> None:
        from firebase_admin import firestore as fs
        db = self._get_db()
        batch = db.batch()
        loop = asyncio.get_event_loop()
        for i, entry in enumerate(commentary):
            ref = db.collection("commentary").document(entry["id"])
            batch.set(ref, {**entry, "updatedAt": fs.SERVER_TIMESTAMP}, merge=True)
            if i > 0 and i % 450 == 0:
                await loop.run_in_executor(None, batch.commit)
                batch = db.batch()
        await loop.run_in_executor(None, batch.commit)
        logger.info("[Commentary] Synced %d entries", len(commentary))


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
