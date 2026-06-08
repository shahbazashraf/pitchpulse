#!/usr/bin/env python3
"""
hoofoot_scraper.py — Reverse-engineered scraper for hoofoot.com

Extracts all football highlight data:
  - All match listings (homepage + pagination + competition pages)
  - Per-match detail: title, score, date, competition, thumbnail, video embed URL

Output:
  --output data/hoofoot_highlights.json   (default)
  --output -                              (stdout)
  --firestore                             (write to Firestore highlights collection)

Usage:
  python3 scripts/hoofoot_scraper.py
  python3 scripts/hoofoot_scraper.py --pages 5 --output data/hoofoot.json
  python3 scripts/hoofoot_scraper.py --competition 58 --output -
  python3 scripts/hoofoot_scraper.py --firestore

Requires:
  pip install curl_cffi
"""

import argparse
import hashlib
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from curl_cffi import requests as cf

BASE_URL = "https://hoofoot.com"

# All known competitions from site nav
COMPETITIONS: dict[str, str] = {
    "58": "Premier League",
    "69": "Championship",
    "73": "Carabao Cup",
    "54": "FA Cup",
    "59": "La Liga",
    "52": "Copa Del Rey",
    "150": "Serie A",
    "62": "Coppa Italia",
    "55": "Bundesliga",
    "66": "DFB Pokal",
    "136": "Ligue 1",
    "44": "Coupe De France",
    "67": "Coupe De La Ligue",
    "63": "Eredivisie",
    "78": "Champions League",
    "85": "Nations League",
    "56": "Europa League",
    "75": "Super Cup",
    "64": "Friendly Match",
    "87": "Club Friendlies",
    "71": "World Cup Qualifiers",
    "135": "Saudi Pro League",
    "81": "Turkish Super Lig",
    "82": "Liga Portugal",
    "51": "Africa Cup",
    "86": "MLS",
}

SLUG_PATTERN = re.compile(r'\?match=([A-Za-z0-9_]+)')
OG_TITLE = re.compile(r'<meta property="og:title"\s+content="([^"]+)"')
OG_DESC = re.compile(r'<meta name="Description"\s+content="([^"]+)"', re.IGNORECASE)
OG_IMAGE = re.compile(r'<meta property="og:image"\s+content="([^"]+)"')
EMBED_URL_PATTERN = re.compile(
    r'https://[a-zA-Z0-9\-]+\.vibedailyhighlights\.com/embed/([A-Za-z0-9]+)'
)
GENERIC_EMBED = re.compile(r'href="(https://[^"]+vibedailyhighlights[^"]+)"')
SCORE_PATTERN = re.compile(r'\b(\d+)-(\d+)\b')
DATE_PATTERN = re.compile(r'(\w+ \d{1,2}, \d{4})')


@dataclass
class HoofootMatch:
    id: str
    slug: str
    title: str
    home_team: str
    away_team: str
    home_score: Optional[int]
    away_score: Optional[int]
    competition: str
    date: Optional[str]
    thumbnail: Optional[str]
    embed_url: Optional[str]
    embed_id: Optional[str]
    page_url: str
    scraped_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def stable_id(slug: str) -> str:
    return hashlib.sha256(slug.encode()).hexdigest()[:20]


def parse_teams_from_slug(slug: str) -> tuple[str, str]:
    parts = slug.split("_")
    try:
        v_idx = parts.index("v")
        home = " ".join(parts[:v_idx])
        away_parts = []
        for p in parts[v_idx + 1:]:
            if re.match(r'^\d{4}$', p):
                break
            away_parts.append(p)
        return home, " ".join(away_parts)
    except ValueError:
        return slug, ""


def parse_date_from_slug(slug: str) -> Optional[str]:
    m = re.search(r'(\d{4})_(\d{2})_(\d{2})$', slug)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def slug_date(slug: str) -> Optional[date]:
    s = parse_date_from_slug(slug)
    return date.fromisoformat(s) if s else None


