# PitchPulse ⚡

**Live football scores, streams, and stats — FIFA World Cup 2026 and beyond.**

> Real-time match data · Official free streams · Live commentary · Lineups · Stats

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Framer Motion |
| Data providers | API-Football (primary), Football-Data.org (fallback) |
| Cache | Upstash Redis (production, optional) / in-memory (dev) |
| Database | Firebase Firestore |
| Functions | Firebase Cloud Functions v2 (Blaze plan required for deploy) |
| Stream discovery | Python (aiohttp, Pydantic) + YouTube Data API |
| Commentary AI | OpenRouter / Groq (free tier) — Anthropic optional |
| Notifications | Firebase Cloud Messaging |
| Deployment | Vercel (frontend) + Firebase (functions/db) |

---

## API Keys — Free Tier Status

| Service | Status | Notes |
|---|---|---|
| `API_FOOTBALL_KEY` | ✅ Added | Free: 100 req/day |
| `FOOTBALL_DATA_API_KEY` | ✅ Added | Free: 10 req/min |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ✅ Added | Service account configured |
| `FIREBASE_PROJECT_ID` | ✅ Added | `kickstream-40b20` |
| `SPORTMONKS_API_KEY` | ⏭️ Skipped | Paid — not needed |
| `UPSTASH_REDIS_REST_URL/TOKEN` | ⏭️ Pending | Optional; app falls back to in-memory cache |
| `YOUTUBE_API_KEY` | ⏭️ Pending | Free Google Cloud quota — needed for stream discovery |
| `ANTHROPIC_API_KEY` | ⏭️ Replaced | Use OpenRouter or Groq free tier instead (see below) |

### AI Commentary — Free Alternatives

The commentary service is designed for Anthropic Claude but can be swapped to any OpenAI-compatible API:

**Option A — Groq (fastest, free):**
```
OPENROUTER_API_KEY=   ← or use GROQ_API_KEY
OPENROUTER_BASE_URL=https://api.groq.com/openai/v1
OPENROUTER_MODEL=llama3-8b-8192
```

**Option B — OpenRouter (free models available):**
```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=mistralai/mistral-7b-instruct:free
```

> These keys need to be added to `.env.local` and wired into `services/python/commentary/service.py`.

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/yourname/pitchpulse
cd pitchpulse
npm install --legacy-peer-deps
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Fill in your API keys — see table above
```

**Minimum required keys to run locally:**
- `API_FOOTBALL_KEY` — [api-football.com](https://www.api-football.com) free tier
- `FIREBASE_PROJECT_ID` — your Firebase project ID
- `FIREBASE_SERVICE_ACCOUNT_JSON` — paste service account JSON as single-line string
- `FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json` — path to the downloaded key file

### 3. Deploy Firestore rules

```bash
firebase deploy --only firestore --project <your-project-id>
```

### 4. Run development server

```bash
npm run dev
# Open http://localhost:3000
```

---

## Python services

The stream discovery and live score ingestion run as Python scripts.
**Requires Python 3.11** (Python 3.14 is incompatible with pydantic-core).

```bash
cd services/python

# Create venv with Python 3.11 (required!)
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip3 install -r requirements.txt
```

Scripts automatically load `.env.local` from the project root.

```bash
# Sync live matches to Firestore (currently playing)
python3 live_scores/service.py

# Sync matches for a specific date
python3 live_scores/service.py 2026-06-11

# Aggregate news from RSS feeds (BBC Sport, Sky Sports, ESPN FC)
python3 news/service.py
```

> **Note:** Some RSS feeds (FIFA, UEFA, Goal.com, AS.com) return 404 — they have disabled public RSS. BBC Sport, Sky Sports, and ESPN FC feeds are working.

---

## Firebase setup

### Deploy Firestore rules + indexes

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # select your project

firebase deploy --only firestore --project kickstream-40b20
```

### Deploy Cloud Functions (requires Blaze plan)

> Cloud Functions require the Firebase **Blaze (Pay-as-you-go)** plan. For local development you run the Python scripts manually instead.

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

---

## Known issues & TODO

### 🐛 Active Bugs
- [ ] Team flag images returning 404 — API-Football logo URLs need a CDN proxy or fallback
- [ ] Several RSS news feeds (FIFA, UEFA, Goal.com, AS.com) return 404 — need replacement sources
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` multi-line value in `.env.local` causes dotenv parse warnings — use single-line JSON or path-based auth only

### 🔧 In Progress
- [ ] Wire OpenRouter / Groq free API key for AI match commentary
- [ ] Add `YOUTUBE_API_KEY` to enable live stream discovery
- [ ] Fix team logo/flag 404s — add fallback placeholder images
- [ ] Replace broken RSS feeds with working alternatives

### 🚀 Upcoming
- [ ] Upstash Redis caching (production)
- [ ] Push notifications (Firebase Cloud Messaging)
- [ ] User favorites / predictions (requires Firebase Auth)
- [ ] Deploy Cloud Functions on Blaze plan
- [ ] Vercel production deployment

---

## API routes

| Route | Description |
|---|---|
| `GET /api/matches/live` | All live matches |
| `GET /api/matches/date?date=YYYY-MM-DD` | Matches by date |
| `GET /api/matches/[id]?include=events,stats,lineups` | Single match detail |
| `GET /api/standings?competition=fifa-world-cup-2026` | Group/league table |
| `GET /api/streams/[matchId]` | Streams for a match |
| `GET /api/streams` | All available streams |
| `GET /api/commentary/[matchId]` | Live match commentary |
| `GET /api/news` | Latest football news |
| `GET /api/health` | Provider health check |

---

## Supported competitions

| ID | Competition |
|---|---|
| `fifa-world-cup-2026` | FIFA World Cup 2026 |
| `champions-league` | UEFA Champions League |
| `premier-league` | Premier League |
| `la-liga` | La Liga |
| `bundesliga` | Bundesliga |
| `serie-a` | Serie A |
| `ligue-1` | Ligue 1 |
| `mls` | MLS |

---

## Project structure

```
pitchpulse/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Home (live scores)
│   │   ├── match/[id]/         # Match detail
│   │   ├── competitions/       # Group tables
│   │   ├── news/               # News feed
│   │   ├── streams/            # All streams
│   │   └── api/                # API routes
│   ├── components/
│   │   ├── layout/             # Navbar, LiveTicker
│   │   ├── match/              # MatchCard, ScoresDashboard, MatchEvents
│   │   ├── live/               # LiveCommentaryFeed, LiveTicker
│   │   ├── lineup/             # LineupPitch
│   │   ├── stats/              # MatchStatsPanel
│   │   └── stream/             # StreamPlayer
│   ├── hooks/                  # React Query hooks (useMatches, etc.)
│   ├── lib/
│   │   ├── providers/          # API-Football, Football-Data adapters
│   │   ├── cache/              # Redis / memory cache
│   │   └── utils.ts
│   └── types/                  # TypeScript types
├── services/python/            # Python ingestion services
│   ├── live_scores/            # Syncs match data → Firestore
│   ├── stream_discovery/       # Finds official streams
│   ├── commentary/             # AI commentary generation
│   └── news/                   # RSS news aggregation
├── functions/                  # Firebase Cloud Functions (scheduled)
├── firestore/                  # Rules + indexes
├── .env.example                # Template — copy to .env.local
└── service-account.json        # Firebase key — DO NOT COMMIT
```

---

## License

MIT — build something great with it.
