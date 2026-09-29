import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveGoogleLink, type GoogleAuthResult } from "@/lib/unity/google-auth-service";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const expected = process.env.BRIDGE_TOKEN;
  const received = req.headers.get("x-bridge-token");
  return !!expected && received === expected;
}

function statusFor(result: GoogleAuthResult): number {
  if (result.ok === true) return 200;
  if (result.code === "INVALID_IDENTITY") return 400;
  if (result.code === "PLAYER_NOT_FOUND") return 404;
  if (result.code === "EMAIL_IN_USE" || result.code === "GOOGLE_SUB_IN_USE" || result.code === "GOOGLE_SUB_MISMATCH") return 409;
  return 503;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let body: { playerId?: unknown; email?: unknown; googleSub?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, code: "INVALID_IDENTITY" }, { status: 400 }); }

  try {
    const result = await resolveGoogleLink(db as never, body?.playerId, body?.email, body?.googleSub);
    if (result.ok === true) return NextResponse.json(result, { status: 200 });
    return NextResponse.json({ ok: false, code: result.code }, { status: statusFor(result) });
  } catch (error) {
    console.error("[unity-google-link] identity link failed:", error);
    return NextResponse.json({ ok: false, code: "GOOGLE_AUTH_UNAVAILABLE" }, { status: 503 });
  }
}
