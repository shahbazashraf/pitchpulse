import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";

admin.initializeApp();
const db = admin.firestore();

// ─── Env / secrets ────────────────────────────────────────────────────────────

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY ?? "";
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_API_KEY ?? "";

// ─── Live scores sync — every 30 seconds during matches ──────────────────────

export const syncLiveScores = onSchedule(
  {
    schedule: "every 1 minutes",  // Cloud Scheduler minimum is 1 min; use Pub/Sub for 30s
    timeoutSeconds: 55,
    memory: "256MiB",
    secrets: ["API_FOOTBALL_KEY"],
  },
  async () => {
    functions.logger.info("[syncLiveScores] Starting");
    try {
      await runLiveScoreSync();
      functions.logger.info("[syncLiveScores] Done");
    } catch (err) {
      functions.logger.error("[syncLiveScores] Error:", err);
    }
  },
);

// ─── Upcoming matches — every 6 hours ────────────────────────────────────────

export const syncUpcomingMatches = onSchedule(
  {
    schedule: "every 6 hours",
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: ["API_FOOTBALL_KEY"],
  },
  async () => {
    functions.logger.info("[syncUpcomingMatches] Starting");
    const today = new Date();
    const dates = [0, 1, 2, 3].map((offset) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return d.toISOString().split("T")[0];
    });

    for (const date of dates) {
      await syncMatchesByDate(date);
    }
    functions.logger.info("[syncUpcomingMatches] Done");
  },
);

// ─── Standings — every 30 minutes ────────────────────────────────────────────

export const syncStandings = onSchedule(
  {
    schedule: "every 30 minutes",
    timeoutSeconds: 120,
    memory: "256MiB",
    secrets: ["API_FOOTBALL_KEY"],
  },
  async () => {
    const competitions = [
      { internalId: "fifa-world-cup-2026", leagueId: 1 },
      { internalId: "premier-league", leagueId: 39 },
      { internalId: "champions-league", leagueId: 2 },
      { internalId: "la-liga", leagueId: 140 },
      { internalId: "bundesliga", leagueId: 78 },
      { internalId: "serie-a", leagueId: 135 },
      { internalId: "ligue-1", leagueId: 61 },
    ];

    for (const comp of competitions) {
      try {
        await syncCompetitionStandings(comp.internalId, comp.leagueId);
      } catch (err) {
        functions.logger.warn(`[syncStandings] Failed for ${comp.internalId}:`, err);
      }
    }
  },
);

// ─── News — every 15 minutes ─────────────────────────────────────────────────

export const syncNews = onSchedule(
  {
    schedule: "every 15 minutes",
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async () => {
    functions.logger.info("[syncNews] Triggering Python news service");
    // In production: invoke Cloud Run container that runs the Python news service
    // Or inline the RSS fetch here in JS
    await inlineNewsFetch();
  },
);

// ─── Stream validation — every 5 minutes ────────────────────────────────────

export const validateStreams = onSchedule(
  {
    schedule: "every 5 minutes",
    timeoutSeconds: 55,
    memory: "256MiB",
  },
  async () => {
    // Find streams that haven't been verified in last 10 minutes
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const staleStreams = await db
      .collection("streams")
      .where("is_available", "==", true)
      .where("last_verified", "<", cutoff.toISOString())
      .limit(50)
      .get();

    functions.logger.info(`[validateStreams] Checking ${staleStreams.size} streams`);

    const batch = db.batch();
    for (const doc of staleStreams.docs) {
      const stream = doc.data();
      const isAvailable = await checkStreamAvailability(stream.url, stream.platform);
      batch.update(doc.ref, {
        is_available: isAvailable,
        last_verified: new Date().toISOString(),
      });
    }
    await batch.commit();
  },
);

// ─── Push notifications — on match event write ───────────────────────────────

export const onMatchEvent = onDocumentWritten(
  "events/{eventId}",
  async (event) => {
    const data = event.data?.after?.data();
    if (!data) return;

    const notifiableTypes = ["Goal", "Penalty Goal", "Own Goal", "Red Card", "Yellow Red Card"];
    if (!notifiableTypes.includes(data.type)) return;

    const matchId = data.matchId;
    const matchDoc = await db.collection("matches").doc(matchId).get();
    if (!matchDoc.exists) return;

    const match = matchDoc.data()!;
    const title = buildNotificationTitle(data, match);
    const body = buildNotificationBody(data, match);

    // Get all FCM tokens subscribed to this match or either team
    const topics = [
      `match_${matchId}`,
      `team_${match.homeTeamId}`,
      `team_${match.awayTeamId}`,
    ];

    for (const topic of topics) {
      try {
        await admin.messaging().sendToTopic(topic, {
          notification: { title, body },
          data: {
            matchId,
            eventType: data.type,
            minute: String(data.minute ?? 0),
            click_action: "FLUTTER_NOTIFICATION_CLICK",
          },
          android: {
            priority: "high",
            notification: {
              sound: "goal_sound",
              channelId: "match_events",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "goal_sound.wav",
                badge: 1,
              },
            },
          },
        });
      } catch (err) {
        functions.logger.warn(`[notifications] Failed to send to topic ${topic}:`, err);
      }
    }
  },
);

