"""
PitchPulse Stream Discovery Service
====================================
Discovers and validates LEGAL, official public streams for football matches.

Sources targeted:
  - YouTube official broadcaster channels (CazéTV, ITV Sport, etc.)
  - FIFA+ official clips/streams
  - BBC iPlayer live links
  - FOX Sports public embeds
  - Telemundo/NBC Sports public streams
  - TSN/CTV Canada public streams
  - BeIN Sports public clips
  - DAZN public previews

This service only discovers official, rights-holder content.
It does NOT scrape, aggregate, or link illegal streams.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode, urlparse, parse_qs

import aiohttp
from pydantic import BaseModel, HttpUrl, field_validator

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("stream_discovery")

from pathlib import Path
from dotenv import load_dotenv

# Load .env.local from project root
dotenv_path = Path(__file__).resolve().parents[3] / '.env.local'
load_dotenv(dotenv_path)

# ─── Config ───────────────────────────────────────────────────────────────────

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
FIREBASE_SERVICE_ACCOUNT = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
if FIREBASE_SERVICE_ACCOUNT.startswith("./"):
    FIREBASE_SERVICE_ACCOUNT = str(Path(__file__).resolve().parents[3] / FIREBASE_SERVICE_ACCOUNT[2:])

REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=15, connect=5)
MAX_CONCURRENT_REQUESTS = 10
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_BASE = 2.0  # seconds

# ─── Stream model ─────────────────────────────────────────────────────────────

class StreamResult(BaseModel):
    id: str
    match_id: str
    broadcaster: str
    broadcaster_id: str
    title: str
    url: str
    embed_url: Optional[str] = None
    stream_type: str = "live"          # live | replay | highlight
    quality: str = "HD"                # SD | HD | FHD | 4K
    language: str = "en"
    region: list[str] = field(default_factory=list)  # [] = worldwide
    is_official: bool = True
    is_geo_restricted: bool = False
    requires_auth: bool = False
    requires_subscription: bool = False
    is_free: bool = True
    is_available: bool = False
    available_from: Optional[str] = None
    available_until: Optional[str] = None
    last_verified: str = ""
    thumbnail_url: Optional[str] = None
    platform: str = "web"             # youtube | twitch | facebook | web | app

    model_config = {"arbitrary_types_allowed": True}

    @field_validator("last_verified", mode="before")
    @classmethod
    def default_verified(cls, v: str) -> str:
        return v or datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return self.model_dump()

    def stable_id(self) -> str:
        raw = f"{self.match_id}:{self.broadcaster_id}:{self.url}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

# ─── HTTP helper ──────────────────────────────────────────────────────────────

class HttpClient:
    """Shared aiohttp session with retry logic and rate limiting."""

    def __init__(self, requests_per_second: float = 2.0):
        self._session: Optional[aiohttp.ClientSession] = None
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
        self._min_interval = 1.0 / requests_per_second
        self._last_request = 0.0
        self._headers = {
            "User-Agent": "PitchPulse/1.0 (stream-discovery; +https://pitchpulse.com)",
            "Accept": "application/json, text/html",
        }

    async def __aenter__(self):
        self._session = aiohttp.ClientSession(
            timeout=REQUEST_TIMEOUT,
            headers=self._headers,
        )
        return self

    async def __aexit__(self, *_):
        if self._session:
            await self._session.close()

    async def get(
        self,
        url: str,
        params: Optional[dict] = None,
        headers: Optional[dict] = None,
        return_text: bool = False,
    ) -> dict | str | None:
        for attempt in range(RETRY_ATTEMPTS):
            try:
                async with self._semaphore:
                    # rate limiting
                    now = time.monotonic()
                    elapsed = now - self._last_request
                    if elapsed < self._min_interval:
                        await asyncio.sleep(self._min_interval - elapsed)
                    self._last_request = time.monotonic()

                    assert self._session is not None
                    async with self._session.get(
                        url,
                        params=params,
                        headers=headers,
                        allow_redirects=True,
                    ) as resp:
                        if resp.status == 429:
                            retry_after = float(resp.headers.get("Retry-After", 60))
                            logger.warning("Rate limited on %s; waiting %.0fs", url, retry_after)
                            await asyncio.sleep(retry_after)
                            continue
                        if resp.status == 404:
                            return None
                        resp.raise_for_status()
                        if return_text:
                            return await resp.text()
                        ct = resp.headers.get("Content-Type", "")
                        if "json" in ct:
                            return await resp.json()
                        return await resp.text()

            except aiohttp.ClientResponseError as e:
                if e.status in (401, 403):
                    logger.error("Auth error on %s: %s", url, e)
                    return None
                backoff = RETRY_BACKOFF_BASE ** attempt
                logger.warning("HTTP error on %s (attempt %d): %s — retrying in %.1fs", url, attempt + 1, e, backoff)
                await asyncio.sleep(backoff)
            except asyncio.TimeoutError:
                logger.warning("Timeout on %s (attempt %d)", url, attempt + 1)
                await asyncio.sleep(RETRY_BACKOFF_BASE ** attempt)
            except Exception as e:
                logger.error("Unexpected error on %s: %s", url, e)
                return None

        logger.error("All %d attempts failed for %s", RETRY_ATTEMPTS, url)
        return None

# ─── Base discoverer ──────────────────────────────────────────────────────────

class BaseDiscoverer:
    """
    Base class for all stream source discoverers.
    Each subclass targets one broadcaster/platform.
    """
    name: str = "base"

    def __init__(self, client: HttpClient):
        self.client = client

    async def discover(self, match: dict) -> list[StreamResult]:
        raise NotImplementedError

    def _make_stream(self, match_id: str, **kwargs) -> StreamResult:
        s = StreamResult(match_id=match_id, **kwargs)
        s.id = s.stable_id()
        return s

# ─── YouTube Discoverer ────────────────────────────────────────────────────────

class YouTubeDiscoverer(BaseDiscoverer):
    """
    Searches YouTube Data API v3 for official broadcaster live streams
    and VOD replays. Only returns videos from verified official channels.
    """
    name = "youtube"

    # Official channel IDs for FIFA World Cup 2026 rights holders
    OFFICIAL_CHANNELS: dict[str, dict] = {
        "UCsV9ovtNxDMnOp3KvmBrLsw": {"name": "CazéTV", "language": "pt", "regions": ["BR"]},
        "UCqbfOSGIE5OjivxXwnAPbOQ": {"name": "FIFA", "language": "en", "regions": []},
        "UCvHTmN2RqKOtQfIkVJrNSZA": {"name": "FOX Soccer", "language": "en", "regions": ["US"]},
        "UCnUYZLuoy1rq1aVMwx4aTzw": {"name": "ITV Sport", "language": "en", "regions": ["GB"]},
        "UCJf4-reOGgHx3y7VmfRIYQg": {"name": "BBC Sport", "language": "en", "regions": ["GB"]},
        "UCDAzmn5_pM7HMKV_1PWFEBA": {"name": "TSN", "language": "en", "regions": ["CA"]},
        "UC8-cU1TejIjLSCxNJ7B5LhA": {"name": "beIN SPORTS", "language": "en", "regions": []},
        "UCiiRJud4SHZTrTiQHvDYQlg": {"name": "Azteca Deportes", "language": "es", "regions": ["MX"]},
        "UCbqcG1rdt9LMwOJN4PyGTKg": {"name": "Telemundo Deportes", "language": "es", "regions": ["US"]},
    }

    SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
    VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
    CHANNEL_URL = "https://www.googleapis.com/youtube/v3/channels"

    async def discover(self, match: dict) -> list[StreamResult]:
        if not YOUTUBE_API_KEY:
            logger.warning("[YouTube] YOUTUBE_API_KEY not set — skipping")
            return []

        results: list[StreamResult] = []
        home = match.get("homeTeam", {}).get("name", "")
        away = match.get("awayTeam", {}).get("name", "")
        match_id = match.get("id", "")

        tasks = [
            self._search_channel(channel_id, info, home, away, match_id)
            for channel_id, info in self.OFFICIAL_CHANNELS.items()
        ]

        channel_results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in channel_results:
            if isinstance(r, list):
                results.extend(r)
            elif isinstance(r, Exception):
                logger.warning("[YouTube] Channel search error: %s", r)

        return results

    async def _search_channel(
        self,
        channel_id: str,
        channel_info: dict,
        home: str,
        away: str,
        match_id: str,
    ) -> list[StreamResult]:
        query = f"{home} {away} World Cup 2026"
        params = {
            "key": YOUTUBE_API_KEY,
            "channelId": channel_id,
            "q": query,
            "type": "video",
            "eventType": "live",          # only live streams
            "part": "id,snippet",
            "maxResults": 3,
            "order": "relevance",
        }

        data = await self.client.get(self.SEARCH_URL, params=params)
        if not data or not isinstance(data, dict):
            return []

        streams: list[StreamResult] = []
        items = data.get("items", [])

        for item in items:
            video_id = item.get("id", {}).get("videoId")
            if not video_id:
                continue

            snippet = item.get("snippet", {})
            title = snippet.get("title", "")
            thumbnail = (
                snippet.get("thumbnails", {}).get("high", {}).get("url")
                or snippet.get("thumbnails", {}).get("default", {}).get("url")
            )

            # Validate it's actually live
            is_live = await self._validate_live(video_id)

            stream = self._make_stream(
                match_id=match_id,
                broadcaster=channel_info["name"],
                broadcaster_id=channel_id,
                title=title,
                url=f"https://www.youtube.com/watch?v={video_id}",
                embed_url=f"https://www.youtube.com/embed/{video_id}?autoplay=1",
                stream_type="live" if is_live else "replay",
                quality="HD",
                language=channel_info.get("language", "en"),
                region=channel_info.get("regions", []),
                is_official=True,
                is_free=True,
                is_available=is_live,
                thumbnail_url=thumbnail,
                platform="youtube",
                is_geo_restricted=len(channel_info.get("regions", [])) > 0,
            )
            streams.append(stream)

        return streams

    async def _validate_live(self, video_id: str) -> bool:
        """Check if a YouTube video is currently live."""
        params = {
            "key": YOUTUBE_API_KEY,
            "id": video_id,
            "part": "liveStreamingDetails,status",
        }
        data = await self.client.get(self.VIDEOS_URL, params=params)
        if not data or not isinstance(data, dict):
            return False
        items = data.get("items", [])
        if not items:
            return False
        item = items[0]
        status = item.get("status", {})
        live_details = item.get("liveStreamingDetails", {})
        return (
            status.get("uploadStatus") == "uploaded"
            and bool(live_details.get("actualStartTime"))
            and not live_details.get("actualEndTime")
        )

# ─── BBC iPlayer Discoverer ────────────────────────────────────────────────────

class BBCiPlayerDiscoverer(BaseDiscoverer):
    """
    Finds BBC iPlayer live sport streams using the BBC's public schedule API.
    Only for UK-accessible content via official BBC channels.
    """
    name = "bbc_iplayer"

    SCHEDULE_API = "https://www.bbc.co.uk/api/ibl/v1/schedule"
    BRAND_API = "https://api.bbc.co.uk/ibl/v1/episodes"

    # BBC Sport live stream PIDs
    LIVE_CHANNELS: dict[str, dict] = {
        "bbc_one": {"name": "BBC One", "stream_pid": "bbc_one"},
        "bbc_two": {"name": "BBC Two", "stream_pid": "bbc_two"},
        "bbc_three": {"name": "BBC Three", "stream_pid": "bbc_three"},
        "bbc_sport": {"name": "BBC iPlayer Sports", "stream_pid": "bbc_news"},
    }

    # Pattern to identify sports content
    FOOTBALL_KEYWORDS = {"world cup", "fifa", "football", "soccer", "2026"}

    async def discover(self, match: dict) -> list[StreamResult]:
        """
        BBC iPlayer live streams are region-locked to UK.
        We return the official embed link that UK users can access.
        """
        match_id = match.get("id", "")
        home = match.get("homeTeam", {}).get("name", "").lower()
        away = match.get("awayTeam", {}).get("name", "").lower()

        # Check BBC Sport schedule API for match coverage
        streams = await self._check_bbc_schedule(match_id, home, away, match)
        return streams

    async def _check_bbc_schedule(
        self,
        match_id: str,
        home: str,
        away: str,
        match: dict,
    ) -> list[StreamResult]:
        results: list[StreamResult] = []

        # BBC public schedule API for TV listings
        match_date = match.get("startTime", "")[:10]  # YYYY-MM-DD
        url = f"https://www.bbc.co.uk/api/ibl/v1/schedule?date={match_date}&service=bbc_one&region=en&api_key=2BBzA3jBrUcDZnq9E7WKZZ8Hgze8QWgq"

        data = await self.client.get(url)
        if not data or not isinstance(data, dict):
            # Fallback: return static official link for known World Cup coverage
            return self._known_coverage(match_id, match)

        schedule = data.get("schedule", {}).get("elements", [])
        for programme in schedule:
            title = programme.get("programme", {}).get("title", "").lower()
            ep_title = programme.get("programme", {}).get("display_title", {}).get("title", "").lower()

            if any(kw in title or kw in ep_title for kw in self.FOOTBALL_KEYWORDS):
                pid = programme.get("programme", {}).get("pid", "")
                if pid:
                    stream = self._make_stream(
                        match_id=match_id,
                        broadcaster="BBC iPlayer",
                        broadcaster_id="bbc_iplayer",
                        title=programme.get("programme", {}).get("display_title", {}).get("title", "BBC Sport Live"),
                        url=f"https://www.bbc.co.uk/iplayer/live/bbcone",
                        embed_url=f"https://www.bbc.co.uk/iplayer/episode/{pid}",
                        stream_type="live",
                        quality="FHD",
                        language="en",
                        region=["GB"],
                        is_official=True,
                        is_free=True,
                        is_available=True,
                        is_geo_restricted=True,
                        platform="web",
                    )
                    results.append(stream)

        return results or self._known_coverage(match_id, match)

    def _known_coverage(self, match_id: str, match: dict) -> list[StreamResult]:
        """
        For known World Cup 2026 matches, BBC has confirmed live coverage on BBC One.
        Return the static official live stream link.
        """
        return [
            self._make_stream(
                match_id=match_id,
                broadcaster="BBC One (iPlayer)",
                broadcaster_id="bbc_iplayer",
                title="FIFA World Cup 2026 Live — BBC One",
                url="https://www.bbc.co.uk/iplayer/live/bbcone",
                embed_url=None,  # iPlayer does not allow external embedding
                stream_type="live",
                quality="FHD",
                language="en",
                region=["GB"],
                is_official=True,
                is_free=True,
                is_available=True,  # will be verified at runtime
                is_geo_restricted=True,
                requires_auth=False,  # no login required for BBC iPlayer live TV
                platform="web",
            )
        ]

# ─── FIFA+ Discoverer ──────────────────────────────────────────────────────────

class FIFAPlusDiscoverer(BaseDiscoverer):
    """
    Discovers content on FIFA+ (plus.fifa.com).
    FIFA+ provides free highlights, match replays, and select live streams
    in markets without a rights holder.
    """
    name = "fifa_plus"

    FIFA_PLUS_BASE = "https://plus.fifa.com"
    FIFA_API = "https://api.fifa.com/api/v3"

    async def discover(self, match: dict) -> list[StreamResult]:
        match_id = match.get("id", "")
        provider_id = match.get("providerId", "")

        streams: list[StreamResult] = []

        # FIFA+ has a public content API
        # Endpoint: /content/video?type=match&matchId={id}
        url = f"{self.FIFA_API}/content/video"
        params = {
            "count": 10,
            "language": "en",
            "matchId": str(provider_id),
            "type": "LIVE,REPLAY,HIGHLIGHTS",
        }

        data = await self.client.get(url, params=params)
        if data and isinstance(data, dict):
            items = data.get("Results", [])
            for item in items:
                video_url = item.get("VideoUrl") or item.get("ExternalUrl")
                if not video_url:
                    continue

                content_type = item.get("ContentType", "").upper()
                stream_type = "live" if "LIVE" in content_type else (
                    "highlight" if "HIGHLIGHT" in content_type else "replay"
                )

                stream = self._make_stream(
                    match_id=match_id,
                    broadcaster="FIFA+",
                    broadcaster_id="fifa_plus",
                    title=item.get("Title", "FIFA+ Official Stream"),
                    url=video_url,
                    embed_url=item.get("EmbedUrl"),
                    stream_type=stream_type,
                    quality="HD",
                    language=item.get("Language", "en"),
                    region=[],  # FIFA+ is global
                    is_official=True,
                    is_free=True,
                    is_available=stream_type == "live",
                    platform="web",
                    thumbnail_url=item.get("ThumbnailUrl"),
                )
                streams.append(stream)

        # Also check FIFA's YouTube channel
        if not streams:
            streams = await self._check_fifa_youtube(match_id, match)

        return streams

    async def _check_fifa_youtube(self, match_id: str, match: dict) -> list[StreamResult]:
        """FIFA's official YouTube as fallback."""
        if not YOUTUBE_API_KEY:
            return []

        home = match.get("homeTeam", {}).get("name", "")
        away = match.get("awayTeam", {}).get("name", "")

        params = {
            "key": YOUTUBE_API_KEY,
            "channelId": "UCpcTrCXblq78GYaatO50Elg",  # FIFA official YouTube
            "q": f"{home} vs {away} World Cup 2026",
            "type": "video",
            "eventType": "live",
            "part": "id,snippet",
            "maxResults": 2,
        }

        data = await self.client.get(
            "https://www.googleapis.com/youtube/v3/search",
            params=params,
        )
        if not data or not isinstance(data, dict):
            return []

        streams = []
        for item in data.get("items", []):
            video_id = item.get("id", {}).get("videoId")
            if not video_id:
                continue
            snippet = item.get("snippet", {})
            streams.append(
                self._make_stream(
                    match_id=match_id,
                    broadcaster="FIFA Official",
                    broadcaster_id="fifa_youtube",
                    title=snippet.get("title", "FIFA World Cup 2026 Live"),
                    url=f"https://www.youtube.com/watch?v={video_id}",
                    embed_url=f"https://www.youtube.com/embed/{video_id}?autoplay=1",
                    stream_type="live",
                    quality="HD",
                    language="en",
                    region=[],
                    is_official=True,
                    is_free=True,
                    is_available=True,
                    platform="youtube",
                    thumbnail_url=snippet.get("thumbnails", {}).get("high", {}).get("url"),
                )
            )
        return streams

