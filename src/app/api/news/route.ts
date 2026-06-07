import { NextRequest, NextResponse } from "next/server";
import { cache, TTL } from "@/lib/cache";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { NewsArticle } from "@/types";

export const runtime = "nodejs";

function getDb() {
  if (!getApps().length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (sa) initializeApp({ credential: cert(JSON.parse(sa)) });
    else initializeApp();
  }
  return getFirestore();
}

async function groqSummarize(article: NewsArticle, key: string): Promise<string> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a football news editor. Summarize in 1-2 sentences, plain text, no markdown, no bullet points." },
          { role: "user", content: `Headline: ${article.headline}\n\n${article.summary}` },
        ],
        max_tokens: 80,
        temperature: 0.3,
      }),
    });
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? article.summary;
  } catch {
    return article.summary;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const source = searchParams.get("source");
  const limit = Math.min(Number(searchParams.get("limit") ?? 40), 100);
  const wantSummary = searchParams.get("summary") === "true";
  const cacheKey = `news:${source ?? "all"}:${limit}`;

  try {
    const articles = await cache.getOrFetch(
      cacheKey,
      async () => {
        try {
          const db = getDb();
          let query = db
            .collection("articles")
            .orderBy("publishedAt", "desc")
            .limit(limit);

          if (source) query = query.where("source", "==", source) as never;

          const snap = await query.get();
          const docs = snap.docs.map((d) => d.data());
          return docs.length ? docs : getStubNews(source).slice(0, limit);
        } catch {
          return getStubNews(source).slice(0, limit);
        }
      },
      TTL.NEWS,
    ) as NewsArticle[];

    // Add AI summary to top article if requested and key is present
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (wantSummary && GROQ_KEY && articles.length > 0) {
      const top = articles[0];
      const sumKey = `news:summary:${top.id}`;
      const cached = await cache.get<string>(sumKey);
      if (cached) {
        top.aiSummary = cached;
      } else {
        const summary = await groqSummarize(top, GROQ_KEY);
        top.aiSummary = summary;
        await cache.set(sumKey, summary, 900);
      }
    }

    return NextResponse.json(
      { articles, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": `public, s-maxage=${TTL.NEWS}, stale-while-revalidate=60` } },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}

function getStubNews(source?: string | null): NewsArticle[] {
  const now = new Date().toISOString();
  const articles: NewsArticle[] = [
    {
      id: "stub-wc26-kicks-off",
      headline: "FIFA World Cup 2026 kicks off in North America — everything you need to know",
      summary: "The FIFA World Cup 2026 begins on June 11 across 16 cities in the USA, Canada, and Mexico. 48 teams compete across 104 matches in the biggest World Cup in history.",
      body: null,
      source: "fifa",
      sourceName: "FIFA",
      sourceLogoUrl: null,
      author: null,
      imageUrl: null,
      url: "https://www.fifa.com/worldcup/",
      publishedAt: now,
      tags: ["World Cup 2026", "FIFA", "North America"],
      competitionId: "fifa-world-cup-2026",
      teamIds: [],
      playerIds: [],
      matchId: null,
      language: "en",
    },
    {
      id: "stub-streams",
      headline: "Where to watch World Cup 2026 for free — official broadcaster guide",
      summary: "PitchPulse has compiled a list of free official broadcasters showing every World Cup 2026 match. CazéTV streams all 104 matches globally on YouTube.",
      body: null,
      source: "pitchpulse",
      sourceName: "PitchPulse",
      sourceLogoUrl: null,
      author: "PitchPulse",
      imageUrl: null,
      url: "/streams",
      publishedAt: now,
      tags: ["Streams", "Broadcast", "Free"],
      competitionId: "fifa-world-cup-2026",
      teamIds: [],
      playerIds: [],
      matchId: null,
      language: "en",
    },
    {
      id: "stub-groups",
      headline: "World Cup 2026 Group Stage: all 12 groups and fixtures revealed",
      summary: "The 48-team tournament features 12 groups of four. Brazil, Argentina, France, England, Spain, Germany and Portugal are among the favourites heading into the group stage.",
      body: null,
      source: "pitchpulse",
      sourceName: "PitchPulse",
      sourceLogoUrl: null,
      author: "PitchPulse",
      imageUrl: null,
      url: "/world-cup",
      publishedAt: now,
      tags: ["Groups", "Fixtures", "World Cup 2026"],
      competitionId: "fifa-world-cup-2026",
      teamIds: [],
      playerIds: [],
      matchId: null,
      language: "en",
    },
    {
      id: "stub-highlights",
      headline: "Relive the best World Cup 2022 moments before the 2026 tournament",
      summary: "With the 2026 World Cup underway, we look back at the iconic moments from Qatar 2022 — Mbappe's hat-trick, Messi's masterclass, and Morocco's incredible run.",
      body: null,
      source: "pitchpulse",
      sourceName: "PitchPulse",
      sourceLogoUrl: null,
      author: "PitchPulse",
      imageUrl: null,
      url: "/world-cup",
      publishedAt: now,
      tags: ["Highlights", "World Cup 2022", "Best Moments"],
      competitionId: "fifa-world-cup-2026",
      teamIds: [],
      playerIds: [],
      matchId: null,
      language: "en",
    },
    {
      id: "stub-predictions",
      headline: "World Cup 2026 predictions: who will lift the trophy in New York?",
      summary: "Football analysts and fans are split between Brazil, France, and Argentina as favourites for the 2026 World Cup final at MetLife Stadium in East Rutherford.",
      body: null,
      source: "pitchpulse",
      sourceName: "PitchPulse",
      sourceLogoUrl: null,
      author: "PitchPulse",
      imageUrl: null,
      url: "/world-cup",
      publishedAt: now,
      tags: ["Predictions", "World Cup 2026", "Analysis"],
      competitionId: "fifa-world-cup-2026",
      teamIds: [],
      playerIds: [],
      matchId: null,
      language: "en",
    },
  ];

  return source ? articles.filter((a) => a.source === source) : articles;
}
