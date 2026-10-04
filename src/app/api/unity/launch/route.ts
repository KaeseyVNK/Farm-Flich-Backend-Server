import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/unity/launch — authenticated web session to one-time Unity launch code.
 * Only an already-linked Google identity is accepted; email alone is not an account link.
 * Requires server-only UNITY_SERVER_URL and BRIDGE_TOKEN environment variables.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ ok: false, error: "Sign in to the web account first." }, { status: 401 });
  }

  const googleSub = user.identities?.find(identity => identity.provider === "google")?.identity_data?.sub;
  if (typeof googleSub !== "string" || !googleSub) {
    return NextResponse.json({ ok: false, code: "UNITY_ACCOUNT_NOT_LINKED", error: "Link the game account before launching." }, { status: 409 });
  }

  try {
    const credential = await db.unityCredential.findUnique({
      where: { googleSub },
      select: {
        userId: true,
        email: true,
        username: true,
        user: { select: { usernameSetupRequired: true } },
      },
    });
    if (!credential) {
      return NextResponse.json({ ok: false, code: "UNITY_ACCOUNT_NOT_LINKED", error: "Link the game account before launching." }, { status: 409 });
    }

    const bridgeToken = process.env.BRIDGE_TOKEN;
    const baseUrl = process.env.UNITY_SERVER_URL?.trim().replace(/\/+$/, "");
    if (!bridgeToken || !baseUrl) {
      return NextResponse.json({ ok: false, error: "Game sign-in is temporarily unavailable." }, { status: 503 });
    }

    const serverUrl = new URL(baseUrl);
    const localHttp = serverUrl.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(serverUrl.hostname);
    if (serverUrl.protocol !== "https:" && !localHttp) {
      return NextResponse.json({ ok: false, error: "Game sign-in is temporarily unavailable." }, { status: 503 });
    }

    const response = await fetch(`${baseUrl}/auth/launch-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Version": "4",
        "x-bridge-token": bridgeToken,
      },
      body: JSON.stringify({
        playerId: credential.userId,
        email: credential.email,
        username: credential.username,
        needsUsernameSetup: credential.user.usernameSetupRequired,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true || typeof result.code !== "string" || result.expiresInSeconds !== 90) {
      return NextResponse.json({ ok: false, error: "Game sign-in is temporarily unavailable." }, { status: 503 });
    }

    return NextResponse.json({ ok: true, launchCode: result.code, expiresInSeconds: result.expiresInSeconds }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    console.error("[unity-launch] launch-code request failed:", cause instanceof Error ? cause.name : "unknown");
    return NextResponse.json({ ok: false, error: "Game sign-in is temporarily unavailable." }, { status: 503 });
  }
}
