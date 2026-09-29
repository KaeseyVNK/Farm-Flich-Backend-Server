import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { giftCodeForDate, parseWaitlistEmail } from "@/lib/waitlist";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const emailRaw =
    typeof body === "object" && body && "email" in body
      ? String((body as { email: unknown }).email)
      : "";

  const parsed = parseWaitlistEmail(emailRaw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const giftCode = giftCodeForDate();

  try {
    const row = await db.waitlistSignup.upsert({
      where: { email: parsed.email },
      create: { email: parsed.email, giftCode },
      update: { giftCode },
    });
    return NextResponse.json({
      ok: true,
      email: row.email,
      giftCode: row.giftCode,
    });
  } catch {
    return NextResponse.json(
      { error: "Không lưu được danh sách. Thử lại sau." },
      { status: 500 },
    );
  }
}
