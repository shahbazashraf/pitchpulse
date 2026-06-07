"""
Highlights sync service — crawls free highlight sources and writes to Firestore.

Sources:
  1. ReFooty (refooty.com) — extracts embedded YouTube IDs from HTML
  2. DasFootball (dasfootball.info) — same approach
  3. Official YouTube RSS feeds — FIFA, FOX Soccer, ESPN FC, BBC Sport
     (no API key required; standard Atom feeds)

Writes to Firestore collection: highlights
verified=True only for official YouTube channel entries.
"""

import asyncio
import hashlib
import json
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Optional

import aiohttp
from pydantic import BaseModel

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False


# ─── Data model ──────────────────────────────────────────────────────────────

class Highlight(BaseModel):
    id: str
    matchId: Optional[str] = None
    title: str
    competition: str = "FIFA World Cup"
    year: int
    thumbnail: Optional[str] = None
    duration: Optional[str] = None
    source: str          # "youtube" | "refooty" | "dasfootball" | "hoofoot"
    provider: str
    videoUrl: Optional[str] = None
    embedUrl: Optional[str] = None
    publishedAt: str
    verified: bool


# ─── YouTube official channels (no API key — RSS only) ───────────────────────

OFFICIAL_CHANNELS = [
    {"channel_id": "UCpc3RNxuN1vFMJxNwBlv8QA", "provider": "FIFA",        "competition": "FIFA World Cup"},
    {"channel_id": "UCj5RwDivLksanrNvkG2XLFA", "provider": "Fox Soccer",   "competition": "FIFA World Cup"},
    {"channel_id": "UCNAf1k0yIjyGu3k9BwAg3lg", "provider": "ESPN FC",      "competition": "FIFA World Cup"},
    {"channel_id": "UCi-hE8Exdg4PbrHJx4jnHcQ", "provider": "BBC Sport",    "competition": "FIFA World Cup"},
    {"channel_id": "UCBi2mrWuNuyYy4gbM6fU18Q", "provider": "UEFA",         "competition": "UEFA Champions League"},
]

SCRAPER_SOURCES = [
    {"url": "https://refooty.com/highlights/", "source": "refooty"},
    {"url": "https://www.dasfootball.info/",   "source": "dasfootball"},
]

YT_VIDEO_PATTERN = re.compile(r'youtube\.com/embed/([A-Za-z0-9_\-]{11})')
YT_WATCH_PATTERN = re.compile(r'youtube\.com/watch\?v=([A-Za-z0-9_\-]{11})')
TITLE_PATTERN    = re.compile(r'<title[^>]*>(.*?)</title>', re.IGNORECASE | re.DOTALL)


def stable_id(video_id: str) -> str:
    return hashlib.sha256(video_id.encode()).hexdigest()[:20]


def yt_thumbnail(video_id: str) -> str:
    return f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"


def yt_embed(video_id: str) -> str:
    return f"https://www.youtube.com/embed/{video_id}"


def guess_year(text: str) -> int:
    for year in ["2026", "2025", "2024", "2023", "2022", "2021", "2019", "2018"]:
        if year in text:
            return int(year)
    return datetime.now(timezone.utc).year


# ─── Official YouTube RSS scraper ─────────────────────────────────────────────

