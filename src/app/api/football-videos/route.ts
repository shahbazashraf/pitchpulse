import { NextRequest, NextResponse } from "next/server";
import { Highlight } from "@/types";

export const runtime = "nodejs";

const LOG = "[football-videos/api]";
const OFFICIAL_PROVIDERS = ["FIFA", "UEFA", "ESPN"];

// ─── Firebase Admin ───────────────────────────────────────────────────────────

function getFirebaseAdmin() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getApps, initializeApp, cert } = require("firebase-admin/app");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getFirestore } = require("firebase-admin/firestore");
        const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!sa) return null;
        if (!getApps().length) initializeApp({ credential: cert(JSON.parse(sa)) });
        return getFirestore();
    } catch { return null; }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const competition = searchParams.get("competition") ?? "all";
    const year = searchParams.get("year") ?? "all";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "12"), 50);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0);

    console.log(`${LOG} GET competition=${competition} year=${year} limit=${limit} offset=${offset}`);

    let highlights: Highlight[] = [];

    // Read from Firestore (football_videos collection)
    const db = getFirebaseAdmin();
    if (db) {
        try {
            let query = db
                .collection("football_videos")
                .orderBy("publishedAt", "desc");

            // Filter by official providers only
            query = query.where("provider", "in", OFFICIAL_PROVIDERS);
            console.log(`${LOG} Filtering provider IN [FIFA, UEFA, ESPN]`);

            if (competition !== "all") {
                query = query.where("competition", "==", competition);
                console.log(`${LOG} Filtering by competition="${competition}"`);
            }
            if (year !== "all") {
                query = query.where("year", "==", parseInt(year));
                console.log(`${LOG} Filtering by year=${year}`);
            }

            query = query.offset(offset).limit(limit);

            const snap = await query.get();
            highlights = snap.docs.map((d: { id: string; data: () => Omit<Highlight, "id"> }) => ({
                id: d.id,
                ...d.data(),
            }));

            console.log(`${LOG} Firestore returned ${highlights.length} docs`);
        } catch (err) {
            console.error(`${LOG} Firestore query failed:`, err);
        }
    } else {
        console.warn(`${LOG} No Firestore client — skipping DB query`);
    }

    return NextResponse.json({
        highlights,
        total: highlights.length,
        offset,
        source: db ? "firestore" : "none",
        fetchedAt: new Date().toISOString(),
    });
}