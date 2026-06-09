#!/usr/bin/env python3
"""
totalsportek_scraper.py — Stream scraper for totalsportek sites

Discovers live stream URLs from:
  - https://totalsportek.li/
  - https://totalsportek.ch/
  - https://totalsportek.tech/

Output:
  --output data/totalsportek_streams.json   (default)
  --output -                              (stdout)
  --firestore                             (write to Firestore streams collection)

Usage:
  python3 scripts/totalsportek_scraper.py
  python3 scripts/totalsportek_scraper.py --output -
  python3 scripts/totalsportek_scraper.py --live-only
  python3 scripts/totalsportek_scraper.py --firestore

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

# Supported domains
DOMAINS = ["totalsportek.li", "totalsportek.ch", "totalsportek.tech"]

# Regex patterns
MATCH_URL_PATTERN = re.compile(r'/game/[^/]+-vs-[^/]+/(\d+)/')
TEAM_PATTERN = re.compile(r'/game/([^/]+)-vs-([^/]+)/')
STREAM_IFRAME = re.compile(r'<iframe[^>]+src="([^"]+streamseast[^"]+)"', re.IGNORECASE)
STREAM_URL = re.compile(r'streamseast\.(?:pro|biz)/embed/(\d+)')
TITLE_PATTERN = re.compile(r'<title>([^<]+)</title>')
LIVE_INDICATOR = re.compile(r'\b(LIVE|Live|LIVE NOW)\b', re.IGNORECASE)


@dataclass
class StreamLink:
    id: str
    match_id: str
    title: str
    home_team: str
    away_team: str
    url: str
    embed_url: Optional[str]
    quality: str
    source: str
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


def parse_homepage(html: str, domain: str) -> list[str]:
    """Extract match URLs from homepage."""
    return list(dict.fromkeys(MATCH_URL_PATTERN.findall(html)))


def parse_match_page(html: str, page_url: str) -> Optional[StreamLink]:
    """Parse individual match page for stream info."""
    # Extract teams from URL
    team_match = TEAM_PATTERN.search(page_url)
    if not team_match:
        return None
    
    home_team = team_match.group(1).replace("-", " ").title()
    away_team = team_match.group(2).replace("-", " ").title()
    
    # Extract title
    title_m = TITLE_PATTERN.search(html)
    title = title_m.group(1).strip() if title_m else f"{home_team} vs {away_team}"
    
    # Check if live
    is_live = bool(LIVE_INDICATOR.search(html))
    
    # Find stream embed URL
    embed_m = STREAM_IFRAME.search(html)
    embed_url = embed_m.group(1) if embed_m else None
    
    # Construct full URL
    url = page_url
    
    # Generate match ID
    match_id = stable_id(page_url)
    
    return StreamLink(
        id=stable_id(embed_url or page_url),
        match_id=match_id,
        title=title,
        home_team=home_team,
        away_team=away_team,
        url=url,
        embed_url=embed_url,
        quality="HD",
        source="totalsportek",
        page_url=page_url,
        is_live=is_live,
    )


def scrape_domain(domain: str, max_pages: int = 5) -> list[StreamLink]:
    """Scrape a single totalsportek domain."""
    streams: list[StreamLink] = []
    base_url = f"https://{domain}"
    
    # Fetch homepage
    print(f"[totalsportek] Scraping {base_url}...", file=sys.stderr)
    html = fetch(base_url)
    if not html:
        return streams
    
    # Extract match URLs
    match_ids = parse_homepage(html, domain)
    print(f"[totalsportek] Found {len(match_ids)} matches on {domain}", file=sys.stderr)
    
    # Fetch each match page
    def fetch_match(match_id: str) -> Optional[StreamLink]:
        url = f"https://{domain}/game/{match_id}"
        html = fetch(url)
        if html:
            return parse_match_page(html, url)
        return None
    
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch_match, mid): mid for mid in match_ids}
        for future in as_completed(futures):
            result = future.result()
            if result:
                streams.append(result)
    
    return streams


def scrape_all(domains: list[str] = None, live_only: bool = False) -> list[StreamLink]:
    """Scrape all configured domains."""
    domains = domains or DOMAINS
    all_streams: list[StreamLink] = []
    
    with ThreadPoolExecutor(max_workers=len(domains)) as pool:
        futures = {pool.submit(scrape_domain, d): d for d in domains}
        for future in as_completed(futures):
            domain = futures[future]
            try:
                streams = future.result()
                if live_only:
                    streams = [s for s in streams if s.is_live]
                all_streams.extend(streams)
                print(f"[totalsportek] {domain}: {len(streams)} streams", file=sys.stderr)
            except Exception as e:
                print(f"[totalsportek] Error scraping {domain}: {e}", file=sys.stderr)
    
    return all_streams


def write_to_firestore(streams: list[StreamLink], sa_path: Optional[str] = None) -> int:
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore as fs
    except ImportError:
        print("[totalsportek] firebase-admin not installed", file=sys.stderr)
        return 0
    
    if not firebase_admin._apps:
        if sa_path:
            cred = credentials.Certificate(sa_path)
        else:
            sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
            if not sa_json:
                print("[totalsportek] No credentials provided", file=sys.stderr)
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
            "title": s.title,
            "homeTeam": s.home_team,
            "awayTeam": s.away_team,
            "url": s.url,
            "embedUrl": s.embed_url,
            "streamType": "live" if s.is_live else "replay",
            "quality": s.quality,
            "source": s.source,
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
    parser = argparse.ArgumentParser(description="Scrape totalsportek streams")
    parser.add_argument("--domains", type=str, nargs="+",
                        help="Domains to scrape (default: all)")
    parser.add_argument("--output", type=str, default="data/totalsportek_streams.json",
                        help="Output path or - for stdout")
    parser.add_argument("--firestore", action="store_true",
                        help="Write results to Firestore")
    parser.add_argument("--service-account", type=str, metavar="PATH",
                        help="Path to Firebase service account JSON")
    parser.add_argument("--live-only", action="store_true",
                        help="Only return live streams")
    args = parser.parse_args()
    
    domains = args.domains or DOMAINS
    streams = scrape_all(domains=domains, live_only=args.live_only)
    
    output_data = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "total": len(streams),
        "domains": domains,
        "streams": [asdict(s) for s in streams],
    }
    
    if args.output == "-":
        print(json.dumps(output_data, indent=2, ensure_ascii=False))
    else:
        out_path = args.output
        os.makedirs(os.path.dirname(out_path) if os.path.dirname(out_path) else ".", exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        print(f"[totalsportek] Saved to {out_path}", file=sys.stderr)
    
    if args.firestore:
        written = write_to_firestore(streams, sa_path=args.service_account)
        print(f"[totalsportek] Wrote {written} docs to Firestore", file=sys.stderr)
    
    print(f"\n{'='*50}", file=sys.stderr)
    print(f"Total: {len(streams)} streams", file=sys.stderr)
    live_count = sum(1 for s in streams if s.is_live)
    print(f"Live: {live_count}", file=sys.stderr)


if __name__ == "__main__":
    main()