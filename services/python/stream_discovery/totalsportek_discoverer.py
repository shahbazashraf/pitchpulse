"""
Totalsportek Discoverer for Stream Discovery Service
====================================================
Discovers live streams from totalsportek domains.
"""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import aiohttp

from .service import BaseDiscoverer, StreamResult, HttpClient

logger = logging.getLogger("stream_discovery.totalsportek")

# Totalsportek domains
DOMAINS = ["totalsportek.li", "totalsportek.ch", "totalsportek.tech"]

# Patterns
MATCH_URL_PATTERN = re.compile(r"/game/[^/]+-vs-[^/]+/(\d+)/")
TEAM_PATTERN = re.compile(r"/game/([^/]+)-vs-([^/]+)/")
STREAM_IFRAME = re.compile(r'<iframe[^>]+src="([^"]+streamseast[^"]+)"', re.IGNORECASE)
LIVE_INDICATOR = re.compile(r"\b(LIVE|Live|LIVE NOW)\b", re.IGNORECASE)
TITLE_PATTERN = re.compile(r"<title>([^<]+)</title>")


class TotalsportekDiscoverer(BaseDiscoverer):
    """
    Discovers streams from totalsportek sites.
    These sites aggregate official broadcaster streams.
    """
    name = "totalsportek"

    def __init__(self, client: HttpClient):
        super().__init__(client)
        self.domains = DOMAINS

    async def discover(self, match: dict) -> list[StreamResult]:
        """Discover streams for a specific match."""
        match_id = match.get("id", "unknown")
        home = match.get("homeTeam", {}).get("name", "")
        away = match.get("awayTeam", {}).get("name", "")

        results: list[StreamResult] = []

        # Build search URL for the match
        for domain in self.domains:
            # Try to find the match page
            search_url = f"https://{domain}/"
            try:
                html = await self.client.get(search_url, return_text=True)
                if not html:
                    continue

                # Find match URLs
                match_urls = self._extract_match_urls(html, domain)
                for url in match_urls:
                    stream = await self._parse_match_page(url, match_id, home, away)
                    if stream:
                        results.append(stream)

            except Exception as e:
                logger.warning("[Totalsportek] Error scraping %s: %s", domain, e)

        return results

    def _extract_match_urls(self, html: str, domain: str) -> list[str]:
        """Extract match URLs from homepage."""
        urls = []
        for m in MATCH_URL_PATTERN.finditer(html):
            match_id = m.group(1)
            urls.append(f"https://{domain}/game/{match_id}")
        return list(dict.fromkeys(urls))

    async def _parse_match_page(self, url: str, match_id: str, home: str, away: str) -> Optional[StreamResult]:
        """Parse a match page for stream info."""
        try:
            html = await self.client.get(url, return_text=True)
            if not html:
                return None

            # Check if live
            is_live = bool(LIVE_INDICATOR.search(html))

            # Extract title
            title_m = TITLE_PATTERN.search(html)
            title = title_m.group(1).strip() if title_m else f"{home} vs {away} Live Stream"

            # Find stream embed URL
            embed_m = STREAM_IFRAME.search(html)
            embed_url = embed_m.group(1) if embed_m else None

            # Extract teams from URL
            team_m = TEAM_PATTERN.search(url)
            if team_m:
                page_home = team_m.group(1).replace("-", " ").title()
                page_away = team_m.group(2).replace("-", " ").title()
            else:
                page_home = home
                page_away = away

            return self._make_stream(
                match_id=match_id,
                broadcaster="Totalsportek",
                broadcaster_id="totalsportek",
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
            logger.warning("[Totalsportek] Error parsing %s: %s", url, e)
            return None