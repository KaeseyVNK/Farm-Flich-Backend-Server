import { NextResponse } from "next/server";
import { expireExpiredListings } from "@/lib/marketplace/marketplace-bg-job";

/**
 * Cron endpoint — expire listings hết hạn + refund (phase 6 F6.5).
 * Gọi định kỳ qua Vercel Cron (`crons` trong vercel.json) hoặc scheduler ngoài.
 * Guard CRON_SECRET: endpoint idempotent nhưng cho phép attacker trigger sweep
 * bất kỳ = minor cost/DoS vector. Bearer header khớp CRON_SECRET mới chạy.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const expired = await expireExpiredListings();
  return NextResponse.json({ ok: true, expired });
}
