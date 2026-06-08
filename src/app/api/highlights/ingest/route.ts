import { NextRequest, NextResponse } from "next/server";
import { Highlight } from "@/types";

export const runtime = "nodejs";

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

export async function POST(req: NextRequest) {
  // Origin check — only accept from same app (browser write-back)
  const origin = req.headers.get("origin") ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (origin && !appUrl.includes(origin.replace(/^https?:\/\//, ""))) {
    // Allow localhost for dev
    if (!origin.includes("localhost") && !origin.includes("127.0.0.1")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let body: { highlights?: Highlight[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const highlights = body.highlights;
  if (!Array.isArray(highlights) || highlights.length === 0) {
    return NextResponse.json({ written: 0 });
  }
  if (highlights.length > 20) {
    return NextResponse.json({ error: "Max 20 highlights per ingest call" }, { status: 400 });
  }

  const db = getFirebaseAdmin();
  if (!db) {
    return NextResponse.json({ written: 0, noFirebase: true });
  }

  const batch = db.batch();
  for (const h of highlights) {
    if (!h.id || !h.embedUrl) continue;
    batch.set(db.collection("highlights").doc(h.id), h, { merge: true });
  }
  await batch.commit();

  return NextResponse.json({ written: highlights.length });
}
