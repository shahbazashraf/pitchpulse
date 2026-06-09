#!/usr/bin/env python3
"""
streamseast_scraper.py — Stream scraper for streamseast sites

Discovers live stream URLs from:
  - https://streamseast.pro/
  - https://streamseast.biz/

Output:
  --output data/streamseast_streams.json   (default)
  --output -                              (stdout)
  --firestore                             (write to Firestore streams collection)

Usage:
  python3 scripts/streamseast_scraper.py
  python3 scripts/streamseast_scraper.py --output -
  python3 scripts/streamseast_scraper.py --live-only

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
DOMAINS = ["streamseast.pro", "streamseast.biz"]

# Regex patterns
MATCH_CARD_PATTERN = re.compile(r'<a[^>]+href="(/[^"]+)"[^>]*class="[^"]*match[^"]*"', re.IGNORECASE)
LIVE_BADGE = re.compile(r'\b(LIVE|Live|LIVE NOW)\b', re.IGNORECASE)
STREAM_IFRAME = re.compile(r'<iframe[^>]+src="([^"]+)"', re.IGNORECASE)
TEAM_NAME = re.compile(r'(?:<span[^>]*class="[^"]*team[^"]*"[^>]*>([^<]+)</span>|/([a-zA-Z]+)-vs-([a-zA-Z]+))', re.IGNORECASE)
TITLE_PATTERN = re.compile(r'<title>([^<]+)</title>')


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


def parse_category_page(html: str, domain: str) -> list[str]:
    """Extract match URLs from category page (e.g., /soccer)."""
    # Look for match links
    matches = []
    for m in MATCH_CARD_PATTERN.finditer(html):
        path = m.group(1)
        if path.startswith("/"):
            matches.append(f"https://{domain}{path}")
    return list(dict.fromkeys(matches))


def parse_match_page(html: str, page_url: str) -> Optional[StreamLink]:
    """Parse individual match page for stream info."""
    # Check if live
    is_live = bool(LIVE_BADGE.search(html))
    
    # Extract title
    title_m = TITLE_PATTERN.search(html)
    title = title_m.group(1).strip() if title_m else "Live Stream"
    
    # Find stream iframe
    embed_m = STREAM_IFRAME.search(html)
    embed_url = embed_m.group(1) if embed_m else None
    
    # Make embed URL absolute
    if embed_url and embed_url.startswith("/"):
        embed_url = f"https://streamseast.pro{embed_url}"
    
    # Extract teams from page
    home_team = "Unknown"
    away_team = "Unknown"
    
    # Try to find team names in the page
    team_spans = re.findall(r'<span[^>]*class="[^"]*team[^"]*"[^>]*>([^<]+)</span>', html, re.IGNORECASE)
    if len(team_spans) >= 2:
        home_team = team_spans[0].strip()
        away_team = team_spans[1].strip()
    else:
        # Try URL pattern
        url_teams = re.search(r'/([a-zA-Z]+)-vs-([a-zA-Z]+)', page_url)
        if url_teams:
            home_team = url_teams.group(1).replace("-", " ").title()
            away_team = url_teams.group(2).replace("-", " ").title()
    
    return StreamLink(
        id=stable_id(embed_url or page_url),
        match_id=stable_id(page_url),
        title=title,
        home_team=home_team,
        away_team=away_team,
        url=page_url,
        embed_url=embed_url,
        quality="HD",
        source="streamseast",
        page_url=page_url,
        is_live=is_live,
    )


def scrape_domain(domain: str) -> list[StreamLink]:
    """Scrape a single streamseast domain."""
    streams: list[StreamLink] = []
    base_url = f"https://{domain}"
    
    # Fetch soccer category page
    print(f"[streamseast] Scraping {base_url}/soccer...", file=sys.stderr)
    html = fetch(f"{base_url}/soccer")
    if not html:
        return streams
    
    # Extract match URLs
    match_urls = parse_category_page(html, domain)
    print(f"[streamseast] Found {len(match_urls)} matches on {domain}", file=sys.stderr)
    
    # Fetch each match page
    def fetch_match(url: str) -> Optional[StreamLink]:
        html = fetch(url)
        if html:
            return parse_match_page(html, url)
        return None
    
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch_match, url): url for url in match_urls}
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
                print(f"[streamseast] {domain}: {len(streams)} streams", file=sys.stderr)
            except Exception as e:
                print(f"[streamseast] Error scraping {domain}: {e}", file=sys.stderr)
    
    return all_streams


def write_to_firestore(streams: list[StreamLink], sa_path: Optional[str] = None) -> int:
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore as fs
    except ImportError:
        print("[streamseast] firebase-admin not installed", file=sys.stderr)
        return 0
    
    if not firebase_admin._apps:
        if sa_path:
            cred = credentials.Certificate(sa_path)
        else:
            sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
            if not sa_json:
                print("[streamseast] No credentials provided", file=sys.stderr)
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
    parser = argparse.ArgumentParser(description="Scrape streamseast streams")
    parser.add_argument("--domains", type=str, nargs="+",
                        help="Domains to scrape (default: all)")
    parser.add_argument("--output", type=str, default="data/streamseast_streams.json",
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
        print(f"[streamseast] Saved to {out_path}", file=sys.stderr)
    
    if args.firestore:
        written = write_to_firestore(streams, sa_path=args.service_account)
        print(f"[streamseast] Wrote {written} docs to Firestore", file=sys.stderr)
    
    print(f"\n{'='*50}", file=sys.stderr)
    print(f"Total: {len(streams)} streams", file=sys.stderr)
    live_count = sum(1 for s in streams if s.is_live)
    print(f"Live: {live_count}", file=sys.stderr)


if __name__ == "__main__":
    main()