"""
Streamseast Discoverer for Stream Discovery Service
====================================================
Discovers live streams from streamseast domains.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

import aiohttp

from .service import BaseDiscoverer, StreamResult, HttpClient

logger = logging.getLogger("stream_discovery.streamseast")

# Streamseast domains
DOMAINS = ["streamseast.pro", "streamseast.biz"]

# Patterns
MATCH_CARD_PATTERN = re.compile(r'<a[^>]+href="(/[^"]+)"[^>]*class="[^"]*match[^"]*"', re.IGNORECASE)
LIVE_BADGE = re.compile(r"\b(LIVE|Live|LIVE NOW)\b", re.IGNORECASE)
STREAM_IFRAME = re.compile(r'<iframe[^>]+src="([^"]+)"', re.IGNORECASE)
TITLE_PATTERN = re.compile(r"<title>([^<]+)</title>")


class StreamseastDiscoverer(BaseDiscoverer):
    """
    Discovers streams from streamseast sites.
    These sites aggregate official broadcaster streams.
    """
    name = "streamseast"

    def __init__(self, client: HttpClient):
        super().__init__(client)
        self.domains = DOMAINS

    async def discover(self, match: dict) -> list[StreamResult]:
        """Discover streams for a specific match."""
        match_id = match.get("id", "unknown")
        home = match.get("homeTeam", {}).get("name", "")
        away = match.get("awayTeam", {}).get("name", "")

        results: list[StreamResult] = []

        for domain in self.domains:
            try:
                streams = await self._scrape_domain(domain, match_id, home, away)
                results.extend(streams)
            except Exception as e:
                logger.warning("[Streamseast] Error scraping %s: %s", domain, e)

        return results

    async def _scrape_domain(self, domain: str, match_id: str, home: str, away: str) -> list[StreamResult]:
        """Scrape a single streamseast domain."""
        streams: list[StreamResult] = []
        base_url = f"https://{domain}"

        # Fetch soccer category page
        url = f"{base_url}/soccer"
        html = await self.client.get(url, return_text=True)
        if not html:
            return streams

        # Extract match URLs
        match_urls = self._extract_match_urls(html, domain)
        logger.info("[Streamseast] Found %d matches on %s", len(match_urls), domain)

        for match_url in match_urls:
            stream = await self._parse_match_page(match_url, match_id, home, away)
            if stream:
                streams.append(stream)

        return streams

    def _extract_match_urls(self, html: str, domain: str) -> list[str]:
        """Extract match URLs from category page."""
        urls = []
        for m in MATCH_CARD_PATTERN.finditer(html):
            path = m.group(1)
            if path.startswith("/"):
                urls.append(f"https://{domain}{path}")
        return list(dict.fromkeys(urls))

    async def _parse_match_page(self, url: str, match_id: str, home: str, away: str) -> Optional[StreamResult]:
        """Parse a match page for stream info."""
        try:
            html = await self.client.get(url, return_text=True)
            if not html:
                return None

            # Check if live
            is_live = bool(LIVE_BADGE.search(html))

            # Extract title
            title_m = TITLE_PATTERN.search(html)
            title = title_m.group(1).strip() if title_m else f"{home} vs {away} Live Stream"

            # Find stream iframe
            embed_m = STREAM_IFRAME.search(html)
            embed_url = embed_m.group(1) if embed_m else None

            # Extract teams from URL
            team_m = re.search(r"/([a-zA-Z]+)-vs-([a-zA-Z]+)", url)
            if team_m:
                page_home = team_m.group(1).replace("-", " ").title()
                page_away = team_m.group(2).replace("-", " ").title()
            else:
                page_home = home
                page_away = away

            return self._make_stream(
                match_id=match_id,
                broadcaster="Streamseast",
                broadcaster_id="streamseast",
                title=title,
                url=url,
                embed_url=embed_url,
                stream_type="live" if is_live else "replay",
                quality="HD",
                language="en",
                region=[],
                is_official=True,
                is_free=True,
                is_available=is_live,
                platform="web",
                thumbnail_url=None,
            )

        except Exception as e:
            logger.warning("[Streamseast] Error parsing %s: %s", url, e)
            return None