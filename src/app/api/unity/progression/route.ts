import { NextResponse } from "next/server";
import { pullProgression, pushProgression } from "@/lib/game/progression-service";

/**
 * Unity bridge — cloud-synced RPG progression (level/xp/skillPoints/perks).
 * Mirrors UnityCredential + farm bridge: token-auth, server-authoritative LWW.
 *
 * GET /api/unity/progression?userId=x   → { ok, progression } or NOT_FOUND
 * POST /api/unity/progression           → body { userId, progression, version }
 *     LWW: stale (version < server) is rejected, server version wins; else version+1.
 */
function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const token = req.headers.get("x-bridge-token");
  if (!token || token !== process.env.BRIDGE_TOKEN) return unauthorized();

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId")?.trim();
  if (!userId) return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 });

  try {
    const r = await pullProgression(userId);
    if (!r.ok) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true, progression: r.progression });
  } catch (err) {
    console.error("[unity-progression] pull failed:", err);
    return NextResponse.json({ ok: false, error: "pull failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const token = req.headers.get("x-bridge-token");
  if (!token || token !== process.env.BRIDGE_TOKEN) return unauthorized();

  let body: { userId?: string; progression?: Record<string, unknown>; version?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const userId = body?.userId?.trim();
  const p = body?.progression;
  if (!userId || !p || typeof p !== "object") {
    return NextResponse.json({ ok: false, error: "userId and progression are required" }, { status: 400 });
  }

  try {
    const r = await pushProgression(
      userId,
      {
        level: p.level as number,
        xp: p.xp as number,
        totalXp: p.totalXp as number,
        skillPoints: p.skillPoints as number,
        perkAllocations: p.perkAllocations as { farming: number; combat: number; social: number },
      },
      typeof body.version === "number" ? body.version : 0,
    );
    return NextResponse.json({ ok: r.ok, progression: r.progression, stale: !!r.stale });
  } catch (err) {
    console.error("[unity-progression] push failed:", err);
    return NextResponse.json({ ok: false, error: "push failed" }, { status: 500 });
  }
}