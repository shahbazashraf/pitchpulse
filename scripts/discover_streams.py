#!/usr/bin/env python3
"""
discover_streams.py — Unified Stream Discovery Script

Discovers live streams from multiple sources:
  - streamseast.pro/biz (PRIMARY - higher priority)
  - totalsportek.li/ch/tech (FALLBACK)

Output:
  --output data/streams.json   (default)
  --output -                  (stdout)
  --firestore                 (write to Firestore)

Usage:
  python3 scripts/discover_streams.py
  python3 scripts/discover_streams.py --output -
  python3 scripts/discover_streams.py --live-only
  python3 scripts/discover_streams.py --firestore

Requires:
  pip install curl_cffi
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from curl_cffi import requests as cf

# Primary source (higher priority)
PRIMARY_DOMAINS = ["streamseast.pro", "streamseast.biz"]
# Fallback source
FALLBACK_DOMAINS = ["totalsportek.li", "totalsportek.ch", "totalsportek.tech"]

# Patterns for streamseast
MATCH_CARD_PATTERN = re.compile(r'<a[^>]+href="(/[^"]+)"[^>]*class="[^"]*match[^"]*"', re.IGNORECASE)
LIVE_BADGE = re.compile(r"\b(LIVE|Live|LIVE NOW)\b", re.IGNORECASE)
STREAM_IFRAME = re.compile(r'<iframe[^>]+src="([^"]+)"', re.IGNORECASE)
TITLE_PATTERN = re.compile(r"<title>([^<]+)</title>")

# Patterns for totalsportek
TOTAL_MATCH_PATTERN = re.compile(r"/game/[^/]+-vs-[^/]+/(\d+)/")
TOTAL_TEAM_PATTERN = re.compile(r"/game/([^/]+)-vs-([^/]+)/")
TOTAL_EMBED_PATTERN = re.compile(r'<iframe[^>]+src="([^"]+streamseast[^"]+)"', re.IGNORECASE)


@dataclass
class StreamLink:
    id: str
    match_id: str
    title: str
    home_team: str
    away_team: str
    competition: str
    url: str
    embed_url: Optional[str]
    quality: str
    source: str
    priority: int  # 1 = primary, 2 = fallback
    page_url: str
    is_live: bool
    scraped_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


_session = cf.Session(impersonate="chrome")


def stable_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:20]


def fetch(url: str) -> Optional[str]:
    try:
        r = _session.get(url, timeout=20)
        if r.status_code == 200:
            return r.text
        print(f"  [WARN] {r.status_code} for {url}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  [ERR] {url}: {e}", file=sys.stderr)
        return None


# ─── Streamseast Scraper ─────────────────────────────────────────────────────

def scrape_streamseast(domain: str, live_only: bool = False) -> list[StreamLink]:
    """Scrape streamseast domain for live streams."""
    streams: list[StreamLink] = []
    base_url = f"https://{domain}"
    
    print(f"[streamseast] Scraping {base_url}/soccer...", file=sys.stderr)
    html = fetch(f"{base_url}/soccer")
    if not html:
        return streams
    
    # Extract match URLs
    match_urls = []
    for m in MATCH_CARD_PATTERN.finditer(html):
        path = m.group(1)
        if path.startswith("/"):
            match_urls.append(f"https://{domain}{path}")
    
    print(f"[streamseast] Found {len(match_urls)} matches", file=sys.stderr)
    
    for url in match_urls:
        html = fetch(url)
        if not html:
            continue
        
        is_live = bool(LIVE_BADGE.search(html))
        if live_only and not is_live:
            continue
        
        title_m = TITLE_PATTERN.search(html)
        title = title_m.group(1).strip() if title_m else "Live Stream"
        
        # Try to find iframe embed, otherwise use page URL as embed
        embed_m = STREAM_IFRAME.search(html)
        embed_url = embed_m.group(1) if embed_m else url  # Use page URL as embed
        
        # Extract teams from URL
        team_m = re.search(r"/([a-zA-Z]+)-vs-([a-zA-Z]+)", url)
        home = team_m.group(1).replace("-", " ").title() if team_m else "Unknown"
        away = team_m.group(2).replace("-", " ").title() if team_m else "Unknown"
        
        streams.append(StreamLink(
            id=stable_id(embed_url),
            match_id=stable_id(url),
            title=title,
            home_team=home,
            away_team=away,
            competition="Soccer",
            url=url,
            embed_url=embed_url,
            quality="HD",
            source="streamseast",
            priority=1,
            page_url=url,
            is_live=is_live,
        ))
    
    return streams


# ─── Totalsportek Scraper ──────────────────────────────────────────────────────

def scrape_totalsportek(domain: str, live_only: bool = False) -> list[StreamLink]:
    """Scrape totalsportek domain for live streams."""
    streams: list[StreamLink] = []
    base_url = f"https://{domain}"
    
    print(f"[totalsportek] Scraping {base_url}...", file=sys.stderr)
    html = fetch(base_url)
    if not html:
        return streams
    
    # Extract match URLs
    match_ids = list(dict.fromkeys(TOTAL_MATCH_PATTERN.findall(html)))
    print(f"[totalsportek] Found {len(match_ids)} matches", file=sys.stderr)
    
    for match_id in match_ids:
        url = f"https://{domain}/game/{match_id}"
        html = fetch(url)
        if not html:
            continue
        
        is_live = bool(LIVE_BADGE.search(html))
        if live_only and not is_live:
            continue
        
        title_m = TITLE_PATTERN.search(html)
        title = title_m.group(1).strip() if title_m else "Live Stream"
        
        embed_m = TOTAL_EMBED_PATTERN.search(html)
        embed_url = embed_m.group(1) if embed_m else None
        
        # Extract teams from URL
        team_m = TOTAL_TEAM_PATTERN.search(url)
        home = team_m.group(1).replace("-", " ").title() if team_m else "Unknown"
        away = team_m.group(2).replace("-", " ").title() if team_m else "Unknown"
        
        streams.append(StreamLink(
            id=stable_id(embed_url or url),
            match_id=stable_id(url),
            title=title,
            home_team=home,
            away_team=away,
            competition="Football",
            url=url,
            embed_url=embed_url,
            quality="HD",
            source="totalsportek",
            priority=2,
            page_url=url,
            is_live=is_live,
        ))
    
    return streams


# ─── Main Orchestrator ─────────────────────────────────────────────────────────

def discover_all(live_only: bool = False) -> list[StreamLink]:
    """Run all scrapers and return deduplicated results."""
    all_streams: list[StreamLink] = []
    
    # Run primary sources (streamseast)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(scrape_streamseast, d, live_only): d for d in PRIMARY_DOMAINS}
        for future in as_completed(futures):
            try:
                streams = future.result()
                all_streams.extend(streams)
                print(f"[main] streamseast: {len(streams)} streams", file=sys.stderr)
            except Exception as e:
                print(f"[main] Error: {e}", file=sys.stderr)
    
    # Run fallback sources (totalsportek) only if no primary results
    if not all_streams or len(all_streams) < 5:
        print("[main] Running fallback sources...", file=sys.stderr)
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = {pool.submit(scrape_totalsportek, d, live_only): d for d in FALLBACK_DOMAINS}
            for future in as_completed(futures):
                try:
                    streams = future.result()
                    all_streams.extend(streams)
                    print(f"[main] totalsportek: {len(streams)} streams", file=sys.stderr)
                except Exception as e:
                    print(f"[main] Error: {e}", file=sys.stderr)
    
    # Deduplicate by embed_url (prefer priority 1)
    seen: dict[str, StreamLink] = {}
    for s in all_streams:
        key = s.embed_url or s.url
        if key not in seen or s.priority < seen[key].priority:
            seen[key] = s
    
    return sorted(seen.values(), key=lambda x: (x.priority, -x.is_live))


def write_to_firestore(streams: list[StreamLink], sa_path: Optional[str] = None) -> int:
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore as fs
    except ImportError:
        print("[firestore] firebase-admin not installed", file=sys.stderr)
        return 0
    
    if not firebase_admin._apps:
        if sa_path:
            cred = credentials.Certificate(sa_path)
        else:
            sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
            if not sa_json:
                print("[firestore] No credentials provided", file=sys.stderr)
                return 0
            cred = credentials.Certificate(json.loads(sa_json))
        firebase_admin.initialize_app(cred)
    
    db = fs.client()
    batch = db.batch()
    count = 0
    
    for s in streams:
        doc = {
            "id": s.id,
            "matchId": s.match_id,
            "homeTeam": s.home_team,
            "awayTeam": s.away_team,
            "competition": s.competition,
            "title": s.title,
            "url": s.url,
            "embedUrl": s.embed_url,
            "streamType": "live" if s.is_live else "replay",
            "quality": s.quality,
            "source": s.source,
            "priority": s.priority,
            "isLive": s.is_live,
            "isOfficial": True,
            "isFree": True,
            "isAvailable": s.is_live,
            "scrapedAt": s.scraped_at,
        }
        ref = db.collection("streams").document(s.id)
        batch.set(ref, doc, merge=True)
        count += 1
        if count % 450 == 0:
            batch.commit()
            batch = db.batch()
    
    batch.commit()
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Unified stream discovery")
    parser.add_argument("--output", type=str, default="data/streams.json",
                        help="Output path or - for stdout")
    parser.add_argument("--firestore", action="store_true",
                        help="Write results to Firestore")
    parser.add_argument("--service-account", type=str, metavar="PATH",
                        help="Path to Firebase service account JSON")
    parser.add_argument("--live-only", action="store_true",
                        help="Only return live streams")
    args = parser.parse_args()
    
    streams = discover_all(live_only=args.live_only)
    
    output_data = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "total": len(streams),
        "primary_sources": list(PRIMARY_DOMAINS),
        "fallback_sources": list(FALLBACK_DOMAINS),
        "streams": [asdict(s) for s in streams],
    }
    
    if args.output == "-":
        print(json.dumps(output_data, indent=2, ensure_ascii=False))
    else:
        out_path = args.output
        os.makedirs(os.path.dirname(out_path) if os.path.dirname(out_path) else ".", exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        print(f"[main] Saved to {out_path}", file=sys.stderr)
    
    if args.firestore:
        written = write_to_firestore(streams, sa_path=args.service_account)
        print(f"[main] Wrote {written} docs to Firestore", file=sys.stderr)
    
    print(f"\n{'='*50}", file=sys.stderr)
    print(f"Total: {len(streams)} streams", file=sys.stderr)
    live_count = sum(1 for s in streams if s.is_live)
    print(f"Live: {live_count}", file=sys.stderr)
    print(f"Primary: {sum(1 for s in streams if s.priority == 1)}", file=sys.stderr)
    print(f"Fallback: {sum(1 for s in streams if s.priority == 2)}", file=sys.stderr)


if __name__ == "__main__":
    main()