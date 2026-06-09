#!/usr/bin/env python3
"""
scrape_matches.py — Match-centric scraper for PitchPulse

Produces one document per match with full metadata + list of stream links.
Primary source:  streamseast.biz / streamseast.pro
Fallback streams: totalsportek.li / totalsportek.ch / totalsportek.tech

Output JSON per match:
  id, title, home_team, away_team, competition,
  status (NS|LIVE|FT), score {home, away}|null, minute|null,
  start_time (ISO)|null, is_live,
  streams [{url, embed_url, quality, source, priority}],
  scraped_at

Firestore collection: scraped_matches

Usage:
  python3 scripts/scrape_matches.py
  python3 scripts/scrape_matches.py --output -
  python3 scripts/scrape_matches.py --live-only
  python3 scripts/scrape_matches.py --firestore
  python3 scripts/scrape_matches.py --firestore --service-account /path/to/sa.json

Requires: curl_cffi, beautifulsoup4, firebase-admin (optional)
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

from bs4 import BeautifulSoup
from curl_cffi import requests as cf

# ─── Config ───────────────────────────────────────────────────────────────────

PRIMARY_DOMAINS = ["streamseast.biz", "streamseast.pro"]
TOTAL_DOMAINS   = ["totalsportek.li", "totalsportek.ch", "totalsportek.tech"]

HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
}

# ─── Data models ───────────────────────────────────────────────────────────────

@dataclass
class StreamLink:
    url: str
    embed_url: Optional[str]
    quality: str
    source: str
    priority: int  # 1 = primary (streamseast), 2 = fallback (totalsportek)


@dataclass
class ScrapedMatch:
    id: str
    title: str
    home_team: str
    away_team: str
    competition: str
    status: str          # NS | LIVE | FT
    score: Optional[dict]     # {"home": int, "away": int} or None
    minute: Optional[str]     # "67" | "45+2" | None
    start_time: Optional[str] # ISO8601 | None
    is_live: bool
    streams: list
    scraped_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ─── HTTP session ─────────────────────────────────────────────────────────────

_session = cf.Session(impersonate="chrome110")


def fetch(url: str, timeout: int = 25) -> Optional[str]:
    try:
        r = _session.get(url, timeout=timeout, headers=HEADERS)
        if r.status_code == 200:
            return r.text
        print(f"  [WARN] HTTP {r.status_code}: {url}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  [ERR] {url}: {e}", file=sys.stderr)
        return None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def match_id(home: str, away: str, date: str) -> str:
    key = f"{home.lower().strip()}:{away.lower().strip()}:{date}"
    return hashlib.sha256(key.encode()).hexdigest()[:20]


def teams_from_url(url: str) -> tuple[str, str]:
    """Extract team names from URL slug like /iraq-vs-venezuela or /iraq-vs-venezuela/."""
    m = re.search(r'/([a-z0-9][a-z0-9-]*)-vs-([a-z0-9][a-z0-9-]*)(?:/|$|\?)', url, re.IGNORECASE)
    if m:
        home = re.sub(r'-+', ' ', m.group(1)).strip().title()
        away = re.sub(r'-+', ' ', m.group(2)).strip().title()
        return home, away
    return "Unknown", "Unknown"


def parse_score(text: str) -> Optional[dict]:
    """Parse '2 - 1', '2:1', '2-1' → {"home": 2, "away": 1}."""
    m = re.search(r'(?<!\d)(\d{1,3})\s*[-:]\s*(\d{1,3})(?!\d)', text)
    if m:
        h, a = int(m.group(1)), int(m.group(2))
        # Sanity-check: reject suspiciously high scores (likely IDs)
        if h <= 20 and a <= 20:
            return {"home": h, "away": a}
    return None


def parse_minute(text: str) -> Optional[str]:
    """Extract match minute: '45+2\'' or '67\'' → '45+2' or '67'."""
    m = re.search(r"(\d{1,3}(?:\+\d+)?)'", text)
    return m.group(1) if m else None


def clean_iframe_src(src: str, base_domain: str) -> Optional[str]:
    """Normalise iframe src to absolute URL, skip obvious non-stream URLs."""
    if not src or not src.strip():
        return None
    src = src.strip()
    if src.startswith("//"):
        src = "https:" + src
    elif src.startswith("/"):
        src = f"https://{base_domain}{src}"
    elif not src.startswith("http"):
        return None
    # Skip ads/analytics
    if re.search(r'(googlesyndication|doubleclick|googletagmanager|facebook\.com|twitter\.com|'
                 r'google-analytics|adsbygoogle|youtube\.com/embed)', src, re.IGNORECASE):
        return None
    return src


# ─── Streamseast listing page parser ─────────────────────────────────────────

def parse_listing_page(html: str, domain: str) -> list[dict]:
    """
    Parse streamseast /soccer listing page.
    Returns list of dicts with url + teams + competition (minimal).
    Metadata (score/status/minute) is parsed from the detail page.
    """
    soup = BeautifulSoup(html, "html.parser")
    seen_urls: dict[str, dict] = {}

    for a_tag in soup.find_all("a", href=re.compile(r'/soccer/\d+/', re.IGNORECASE)):
        href = a_tag.get("href", "").strip()
        if not href:
            continue
        page_url = f"https://{domain}{href}" if href.startswith("/") else href
        if page_url in seen_urls:
            continue

        home, away = teams_from_url(href)
        competition = _guess_competition(a_tag)

        seen_urls[page_url] = {
            "url": page_url,
            "home_team": home,
            "away_team": away,
            "competition": competition,
        }

    return list(seen_urls.values())


def _guess_competition(a_tag) -> str:
    """Try to find a competition / league label near the match anchor."""
    node = a_tag
    for _ in range(10):
        node = node.parent
        if node is None or node.name in ("body", "html"):
            break
        prev = node.find_previous_sibling()
        if prev:
            text = prev.get_text(strip=True)
            if text and 3 < len(text) < 70 and not re.search(r'\d+[-:]\d+', text):
                if not re.search(r'^(live|stream|watch|today|upcoming|all|match|game)$', text, re.IGNORECASE):
                    return text[:60]
    return "Football"


def parse_detail_page(html: str, page_url: str) -> dict:
    """
    Parse streamseast match detail page for accurate metadata.
    mph-scoreline text patterns:
      NS   → "vs"
      LIVE → "1st Half:23'0-0" | "2nd Half:67'2-1" | "HT0-0"
      FT   → "FT2-1" | "AET2-1"
      CANC → "Canceled0-0" | "Postponed"
    Returns dict with status, score, minute, start_time, is_live, streams (iframes).
    """
    soup = BeautifulSoup(html, "html.parser")
    domain = re.search(r'https?://([^/]+)', page_url)
    base = domain.group(1) if domain else "streamseast.biz"

    # ── Title extraction for cleaner team names ──
    title_el = soup.find("title")
    title_text = title_el.get_text(strip=True) if title_el else ""

    # ── Scoreline parsing ──
    sl_el = soup.find(class_="mph-scoreline")
    sl_text = sl_el.get_text(strip=True) if sl_el else ""

    status, score, minute = _parse_scoreline(sl_text)
    is_live = status == "LIVE"

    # ── Start time for NS matches ──
    start_time: Optional[str] = None
    if status == "NS":
        # Look for a time element anywhere on page
        for t_el in soup.find_all(["time", "span", "div", "p"]):
            t_text = t_el.get_text(strip=True)
            tm = re.search(r'(\d{1,2}:\d{2})\s*(UTC|GMT)?', t_text)
            if tm and len(t_text) < 40:
                today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                start_time = f"{today}T{tm.group(1)}:00Z"
                break

    # ── Stream URLs ──
    streams: list[StreamLink] = []
    seen: set[str] = set()

    for iframe in soup.find_all("iframe"):
        src = clean_iframe_src(iframe.get("src", ""), base)
        if src and src not in seen:
            seen.add(src)
            streams.append(StreamLink(url=page_url, embed_url=src, quality="HD",
                                      source="streamseast", priority=1))

    for script in soup.find_all("script"):
        for m in re.finditer(r'"(?:embed|stream|src)"\s*:\s*"(https?://[^"]+)"',
                             script.string or ""):
            src = m.group(1)
            if src not in seen and not re.search(r'(google|analytics|ads)', src, re.I):
                seen.add(src)
                streams.append(StreamLink(url=page_url, embed_url=src, quality="HD",
                                          source="streamseast", priority=1))

    if not streams:
        streams.append(StreamLink(url=page_url, embed_url=page_url, quality="HD",
                                  source="streamseast", priority=1))

    return {
        "status": status,
        "score": score,
        "minute": minute,
        "start_time": start_time,
        "is_live": is_live,
        "streams": streams,
        "title_hint": title_text,
    }


def _parse_scoreline(text: str) -> tuple[str, Optional[dict], Optional[str]]:
    """
    Parse mph-scoreline text into (status, score, minute).

    Patterns seen on streamseast:
      "vs"                         → NS, no score
      "FT2-1"                      → FT, {home:2, away:1}
      "AET2-1"                     → FT, {home:2, away:1}
      "Canceled0-0"                → FT (cancelled, treat as FT), no score
      "Postponed"                  → NS
      "1st Half:23'0-0"            → LIVE, 0-0, min=23
      "2nd Half:67'2-1"            → LIVE, 2-1, min=67
      "HT0-0"                      → HT, 0-0
      "2nd Half:90'+2'0-0"         → LIVE, 0-0, min=90+2
    """
    text = text.strip()

    if not text or text.lower() == "vs":
        return "NS", None, None

    if re.search(r'\b(Postponed|Suspended|PPD)\b', text, re.I):
        return "NS", None, None

    if re.search(r'\b(Canceled|Cancelled)\b', text, re.I):
        return "FT", None, None

    # LIVE indicators
    is_live_text = bool(re.search(r'\b(1st\s*Half|2nd\s*Half|Half\s*Time|HT|ET|Extra\s*Time)\b', text, re.I))

    # Extract minute if live
    minute: Optional[str] = None
    min_m = re.search(r'(\d{1,3}(?:\+\d+)?)\s*\'', text)
    if min_m:
        minute = min_m.group(1)

    # Extract score
    score: Optional[dict] = None
    score_m = re.search(r'(\d{1,2})\s*-\s*(\d{1,2})', text)
    if score_m:
        score = {"home": int(score_m.group(1)), "away": int(score_m.group(2))}

    # Determine status
    if is_live_text or minute:
        return "LIVE", score, minute

    if re.search(r'\b(FT|AET|PEN|Full.?Time)\b', text, re.I):
        return "FT", score, None

    # Default: if we found a score with no live/ft indicator, call it FT
    if score:
        return "FT", score, None

    return "NS", None, None



# ─── Totalsportek cross-reference ─────────────────────────────────────────────

_total_listing_cache: dict[str, dict[str, str]] = {}


def _get_total_listing(domain: str) -> dict[str, str]:
    """Return {normalised_key → match_url} for totalsportek domain (cached)."""
    if domain in _total_listing_cache:
        return _total_listing_cache[domain]

    html = fetch(f"https://{domain}", timeout=20)
    result: dict[str, str] = {}
    if html:
        # Links like /game/iraq-vs-venezuela/401873603/
        for m in re.finditer(
            r'href=["\']([^"\']*?/game/([a-z0-9-]+)-vs-([a-z0-9-]+)/\d+/[^"\']*)["\']',
            html, re.IGNORECASE
        ):
            url = m.group(1)
            if not url.startswith("http"):
                url = f"https://{domain}{url}"
            h = re.sub(r'-+', ' ', m.group(2)).lower()
            a = re.sub(r'-+', ' ', m.group(3)).lower()
            result[f"{h}:{a}"] = url

    _total_listing_cache[domain] = result
    return result


def scrape_totalsportek_streams(home: str, away: str) -> list[StreamLink]:
    """Try each totalsportek domain, return streams for the given match."""
    key = f"{home.lower()}:{away.lower()}"
    # Also try reversed names
    rev_key = f"{away.lower()}:{home.lower()}"

    for domain in TOTAL_DOMAINS:
        listing = _get_total_listing(domain)
        match_url = listing.get(key) or listing.get(rev_key)
        if not match_url:
            continue

        html = fetch(match_url, timeout=20)
        if not html:
            continue

        soup = BeautifulSoup(html, "html.parser")
        base = domain
        streams: list[StreamLink] = []
        seen: set[str] = set()

        for iframe in soup.find_all("iframe"):
            src = clean_iframe_src(iframe.get("src", ""), base)
            if not src or src in seen:
                continue
            seen.add(src)
            streams.append(StreamLink(
                url=match_url,
                embed_url=src,
                quality="HD",
                source="totalsportek",
                priority=2,
            ))

        if streams:
            return streams

    return []


# ─── Orchestrator ─────────────────────────────────────────────────────────────

def scrape_matches(live_only: bool = False) -> list[ScrapedMatch]:
    # Try primary domains in order
    html = None
    active_domain = PRIMARY_DOMAINS[0]
    for domain in PRIMARY_DOMAINS:
        print(f"[scraper] Fetching https://{domain}/soccer ...", file=sys.stderr)
        html = fetch(f"https://{domain}/soccer")
        if html:
            active_domain = domain
            break

    if not html:
        print("[scraper] All primary domains unreachable", file=sys.stderr)
        return []

    listings = parse_listing_page(html, active_domain)
    print(f"[scraper] Found {len(listings)} matches on listing page", file=sys.stderr)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    results: list[ScrapedMatch] = []

    def process(info: dict) -> Optional[ScrapedMatch]:
        home = info["home_team"]
        away = info["away_team"]

        # Fetch detail page — this gives us accurate score/status/streams
        detail_html = fetch(info["url"])
        if not detail_html:
            return None

        detail = parse_detail_page(detail_html, info["url"])

        if live_only and not detail["is_live"]:
            return None

        # Get totalsportek fallback streams
        fallback = scrape_totalsportek_streams(home, away)
        all_streams = detail["streams"] + fallback

        date_key = (detail.get("start_time") or today + "T")[:10]

        # Try to get cleaner team names from page title if URL parsing was poor
        title_hint = detail.get("title_hint", "")
        t_m = re.match(r'^(.+?)\s+vs\s+(.+?)\s+(live|stream|result)', title_hint, re.IGNORECASE)
        if t_m and home.lower() in ("unknown",):
            home = t_m.group(1).strip()
            away = t_m.group(2).strip()

        return ScrapedMatch(
            id=match_id(home, away, date_key),
            title=f"{home} vs {away}",
            home_team=home,
            away_team=away,
            competition=info["competition"],
            status=detail["status"],
            score=detail["score"],
            minute=detail["minute"],
            start_time=detail["start_time"],
            is_live=detail["is_live"],
            streams=[asdict(s) for s in all_streams],
        )

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(process, info): info for info in listings}
        for future in as_completed(futures):
            try:
                m = future.result()
                if m:
                    results.append(m)
            except Exception as e:
                print(f"[scraper] Error processing match: {e}", file=sys.stderr)

    # Sort: live first, then upcoming, then finished
    ORDER = {"LIVE": 0, "NS": 1, "FT": 2}
    results.sort(key=lambda m: ORDER.get(m.status, 3))

    return results


# ─── Firestore push ───────────────────────────────────────────────────────────

def write_to_firestore(matches: list[ScrapedMatch], sa_path: Optional[str] = None) -> int:
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore as fs
    except ImportError:
        print("[firestore] firebase-admin not installed. Run: pip install firebase-admin", file=sys.stderr)
        return 0

    if not firebase_admin._apps:
        if sa_path:
            cred = credentials.Certificate(sa_path)
        else:
            sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
            if not sa_json:
                print("[firestore] No credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or pass --service-account", file=sys.stderr)
                return 0
            cred = credentials.Certificate(json.loads(sa_json))
        firebase_admin.initialize_app(cred)

    db = fs.client()
    batch = db.batch()
    count = 0

    for m in matches:
        doc = {
            "id": m.id,
            "title": m.title,
            "homeTeam": m.home_team,
            "awayTeam": m.away_team,
            "competition": m.competition,
            "status": m.status,
            "score": m.score,
            "minute": m.minute,
            "startTime": m.start_time,
            "isLive": m.is_live,
            "streams": m.streams,  # already list of dicts from asdict()
            "scrapedAt": m.scraped_at,
        }
        ref = db.collection("scraped_matches").document(m.id)
        batch.set(ref, doc, merge=True)
        count += 1
        if count % 450 == 0:
            batch.commit()
            batch = db.batch()

    if count % 450 != 0:
        batch.commit()

    return count


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Match-centric scraper — produces one doc per match with stream links"
    )
    parser.add_argument("--output", default="data/scraped_matches.json",
                        help="Output JSON path or - for stdout (default: data/scraped_matches.json)")
    parser.add_argument("--firestore", action="store_true",
                        help="Push to Firestore scraped_matches collection")
    parser.add_argument("--service-account", metavar="PATH",
                        help="Firebase service account JSON file path")
    parser.add_argument("--live-only", action="store_true",
                        help="Only scrape LIVE matches")
    args = parser.parse_args()

    matches = scrape_matches(live_only=args.live_only)

    output = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "total": len(matches),
        "live":     sum(1 for m in matches if m.status == "LIVE"),
        "upcoming": sum(1 for m in matches if m.status == "NS"),
        "finished": sum(1 for m in matches if m.status == "FT"),
        "matches": [
            {**asdict(m), "streams": m.streams}
            for m in matches
        ],
    }

    if args.output == "-":
        print(json.dumps(output, indent=2, ensure_ascii=False))
    else:
        os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else ".", exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"[scraper] Saved {len(matches)} matches → {args.output}", file=sys.stderr)

    if args.firestore:
        written = write_to_firestore(matches, sa_path=args.service_account)
        print(f"[scraper] Wrote {written} docs to Firestore (collection: scraped_matches)", file=sys.stderr)

    print(f"\n{'─'*50}", file=sys.stderr)
    print(f"Total matches   : {len(matches)}", file=sys.stderr)
    print(f"  LIVE          : {sum(1 for m in matches if m.status == 'LIVE')}", file=sys.stderr)
    print(f"  Upcoming (NS) : {sum(1 for m in matches if m.status == 'NS')}", file=sys.stderr)
    print(f"  Finished (FT) : {sum(1 for m in matches if m.status == 'FT')}", file=sys.stderr)
    print(f"  Total streams : {sum(len(m.streams) for m in matches)}", file=sys.stderr)


if __name__ == "__main__":
    main()