def parse_match_detail(html: str, slug: str, page_url: str) -> HoofootMatch:
    title_m = OG_TITLE.search(html)
    title = title_m.group(1) if title_m else slug.replace("_", " ")
    title = re.sub(r'\s*~\s*Highlights.*$', '', title).strip()

    desc_m = OG_DESC.search(html)
    desc = desc_m.group(1) if desc_m else ""

    thumb_m = OG_IMAGE.search(html)
    thumbnail = thumb_m.group(1) if thumb_m else None

    home_score = away_score = None
    score_m = SCORE_PATTERN.search(desc)
    if score_m:
        home_score = int(score_m.group(1))
        away_score = int(score_m.group(2))

    comp_m = re.search(
        r'\(([^)]+Match[^)]*|Champions League|Premier League|[^)]+League[^)]*|[^)]+Cup[^)]*)\)',
        desc, re.IGNORECASE
    )
    competition = comp_m.group(1) if comp_m else "Football"

    date = parse_date_from_slug(slug)
    if not date:
        date_m = DATE_PATTERN.search(desc)
        if date_m:
            try:
                d = datetime.strptime(date_m.group(1), "%B %d, %Y")
                date = d.strftime("%Y-%m-%d")
            except ValueError:
                pass

    embed_url = embed_id = None
    embed_m = EMBED_URL_PATTERN.search(html)
    if embed_m:
        embed_id = embed_m.group(1)
        embed_url = embed_m.group(0)
        # Override thumbnail with embed image URL (hoofoot thumbnails 403 cross-origin)
        subdomain_m = re.match(r'https://([^.]+)\.vibedailyhighlights', embed_url)
        if subdomain_m:
            thumbnail = f"https://{subdomain_m.group(1)}.vibedailyhighlights.com/embed/image/{embed_id}"
    else:
        gen_m = GENERIC_EMBED.search(html)
        if gen_m:
            embed_url = gen_m.group(1)

    home, away = parse_teams_from_slug(slug)
    return HoofootMatch(
        id=stable_id(slug),
        slug=slug,
        title=title,
        home_team=home,
        away_team=away,
        home_score=home_score,
        away_score=away_score,
        competition=competition,
        date=date,
        thumbnail=thumbnail,
        embed_url=embed_url,
        embed_id=embed_id,
        page_url=page_url,
    )


def extract_slugs(html: str) -> list[str]:
    return list(dict.fromkeys(SLUG_PATTERN.findall(html)))


# ── HTTP (curl_cffi — bypasses Cloudflare TLS fingerprint checks) ───────────────

_session = cf.Session(impersonate="chrome")


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


def fetch_slugs(url: str) -> tuple[list[str], int]:
    html = fetch(url)
    if not html:
        return [], 1
    slugs = extract_slugs(html)
    page_nums = [int(p) for p in re.findall(r'\?page=(\d+)', html)]
    return slugs, (max(page_nums) if page_nums else 1)


def fetch_match(slug: str) -> Optional[HoofootMatch]:
    url = f"{BASE_URL}/?match={slug}"
    html = fetch(url)
    return parse_match_detail(html, slug, url) if html else None


# ── Main scrape orchestrator ────────────────────────────────────────────────────

def scrape_all(
    max_home_pages: int = 10,
    competition_ids: Optional[list[str]] = None,
    concurrency: int = 8,
    since: Optional[str] = None,
) -> list[HoofootMatch]:
    seen: set[str] = set()
    all_slugs: list[str] = []

    def add_slugs(slugs: list[str]) -> None:
        for s in slugs:
            if s not in seen:
                seen.add(s)
                all_slugs.append(s)

    # Step 1: Homepage + pagination
    print("[hoofoot] Scraping homepage...", file=sys.stderr)
    home_slugs, max_page = fetch_slugs(f"{BASE_URL}/")
    add_slugs(home_slugs)
    max_page = min(max_page, max_home_pages)

    if max_page > 1:
        page_urls = [f"{BASE_URL}/?page={p}" for p in range(2, max_page + 1)]
        print(f"[hoofoot] Fetching {len(page_urls)} pagination pages...", file=sys.stderr)
        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            for slugs, _ in pool.map(fetch_slugs, page_urls):
                add_slugs(slugs)

    # Step 2: All competition pages
    comp_ids = competition_ids or list(COMPETITIONS.keys())
    print(f"[hoofoot] Scraping {len(comp_ids)} competition pages...", file=sys.stderr)

    def scrape_comp(cid: str) -> list[str]:
        cname = COMPETITIONS.get(cid, cid).replace(" ", "")
        url = f"{BASE_URL}/?idp={cid}&{cname}"
        slugs, cp_max = fetch_slugs(url)
        if cp_max > 1:
            sub_urls = [f"{BASE_URL}/?idp={cid}&page={p}" for p in range(2, min(cp_max + 1, 6))]
            with ThreadPoolExecutor(max_workers=4) as pool:
                for sub_slugs, _ in pool.map(fetch_slugs, sub_urls):
                    slugs.extend(sub_slugs)
        return slugs

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        for slugs in pool.map(scrape_comp, comp_ids):
            add_slugs(slugs)

    # Step 2b: Date filter — drop slugs older than `since` before hitting detail pages
    if since:
        cutoff = date.fromisoformat(since)
        before = len(all_slugs)
        all_slugs = [s for s in all_slugs if slug_date(s) is None or slug_date(s) >= cutoff]
        print(f"[hoofoot] Date filter ({since}): kept {len(all_slugs)}/{before} slugs", file=sys.stderr)
    else:
        print(f"[hoofoot] Found {len(all_slugs)} unique match slugs", file=sys.stderr)

    # Step 3: Fetch all match detail pages
    print("[hoofoot] Fetching match detail pages...", file=sys.stderr)
    matches: list[HoofootMatch] = []

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = {pool.submit(fetch_match, s): s for s in all_slugs}
        done_count = 0
        for future in as_completed(futures):
            done_count += 1
            result = future.result()
            if result:
                matches.append(result)
            if done_count % 20 == 0 or done_count == len(all_slugs):
                print(f"  {done_count}/{len(all_slugs)} matches fetched", file=sys.stderr)

    print(f"[hoofoot] Done — {len(matches)} matches scraped", file=sys.stderr)
    return matches


