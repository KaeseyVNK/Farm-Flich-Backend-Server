import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bindWallet, getWallet, WalletError } from "@/lib/unity/wallet";

function authorized(req: Request) { return !!process.env.BRIDGE_TOKEN && req.headers.get("x-bridge-token") === process.env.BRIDGE_TOKEN; }
function failure(error: unknown) {
  return NextResponse.json({ ok: false, code: error instanceof WalletError ? error.code : "WALLET_FAILED", error: error instanceof WalletError ? error.message : "Wallet operation failed." }, { status: error instanceof WalletError ? error.status : 500 });
}
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const balancePlayerId = url.searchParams.get("userId")?.trim().toLowerCase();
  if (balancePlayerId) {
    try {
      const user = await db.user.findUnique({ where: { id: balancePlayerId }, select: { cashMilli: true } });
      if (!user) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
      return NextResponse.json({ ok: true, playerId: balancePlayerId, balanceMilliCash: Number(user.cashMilli) });
    } catch { return NextResponse.json({ ok: false, error: "wallet unavailable" }, { status: 503 }); }
  }
  const address = url.searchParams.get("address") || undefined;
  const playerId = url.searchParams.get("playerId") || undefined;
  if (!address && !playerId) return NextResponse.json({ ok: false, error: "Identity required." }, { status: 400 });
  try { return NextResponse.json({ ok: true, wallet: await getWallet({ address, playerId }) }); } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 }); }
  try { return NextResponse.json({ ok: true, wallet: await bindWallet(body) }); } catch (error) { return failure(error); }
}