async def scrape_official_youtube(session: aiohttp.ClientSession) -> list[Highlight]:
    results: list[Highlight] = []
    ns = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}

    for ch in OFFICIAL_CHANNELS:
        url = f"https://www.youtube.com/feeds/videos.xml?channel_id={ch['channel_id']}"
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    continue
                text = await resp.text()
                root = ET.fromstring(text)

                for entry in root.findall("atom:entry", ns)[:20]:
                    video_id_el = entry.find("yt:videoId", ns)
                    title_el    = entry.find("atom:title", ns)
                    published_el = entry.find("atom:published", ns)

                    if video_id_el is None or title_el is None:
                        continue

                    video_id  = video_id_el.text or ""
                    title     = title_el.text or ""
                    published = published_el.text if published_el is not None else datetime.now(timezone.utc).isoformat()

                    # Filter: only include if it looks like a highlights/match video
                    low = title.lower()
                    if not any(kw in low for kw in ["highlight", "goal", "match", "final", "semi", "quarter", "vs", "v."]):
                        continue

                    year = guess_year(title + (published or ""))

                    results.append(Highlight(
                        id=stable_id(video_id),
                        title=title,
                        competition=ch["competition"],
                        year=year,
                        thumbnail=yt_thumbnail(video_id),
                        source="youtube",
                        provider=ch["provider"],
                        embedUrl=yt_embed(video_id),
                        publishedAt=published,
                        verified=True,
                    ))
        except Exception as e:
            print(f"[highlights] YouTube RSS error for {ch['provider']}: {e}")

    return results


# ─── Scraper-based sources ────────────────────────────────────────────────────

async def scrape_html_source(session: aiohttp.ClientSession, url: str, source: str) -> list[Highlight]:
    results: list[Highlight] = []
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                return []
            html = await resp.text()

        # Extract all embedded YouTube IDs from the page
        video_ids = set(YT_VIDEO_PATTERN.findall(html)) | set(YT_WATCH_PATTERN.findall(html))

        # Try to extract titles near each video ID (rough heuristic)
        titles = TITLE_PATTERN.findall(html)
        page_title = titles[0].strip() if titles else url

        for vid in list(video_ids)[:30]:
            year = guess_year(html)
            results.append(Highlight(
                id=stable_id(vid),
                title=f"Football Highlights – {source.title()} – {year}",
                competition="FIFA World Cup",
                year=year,
                thumbnail=yt_thumbnail(vid),
                source=source,
                provider=source.title(),
                embedUrl=yt_embed(vid),
                publishedAt=datetime.now(timezone.utc).isoformat(),
                verified=False,
            ))
    except Exception as e:
        print(f"[highlights] Scrape error for {source}: {e}")

    return results


# ─── Firestore write ──────────────────────────────────────────────────────────

def init_firebase() -> Optional[object]:
    if not FIREBASE_AVAILABLE:
        return None
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not sa_json:
        return None
    if not firebase_admin._apps:
        cred = credentials.Certificate(json.loads(sa_json))
        firebase_admin.initialize_app(cred)
    return firestore.client()


def write_highlights(db, highlights: list[Highlight]) -> int:
    if not highlights:
        return 0
    batch = db.batch()
    count = 0
    for h in highlights:
        ref = db.collection("highlights").document(h.id)
        batch.set(ref, h.model_dump(), merge=True)
        count += 1
        if count % 450 == 0:
            batch.commit()
            batch = db.batch()
    batch.commit()
    return count


# ─── Main orchestrator ────────────────────────────────────────────────────────

async def sync_highlights() -> None:
    seen_ids: set[str] = set()
    all_highlights: list[Highlight] = []

    async with aiohttp.ClientSession(headers={"User-Agent": "PitchPulseBot/1.0"}) as session:
        tasks = [
            scrape_official_youtube(session),
            *[scrape_html_source(session, s["url"], s["source"]) for s in SCRAPER_SOURCES],
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, Exception):
            print(f"[highlights] Task error: {result}")
            continue
        for h in result:
            if h.id not in seen_ids:
                seen_ids.add(h.id)
                all_highlights.append(h)

    print(f"[highlights] Collected {len(all_highlights)} unique highlights")

    db = init_firebase()
    if db:
        written = write_highlights(db, all_highlights)
        print(f"[highlights] Wrote {written} highlights to Firestore")
    else:
        print("[highlights] No Firebase — printing sample:")
        for h in all_highlights[:3]:
            print(f"  {h.title[:60]} ({h.year}) [{h.source}]")


if __name__ == "__main__":
    asyncio.run(sync_highlights())
