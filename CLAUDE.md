# PitchPulse — Project CLAUDE.md

## What This Is
Football platform targeting World Cup 2026. Live scores, highlights aggregation, AI news summaries, stream finder, match commentary. Free-tier-first architecture.

## Stack
- **Framework**: Next.js 15 App Router, TypeScript, Tailwind CSS 3.4
- **Database**: Firebase Firestore (NoSQL, public read / admin write)
- **Functions**: Firebase Cloud Functions v2 (scheduled sync, push notifications)
- **Cache**: Upstash Redis (prod) → in-memory LRU fallback (dev)
- **Deployment**: Vercel (frontend), Firebase (backend/DB/FCM)
- **UI**: Radix UI, Lucide, Framer Motion — dark glassmorphism design system
- **Data Fetching**: TanStack React Query v5

## Football Data Providers
Provider registry pattern with automatic fallback chain:
- **Primary**: API-Football (api-football.com) — 100 req/day free
- **Fallback**: Football-Data.org — 10 req/min free
- **World Cup**: WC2026 API (wc2026api.com) — 100 req/day free
- Interface: `src/lib/providers/base.ts`, registry: `src/lib/providers/registry.ts`

## AI / LLM
- **News summaries**: Groq `llama-3.1-8b-instant` — 14,400 req/day free (primary)
- **Match commentary**: Anthropic Claude or Groq (swappable) — `src/app/api/commentary/`
- Groq is default because of free tier; Claude is optional/fallback
- Model IDs: `claude-sonnet-4-6` for most tasks, `claude-opus-4-8` for complex reasoning

## Key Pages & Routes
| Route | Purpose |
|---|---|
| `/` | Homepage — live scores, highlights, news, competitions |
| `/world-cup` | WC2026 hub — groups, knockout bracket, top scorers |
| `/highlights` | Video feed (YouTube, Reddit, RSS) — year/competition filtered |
| `/streams` | Official free broadcaster finder (YouTube Data API) |
| `/competitions` | League standings & fixtures |
| `/news` | News feed with AI summaries |
| `/match/[id]` | Full match detail — events, lineups, stats, commentary, streams |

## API Routes
All under `src/app/api/`:
- `/matches`, `/standings`, `/streams`, `/highlights`, `/news`, `/commentary`, `/world-cup`, `/health`
- `/cron/highlights` — GitHub Actions webhook (secret-gated)

## Cron / Background Jobs
- **GitHub Actions** (`.github/workflows/sync-highlights.yml`): every 10 min → scrapes YouTube RSS, Reddit r/footballhighlights, footballhighlights-video.com → writes to Firestore `highlights`
- **Firebase Cloud Functions** (`functions/src/index.ts`):
  - `syncLiveScores` — every 1 min
  - `syncUpcomingMatches` — every 6 hrs
  - `syncStandings` — every 30 min
  - `syncNews` — every 15 min
  - `validateStreams` — every 5 min
  - `onMatchEvent` — Firestore trigger → FCM push notifications

## Firestore Collections
`matches`, `events`, `matchStats`, `lineups`, `competitions`, `teams`, `players`, `standings`, `commentary`, `streams`, `articles`, `highlights`, `predictions`, `favorites`, `notifications`, `users`, `admins`

Security: public read on match/content collections; owner-gated on user collections.

## Environment Variables
```
# Football APIs
API_FOOTBALL_KEY
FOOTBALL_DATA_API_KEY
WC2026_API_KEY

# Firebase
FIREBASE_SERVICE_ACCOUNT_JSON    # single-line JSON string
FIREBASE_PROJECT_ID

# Cache
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN

# Stream Discovery
YOUTUBE_API_KEY

# AI/LLM
ANTHROPIC_API_KEY
GROQ_API_KEY

# Cron Auth
CRON_SECRET

# App
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_APP_NAME=PitchPulse
```

## Architecture Notes
- **Provider pattern**: all football data goes through `src/lib/providers/registry.ts` — never call external APIs directly from components
- **Cache TTLs**: 15s for live match data, 5–15 min for standings/news/stable data
- **Next.js 15 quirk**: route params are Promises — `await params` in dynamic segments like `[matchId]`
- **Highlights dedup**: SHA256 hash of URL prevents duplicates on repeated cron runs
- **No Supabase here** — this project uses Firebase, not Supabase (global default doesn't apply)
- **No shadcn/ui** — uses Radix UI primitives directly with custom Tailwind classes

## Design System
- Electric green `#00E676` (primary accent), electric blue `#0EA5E9`
- Dark pitch background, glassmorphism cards, backdrop blur
- Custom animations: `pulse-live`, `score-pop`, `slide-up`, `shimmer`, `glow-pulse`
- Defined in `tailwind.config.ts`

## File Structure
```
src/
  app/                 # App Router pages + API routes
  components/
    match/             # ScoresDashboard, MatchCard, MatchEvents, WorldCupHero
    highlights/        # HighlightsFeed, HighlightCard, HighlightPlayer
    worldcup/          # WCOverview, KnockoutBracket, TopScorers
    news/              # NewsSection
    layout/            # Navbar, LiveTicker
    stream/            # StreamPlayer
    lineup/            # LineupPitch
    stats/             # MatchStatsPanel
    competitions/      # CompetitionCards
    live/              # LiveCommentaryFeed
  hooks/               # useHighlights, useMatches, useHoofootHighlights
  lib/
    cache/             # Redis/in-memory abstraction
    providers/         # Football API provider registry
    streams/           # Stream discovery utilities
    worldcup2026/      # WC tournament data
  types/               # index.ts — Match, Team, Player, Standing, Commentary, etc.
functions/             # Firebase Cloud Functions v2
firestore/             # firestore.rules, firestore.indexes.json
.github/workflows/     # GitHub Actions (highlights cron)
```
