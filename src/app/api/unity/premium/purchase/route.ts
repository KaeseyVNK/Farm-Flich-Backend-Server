import { NextResponse } from "next/server";
import { CashPurchaseError, purchaseWithCash } from "@/lib/unity/cash-purchase";

export async function POST(req: Request) {
  const token = req.headers.get("x-bridge-token");
  if (!token || token !== process.env.BRIDGE_TOKEN) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  const playerId = typeof body.playerId === "string" ? body.playerId.trim().toLowerCase() : "";
  try {
    const result = await purchaseWithCash({
      playerId,
      requestId: body.requestId as string,
      kind: body.kind as "ITEM" | "PLOT",
      targetId: body.targetId as string,
      quantity: body.quantity as number,
      farm: body.farm as Parameters<typeof purchaseWithCash>[0]["farm"],
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CashPurchaseError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: error.status });
    }
    console.error("[unity-premium] purchase failed", error);
    return NextResponse.json({ ok: false, error: "PURCHASE_UNAVAILABLE" }, { status: 503 });
  }
}