# ── Firestore writer ────────────────────────────────────────────────────────────

def write_to_firestore(matches: list[HoofootMatch], sa_path: Optional[str] = None) -> int:
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore as fs
    except ImportError:
        print("[hoofoot] firebase-admin not installed: pip install firebase-admin", file=sys.stderr)
        return 0

    if not firebase_admin._apps:
        # Prefer --service-account file path, then env var JSON string
        if sa_path:
            cred = credentials.Certificate(sa_path)
        else:
            sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
            if not sa_json:
                print("[hoofoot] No credentials: use --service-account /path/to/key.json", file=sys.stderr)
                return 0
            cred = credentials.Certificate(json.loads(sa_json))
        firebase_admin.initialize_app(cred)

    db = fs.client()
    batch = db.batch()
    count = 0

    for m in matches:
        highlight_doc = {
            "id": m.id,
            "matchId": m.slug,
            "title": m.title,
            "competition": m.competition,
            "year": int(m.date[:4]) if m.date else datetime.now().year,
            "thumbnail": m.thumbnail,
            "source": "hoofoot",
            "provider": "HooFoot",
            "embedUrl": m.embed_url,
            "videoUrl": m.embed_url,
            "publishedAt": f"{m.date}T00:00:00Z" if m.date else m.scraped_at,
            "verified": False,
            "homeTeam": m.home_team,
            "awayTeam": m.away_team,
            "homeScore": m.home_score,
            "awayScore": m.away_score,
            "slug": m.slug,
            "pageUrl": m.page_url,
            "scrapedAt": m.scraped_at,
        }
        ref = db.collection("highlights").document(m.id)
        batch.set(ref, highlight_doc, merge=True)
        count += 1
        if count % 450 == 0:
            batch.commit()
            batch = db.batch()

    batch.commit()
    return count


# ── CLI ─────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape hoofoot.com highlights")
    parser.add_argument("--pages", type=int, default=10,
                        help="Max homepage pages to crawl (default: 10)")
    parser.add_argument("--competition", type=str,
                        help="Scrape single competition by ID (e.g. 58)")
    parser.add_argument("--output", type=str, default="data/hoofoot_highlights.json",
                        help="Output path or - for stdout")
    parser.add_argument("--firestore", action="store_true",
                        help="Write results to Firestore")
    parser.add_argument("--service-account", type=str, metavar="PATH",
                        help="Path to Firebase service account JSON key file (e.g. ~/Downloads/serviceAccount.json)")
    parser.add_argument("--concurrency", type=int, default=8,
                        help="Concurrent HTTP requests (default: 8)")
    parser.add_argument("--list-competitions", action="store_true",
                        help="Print all competition IDs and exit")
    default_since = (datetime.now(timezone.utc).date() - timedelta(days=60)).isoformat()
    parser.add_argument("--since", type=str, default=default_since,
                        help=f"Only include matches on or after this date YYYY-MM-DD (default: 60 days ago = {default_since})")
    args = parser.parse_args()

    if args.list_competitions:
        print(json.dumps(COMPETITIONS, indent=2))
        return

    comp_ids = [args.competition] if args.competition else None
    matches = scrape_all(
        max_home_pages=args.pages,
        competition_ids=comp_ids,
        concurrency=args.concurrency,
        since=args.since,
    )

    output_data = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "total": len(matches),
        "competitions": COMPETITIONS,
        "matches": [asdict(m) for m in matches],
    }

    if args.output == "-":
        print(json.dumps(output_data, indent=2, ensure_ascii=False))
    else:
        out_path = args.output
        os.makedirs(os.path.dirname(out_path) if os.path.dirname(out_path) else ".", exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        print(f"[hoofoot] Saved to {out_path}", file=sys.stderr)

    if args.firestore:
        written = write_to_firestore(matches, sa_path=args.service_account)
        print(f"[hoofoot] Wrote {written} docs to Firestore", file=sys.stderr)

    # Summary by competition
    print(f"\n{'='*50}", file=sys.stderr)
    print(f"Total: {len(matches)} matches", file=sys.stderr)
    by_comp: dict[str, int] = {}
    for m in matches:
        by_comp[m.competition] = by_comp.get(m.competition, 0) + 1
    for comp, cnt in sorted(by_comp.items(), key=lambda x: -x[1]):
        print(f"  {comp}: {cnt}", file=sys.stderr)


if __name__ == "__main__":
    main()