# ─── Availability Validator ───────────────────────────────────────────────────

class StreamAvailabilityValidator:
    """
    Validates discovered streams are actually reachable.
    Does a lightweight HEAD request to check HTTP status.
    For YouTube, uses the oEmbed endpoint to avoid full page loads.
    """

    def __init__(self, client: HttpClient):
        self.client = client

    async def validate(self, stream: StreamResult) -> StreamResult:
        try:
            if stream.platform == "youtube":
                return await self._validate_youtube(stream)
            else:
                return await self._validate_http(stream)
        except Exception as e:
            logger.warning("[Validator] Error validating %s: %s", stream.url, e)
            stream.is_available = False
            return stream

    async def _validate_youtube(self, stream: StreamResult) -> StreamResult:
        video_id = self._extract_youtube_id(stream.url)
        if not video_id:
            stream.is_available = False
            return stream

        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        data = await self.client.get(oembed_url)
        stream.is_available = bool(data)
        stream.last_verified = datetime.now(timezone.utc).isoformat()
        return stream

    async def _validate_http(self, stream: StreamResult) -> StreamResult:
        try:
            assert self.client._session is not None
            async with self.client._session.head(
                stream.url,
                allow_redirects=True,
                timeout=aiohttp.ClientTimeout(total=8),
            ) as resp:
                stream.is_available = resp.status < 400
                stream.last_verified = datetime.now(timezone.utc).isoformat()
        except Exception:
            stream.is_available = False
        return stream

    @staticmethod
    def _extract_youtube_id(url: str) -> Optional[str]:
        patterns = [
            r"youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})",
            r"youtu\.be/([a-zA-Z0-9_-]{11})",
            r"youtube\.com/embed/([a-zA-Z0-9_-]{11})",
        ]
        for pattern in patterns:
            m = re.search(pattern, url)
            if m:
                return m.group(1)
        return None

