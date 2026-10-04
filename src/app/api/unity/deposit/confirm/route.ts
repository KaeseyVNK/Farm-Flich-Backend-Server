import { NextResponse } from "next/server";
import { confirmDeposit } from "@/lib/unity/deposit";
import { WalletError } from "@/lib/unity/wallet";
export async function POST(req: Request) {
  if (!process.env.BRIDGE_TOKEN || req.headers.get("x-bridge-token") !== process.env.BRIDGE_TOKEN) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 }); }
  if (typeof body?.playerId !== "string" || !body.playerId) return NextResponse.json({ ok: false, error: "Player identity required." }, { status: 400 });
  try { return NextResponse.json(await confirmDeposit(body.playerId, body.signature)); }
  catch (error) { return NextResponse.json({ ok: false, code: error instanceof WalletError ? error.code : "DEPOSIT_FAILED", error: error instanceof WalletError ? error.message : "Deposit verification failed." }, { status: error instanceof WalletError ? error.status : 503 }); }
}