// ─── HTTP endpoint for manual triggers ───────────────────────────────────────

export const triggerSync = onRequest(
  {
    secrets: ["API_FOOTBALL_KEY"],
    invoker: "private", // only callable by service accounts
  },
  async (req, res) => {
    const { type, date } = req.query;

    try {
      if (type === "live") {
        await runLiveScoreSync();
        res.json({ ok: true, type: "live" });
      } else if (type === "date" && typeof date === "string") {
        await syncMatchesByDate(date);
        res.json({ ok: true, type: "date", date });
      } else {
        res.status(400).json({ error: "Unknown sync type" });
      }
    } catch (err) {
      functions.logger.error("[triggerSync]", err);
      res.status(500).json({ error: String(err) });
    }
  },
);

// ─── Core sync implementations ────────────────────────────────────────────────

async function runLiveScoreSync(): Promise<void> {
  if (!API_FOOTBALL_KEY) {
    functions.logger.warn("[LiveSync] No API key configured");
    return;
  }

  const TRACKED_LEAGUES = [1, 2, 39, 140, 78, 135, 61, 253];
  const leagueParam = TRACKED_LEAGUES.join("-");

  const resp = await fetch(
    `https://v3.football.api-sports.io/fixtures?live=${leagueParam}`,
    {
      headers: {
        "x-apisports-key": API_FOOTBALL_KEY,
      },
    },
  );

  if (!resp.ok) {
    throw new Error(`API-Football responded with ${resp.status}`);
  }

  const data = await resp.json() as { response: any[] };
  const fixtures = data.response ?? [];

  if (!fixtures.length) return;

  const batch = db.batch();
  for (const f of fixtures) {
    const matchId = `apifootball:${f.fixture.id}`;
    const ref = db.collection("matches").doc(matchId);
    batch.set(ref, {
      providerId: f.fixture.id,
      provider: "api-football",
      status: f.fixture.status.short,
      minute: f.fixture.status.elapsed ?? null,
      injuryTime: f.fixture.status.extra ?? null,
      homeScore: f.goals.home ?? null,
      awayScore: f.goals.away ?? null,
      homeScoreHT: f.score.halftime.home ?? null,
      awayScoreHT: f.score.halftime.away ?? null,
      homePenalties: f.score.penalty.home ?? null,
      awayPenalties: f.score.penalty.away ?? null,
      homeTeamId: `apifootball:${f.teams.home.id}`,
      awayTeamId: `apifootball:${f.teams.away.id}`,
      homeTeamName: f.teams.home.name,
      awayTeamName: f.teams.away.name,
      homeTeamLogo: f.teams.home.logo,
      awayTeamLogo: f.teams.away.logo,
      competitionId: `apifootball:${f.league.id}`,
      competitionName: f.league.name,
      round: f.league.round,
      season: String(f.league.season),
      venue: f.fixture.venue?.name ?? null,
      city: f.fixture.venue?.city ?? null,
      startTime: f.fixture.date,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();
  functions.logger.info(`[LiveSync] Updated ${fixtures.length} live fixtures`);

  // Sync events for live matches
  for (const f of fixtures.slice(0, 10)) { // cap to avoid quota burn
    await syncMatchEvents(f.fixture.id);
  }
}

async function syncMatchEvents(fixtureId: number): Promise<void> {
  if (!API_FOOTBALL_KEY) return;

  const resp = await fetch(
    `https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`,
    { headers: { "x-apisports-key": API_FOOTBALL_KEY } },
  );
  if (!resp.ok) return;

  const data = await resp.json() as { response: any[] };
  const events = data.response ?? [];
  if (!events.length) return;

  const matchId = `apifootball:${fixtureId}`;
  const batch = db.batch();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const eventId = `${matchId}:event:${i}`;
    batch.set(db.collection("events").doc(eventId), {
      matchId,
      minute: e.time?.elapsed ?? null,
      extraMinute: e.time?.extra ?? null,
      type: normalizeEventType(e.type, e.detail),
      detail: e.detail ?? null,
      teamId: `apifootball:${e.team?.id}`,
      teamName: e.team?.name ?? null,
      playerName: e.player?.name ?? null,
      assistName: e.assist?.name ?? null,
      comments: e.comments ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

async function syncMatchesByDate(date: string): Promise<void> {
  if (!API_FOOTBALL_KEY) return;

  const resp = await fetch(
    `https://v3.football.api-sports.io/fixtures?date=${date}`,
    { headers: { "x-apisports-key": API_FOOTBALL_KEY } },
  );
  if (!resp.ok) return;

  const data = await resp.json() as { response: any[] };
  const fixtures = data.response ?? [];

  const batch = db.batch();
  for (const f of fixtures) {
    const matchId = `apifootball:${f.fixture.id}`;
    const ref = db.collection("matches").doc(matchId);
    batch.set(ref, {
      providerId: f.fixture.id,
      provider: "api-football",
      status: f.fixture.status.short,
      minute: f.fixture.status.elapsed ?? null,
      homeScore: f.goals.home ?? null,
      awayScore: f.goals.away ?? null,
      homeTeamId: `apifootball:${f.teams.home.id}`,
      awayTeamId: `apifootball:${f.teams.away.id}`,
      homeTeamName: f.teams.home.name,
      awayTeamName: f.teams.away.name,
      homeTeamLogo: f.teams.home.logo,
      awayTeamLogo: f.teams.away.logo,
      competitionId: `apifootball:${f.league.id}`,
      competitionName: f.league.name,
      season: String(f.league.season),
      round: f.league.round,
      venue: f.fixture.venue?.name ?? null,
      city: f.fixture.venue?.city ?? null,
      startTime: f.fixture.date,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
  functions.logger.info(`[syncByDate] Synced ${fixtures.length} fixtures for ${date}`);
}

async function syncCompetitionStandings(competitionId: string, leagueId: number): Promise<void> {
  if (!API_FOOTBALL_KEY) return;

  const season = new Date().getMonth() >= 7
    ? new Date().getFullYear()
    : new Date().getFullYear() - 1;

  const resp = await fetch(
    `https://v3.football.api-sports.io/standings?league=${leagueId}&season=${season}`,
    { headers: { "x-apisports-key": API_FOOTBALL_KEY } },
  );
  if (!resp.ok) return;

  const data = await resp.json() as { response: any[] };
  const leagueData = data.response[0]?.league;
  if (!leagueData) return;

  const docId = `apifootball:${leagueId}:${season}`;
  await db.collection("standings").doc(docId).set({
    competitionId: `apifootball:${leagueId}`,
    season: String(season),
    standings: leagueData.standings,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function inlineNewsFetch(): Promise<void> {
  const feeds = [
    "https://feeds.bbci.co.uk/sport/football/rss.xml",
    "https://www.espn.com/espn/rss/soccer/news",
  ];

  for (const feedUrl of feeds) {
    try {
      const resp = await fetch(feedUrl, {
        headers: { "User-Agent": "PitchPulse/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) continue;
      const xml = await resp.text();
      // Simple item extraction
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
      const batch = db.batch();
      for (const item of items.slice(0, 10)) {
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ?? item.match(/<title>(.*?)<\/title>/))?.[1] ?? "";
        const link = (item.match(/<link>(.*?)<\/link>/) ?? [])?.[1] ?? "";
        const desc = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ?? item.match(/<description>(.*?)<\/description>/))?.[1] ?? "";
        if (!link) continue;
        const id = Buffer.from(link).toString("base64").substring(0, 20);
        batch.set(db.collection("articles").doc(id), {
          id,
          headline: title.replace(/<[^>]+>/g, "").trim(),
          summary: desc.replace(/<[^>]+>/g, "").trim().substring(0, 300),
          url: link,
          source: new URL(feedUrl).hostname,
          publishedAt: new Date().toISOString(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();
    } catch (err) {
      functions.logger.warn("[inlineNewsFetch] Failed:", err);
    }
  }
}

async function checkStreamAvailability(url: string, platform: string): Promise<boolean> {
  try {
    if (platform === "youtube") {
      const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (!match) return false;
      const oembedResp = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { signal: AbortSignal.timeout(5000) },
      );
      return oembedResp.ok;
    }
    const resp = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// ─── Notification builders ────────────────────────────────────────────────────

function buildNotificationTitle(event: any, match: any): string {
  switch (event.type) {
    case "Goal":
    case "Penalty Goal":
      return `⚽ GOAL! ${match.homeTeamName} ${match.homeScore ?? 0}-${match.awayScore ?? 0} ${match.awayTeamName}`;
    case "Own Goal":
      return `⚽ Own Goal! ${match.homeTeamName} ${match.homeScore ?? 0}-${match.awayScore ?? 0} ${match.awayTeamName}`;
    case "Red Card":
      return `🟥 Red Card! ${event.teamName}`;
    case "Yellow Red Card":
      return `🟥 Second Yellow! ${event.teamName}`;
    default:
      return `${match.homeTeamName} vs ${match.awayTeamName}`;
  }
}

function buildNotificationBody(event: any, match: any): string {
  const min = event.minute ? `${event.minute}'` : "";
  const player = event.playerName ?? "";
  switch (event.type) {
    case "Goal":
    case "Penalty Goal":
      return `${min} ${player} scores${event.assistName ? ` (assist: ${event.assistName})` : ""}`;
    case "Own Goal":
      return `${min} ${player} scores an own goal`;
    case "Red Card":
      return `${min} ${player} is sent off`;
    default:
      return `${min} ${event.type}`;
  }
}

function normalizeEventType(type: string, detail: string): string {
  if (type === "Goal") {
    if (detail?.toLowerCase().includes("own goal")) return "Own Goal";
    if (detail?.toLowerCase().includes("penalty")) return "Penalty Goal";
    return "Goal";
  }
  if (type === "Card") return detail ?? "Yellow Card";
  if (type === "subst") return "Substitution";
  if (type === "Var") return "VAR";
  return type;
}