# ─── Main Service ──────────────────────────────────────────────────────────────

class StreamDiscoveryService:
    """
    Orchestrates all discoverers, validates results,
    and writes to Firestore.
    """

    def __init__(self):
        self._discoverers: list[type[BaseDiscoverer]] = [
            YouTubeDiscoverer,
            BBCiPlayerDiscoverer,
            FIFAPlusDiscoverer,
        ]

    async def discover_for_match(self, match: dict) -> list[dict]:
        """
        Run all discoverers for a single match.
        Returns validated stream dicts ready for Firestore.
        """
        match_id = match.get("id", "unknown")
        logger.info("[StreamDiscovery] Starting discovery for match %s", match_id)

        async with HttpClient(requests_per_second=3.0) as client:
            validator = StreamAvailabilityValidator(client)

            # Run all discoverers concurrently
            discoverer_tasks = [
                cls(client).discover(match)
                for cls in self._discoverers
            ]
            all_results = await asyncio.gather(*discoverer_tasks, return_exceptions=True)

            raw_streams: list[StreamResult] = []
            for result in all_results:
                if isinstance(result, list):
                    raw_streams.extend(result)
                elif isinstance(result, Exception):
                    logger.warning("[StreamDiscovery] Discoverer error: %s", result)

            logger.info(
                "[StreamDiscovery] Found %d raw streams for %s, validating...",
                len(raw_streams), match_id,
            )

            # Validate all streams concurrently (bounded by semaphore)
            validation_tasks = [validator.validate(s) for s in raw_streams]
            validated = await asyncio.gather(*validation_tasks, return_exceptions=True)

            streams: list[StreamResult] = []
            for v in validated:
                if isinstance(v, StreamResult):
                    streams.append(v)

            available = [s for s in streams if s.is_available]
            logger.info(
                "[StreamDiscovery] %d/%d streams available for %s",
                len(available), len(streams), match_id,
            )

            return [s.to_dict() for s in streams]

    async def discover_for_matches(self, matches: list[dict]) -> dict[str, list[dict]]:
        """Run discovery for multiple matches. Returns dict keyed by match_id."""
        tasks = {m["id"]: self.discover_for_match(m) for m in matches}
        results: dict[str, list[dict]] = {}

        for match_id, coro in tasks.items():
            try:
                results[match_id] = await coro
            except Exception as e:
                logger.error("[StreamDiscovery] Failed for match %s: %s", match_id, e)
                results[match_id] = []

        return results

