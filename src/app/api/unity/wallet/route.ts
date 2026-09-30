import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const token = req.headers.get("x-bridge-token");
  if (!token || token !== process.env.BRIDGE_TOKEN) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const playerId = new URL(req.url).searchParams.get("userId")?.trim().toLowerCase();
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({ where: { id: playerId }, select: { cashMilli: true } });
    if (!user) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true, playerId, balanceMilliCash: Number(user.cashMilli) });
  } catch (error) {
    console.error("[unity-wallet] balance lookup failed", error);
    return NextResponse.json({ ok: false, error: "wallet unavailable" }, { status: 503 });
  }
}
