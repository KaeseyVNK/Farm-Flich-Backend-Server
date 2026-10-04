import { NextResponse } from "next/server";
import { depositConfig } from "@/lib/unity/deposit";
export async function GET(req: Request) {
  if (!process.env.BRIDGE_TOKEN || req.headers.get("x-bridge-token") !== process.env.BRIDGE_TOKEN) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { rpc: _rpc, ...info } = depositConfig();
  return NextResponse.json({ ok: true, ...info });
}