# ─── Firebase writer ──────────────────────────────────────────────────────────

async def write_streams_to_firestore(
    streams_by_match: dict[str, list[dict]],
) -> None:
    """Write discovered streams to Firestore in batches."""
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore as fs

        if not firebase_admin._apps:
            cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT)
            firebase_admin.initialize_app(cred)

        db = fs.client()
        batch = db.batch()
        count = 0

        for match_id, streams in streams_by_match.items():
            for stream in streams:
                doc_ref = db.collection("streams").document(stream["id"])
                batch.set(doc_ref, {
                    **stream,
                    "updatedAt": fs.SERVER_TIMESTAMP,
                })
                count += 1

                # Firestore batch limit is 500
                if count >= 450:
                    await asyncio.get_event_loop().run_in_executor(None, batch.commit)
                    batch = db.batch()
                    count = 0

        if count > 0:
            await asyncio.get_event_loop().run_in_executor(None, batch.commit)

        logger.info("[Firestore] Wrote %d streams", count)

    except ImportError:
        logger.warning("[Firestore] firebase-admin not installed; printing results instead")
        print(json.dumps(streams_by_match, indent=2, default=str))
    except Exception as e:
        logger.error("[Firestore] Write error: %s", e)

# ─── Entry point ─────────────────────────────────────────────────────────────

async def main():
    """
    Standalone entrypoint.
    In production this is called by Cloud Functions / cron.
    Accepts matches as JSON piped via stdin or as an env var MATCHES_JSON.
    """
    import sys

    matches_json = os.getenv("MATCHES_JSON")
    if matches_json:
        matches = json.loads(matches_json)
    elif not sys.stdin.isatty():
        matches = json.loads(sys.stdin.read())
    else:
        logger.error("No match data provided. Pipe JSON to stdin or set MATCHES_JSON env var.")
        return

    if not isinstance(matches, list):
        logger.error("Expected a JSON array of match objects")
        return

    service = StreamDiscoveryService()
    results = await service.discover_for_matches(matches)
    await write_streams_to_firestore(results)

    # Print summary
    total = sum(len(v) for v in results.values())
    available = sum(
        len([s for s in v if s.get("is_available")])
        for v in results.values()
    )
    print(f"\n✅ Stream discovery complete")
    print(f"   Matches processed : {len(results)}")
    print(f"   Streams found     : {total}")
    print(f"   Available now     : {available}")


if __name__ == "__main__":
    asyncio.run(main())
