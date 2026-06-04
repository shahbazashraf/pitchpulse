"""
PitchPulse News Aggregation Service
=====================================
Fetches news from official RSS feeds: BBC Sport, Sky Sports, ESPN FC,
FIFA, UEFA. Parses, deduplicates, and writes to Firestore.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional
from xml.etree import ElementTree as ET

import aiohttp
from pydantic import BaseModel

from pathlib import Path
from dotenv import load_dotenv

# Load .env.local from project root
dotenv_path = Path(__file__).resolve().parents[3] / '.env.local'
load_dotenv(dotenv_path)

logger = logging.getLogger("news")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s - %(message)s")

FIREBASE_SERVICE_ACCOUNT = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
if FIREBASE_SERVICE_ACCOUNT.startswith("./"):
    FIREBASE_SERVICE_ACCOUNT = str(Path(__file__).resolve().parents[3] / FIREBASE_SERVICE_ACCOUNT[2:])

# ─── RSS Feed registry ────────────────────────────────────────────────────────

RSS_FEEDS: list[dict] = [
    {
        "id": "bbc_sport_football",
        "name": "BBC Sport Football",
        "url": "https://feeds.bbci.co.uk/sport/football/rss.xml",
        "language": "en",
        "logo": "https://static.bbci.co.uk/bbcx/colombo/assets/apple-touch-icon.png",
    },
    {
        "id": "sky_sports_football",
        "name": "Sky Sports Football",
        "url": "https://www.skysports.com/rss/12040",
        "language": "en",
        "logo": "https://e0.365dm.com/20/06/skysports-logo.png",
    },
    {
        "id": "espn_fc",
        "name": "ESPN FC",
        "url": "https://www.espn.com/espn/rss/soccer/news",
        "language": "en",
        "logo": "https://a.espncdn.com/i/espn/misc_logos/500/espn_fc.png",
    },
    {
        "id": "fifa_news",
        "name": "FIFA",
        "url": "https://inside.fifa.com/rss/news",
        "language": "en",
        "logo": "https://digitalhub.fifa.com/m/291e3a6ffe0dfc24/original/FIFA-Logo-White.png",
    },
    {
        "id": "uefa_news",
        "name": "UEFA",
        "url": "https://www.uefa.com/rss.xml",
        "language": "en",
        "logo": "https://www.uefa.com/imgml/misc/logos/uefa_logo.png",
    },
    {
        "id": "goal_com",
        "name": "Goal.com",
        "url": "https://www.goal.com/feeds/en/news",
        "language": "en",
        "logo": None,
    },
    {
        "id": "as_en",
        "name": "AS English",
        "url": "https://en.as.com/rss/football.rss",
        "language": "en",
        "logo": None,
    },
]

# ─── Models ───────────────────────────────────────────────────────────────────

class NewsArticle(BaseModel):
    id: str
    headline: str
    summary: str
    source: str
    sourceName: str
    sourceLogoUrl: Optional[str]
    author: Optional[str]
    imageUrl: Optional[str]
    url: str
    publishedAt: str
    tags: list[str]
    language: str = "en"

    @classmethod
    def stable_id(cls, url: str) -> str:
        return hashlib.sha256(url.encode()).hexdigest()[:20]

# ─── RSS Parser ───────────────────────────────────────────────────────────────

def parse_rss(xml_text: str, feed: dict) -> list[NewsArticle]:
    """Parse RSS 2.0 or Atom feed XML into NewsArticle objects."""
    articles: list[NewsArticle] = []

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.error("[RSS] Parse error for %s: %s", feed["id"], e)
        return []

    # RSS 2.0
    ns = {
        "media": "http://search.yahoo.com/mrss/",
        "dc": "http://purl.org/dc/elements/1.1/",
        "content": "http://purl.org/rss/1.0/modules/content/",
    }

    channel = root.find("channel")
    items = (channel or root).findall("item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")

    for item in items[:20]:  # cap at 20 per feed per run
        def get(tag: str, default: str = "") -> str:
            el = item.find(tag) or item.find(f"{{{tag}}}")
            return (el.text or "").strip() if el is not None else default

        def get_ns(ns_prefix: str, tag: str) -> Optional[str]:
            el = item.find(f"{ns.get(ns_prefix, '')}:{tag}", ns)
            if el is None:
                el = item.find(f"{{{ns.get(ns_prefix, '')}}}{tag}")
            return el.text.strip() if el is not None and el.text else None

        url = get("link") or get("guid")
        if not url or not url.startswith("http"):
            # Atom link
            link_el = item.find("{http://www.w3.org/2005/Atom}link")
            url = link_el.get("href", "") if link_el is not None else ""
        if not url:
            continue

        headline = get("title") or ""
        if not headline:
            headline = get("{http://www.w3.org/2005/Atom}title")
        headline = _strip_html(headline)

        summary = get("description") or get("{http://www.w3.org/2005/Atom}summary") or ""
        summary = _strip_html(summary)[:500]

        pub_date = get("pubDate") or get("{http://www.w3.org/2005/Atom}published") or ""
        published_at = _parse_date(pub_date)

        author = get_ns("dc", "creator") or get("author") or None

        # Image: try media:thumbnail, media:content, enclosure
        image_url: Optional[str] = None
        media_thumb = item.find("{http://search.yahoo.com/mrss/}thumbnail")
        if media_thumb is not None:
            image_url = media_thumb.get("url")
        if not image_url:
            media_content = item.find("{http://search.yahoo.com/mrss/}content")
            if media_content is not None:
                image_url = media_content.get("url")
        if not image_url:
            enclosure = item.find("enclosure")
            if enclosure is not None and "image" in (enclosure.get("type") or ""):
                image_url = enclosure.get("url")

        # Tags from categories
        categories = item.findall("category")
        tags = [c.text.strip() for c in categories if c.text]

        article = NewsArticle(
            id=NewsArticle.stable_id(url),
            headline=headline,
            summary=summary,
            source=feed["id"],
            sourceName=feed["name"],
            sourceLogoUrl=feed.get("logo"),
            author=author,
            imageUrl=image_url,
            url=url,
            publishedAt=published_at,
            tags=tags[:10],
            language=feed.get("language", "en"),
        )
        articles.append(article)

    return articles


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()


def _parse_date(date_str: str) -> str:
    """Parse various date formats to ISO 8601 UTC."""
    if not date_str:
        return datetime.now(timezone.utc).isoformat()
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(date_str)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        pass
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()

# ─── HTTP fetcher ─────────────────────────────────────────────────────────────

async def fetch_feed(session: aiohttp.ClientSession, feed: dict) -> list[NewsArticle]:
    try:
        async with session.get(
            feed["url"],
            timeout=aiohttp.ClientTimeout(total=15),
            headers={"User-Agent": "PitchPulse/1.0 (news-aggregator)"},
        ) as resp:
            resp.raise_for_status()
            text = await resp.text()
            return parse_rss(text, feed)
    except Exception as e:
        logger.warning("[News] Failed to fetch %s: %s", feed["id"], e)
        return []

# ─── Deduplication ────────────────────────────────────────────────────────────

def deduplicate(articles: list[NewsArticle]) -> list[NewsArticle]:
    seen_urls: set[str] = set()
    seen_headlines: set[str] = set()
    unique: list[NewsArticle] = []
    for a in articles:
        url_key = a.url.rstrip("/").lower()
        hl_key = re.sub(r"\s+", " ", a.headline.lower().strip())[:80]
        if url_key in seen_urls or hl_key in seen_headlines:
            continue
        seen_urls.add(url_key)
        seen_headlines.add(hl_key)
        unique.append(a)
    return unique

# ─── Firestore writer ─────────────────────────────────────────────────────────

async def write_to_firestore(articles: list[NewsArticle]) -> None:
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore as fs
        if not firebase_admin._apps:
            cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT)
            firebase_admin.initialize_app(cred)
        db = fs.client()

        loop = asyncio.get_event_loop()
        batch = db.batch()
        for i, article in enumerate(articles):
            ref = db.collection("articles").document(article.id)
            batch.set(ref, {
                **article.model_dump(),
                "updatedAt": fs.SERVER_TIMESTAMP,
            }, merge=True)
            if i > 0 and i % 450 == 0:
                await loop.run_in_executor(None, batch.commit)
                batch = db.batch()

        await loop.run_in_executor(None, batch.commit)
        logger.info("[News] Wrote %d articles to Firestore", len(articles))

    except ImportError:
        print(json.dumps([a.model_dump() for a in articles], indent=2))
    except Exception as e:
        logger.error("[Firestore] Write error: %s", e)

# ─── Main ─────────────────────────────────────────────────────────────────────

async def aggregate_news() -> list[NewsArticle]:
    logger.info("[News] Starting aggregation from %d feeds", len(RSS_FEEDS))

    async with aiohttp.ClientSession() as session:
        tasks = [fetch_feed(session, feed) for feed in RSS_FEEDS]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    all_articles: list[NewsArticle] = []
    for r in results:
        if isinstance(r, list):
            all_articles.extend(r)

    # Sort by date desc, deduplicate
    all_articles.sort(key=lambda a: a.publishedAt, reverse=True)
    unique = deduplicate(all_articles)

    logger.info("[News] Aggregated %d unique articles (from %d raw)", len(unique), len(all_articles))
    return unique


async def main():
    articles = await aggregate_news()
    await write_to_firestore(articles)
    print(f"Done: {len(articles)} articles synced")


if __name__ == "__main__":
    asyncio.run(main())
