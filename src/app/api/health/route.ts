import { NextResponse } from "next/server";
import { getRegistry } from "@/lib/providers/registry";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  try {
    const registry = getRegistry();
    const health = await registry.getAllHealth();
    const allHealthy = health.every((h) => h.isHealthy);

    return NextResponse.json(
      { providers: health, allHealthy, checkedAt: new Date().toISOString() },
      { status: allHealthy ? 200 : 207 },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
