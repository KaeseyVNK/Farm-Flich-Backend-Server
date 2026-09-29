import { createClient } from "@supabase/supabase-js";

/**
 * WS auth (red-team #3) — ĐỌC COOKIE ở fetch upgrade, verify getUser.
 * KHÔNG tin userId/farmId client gửi trong message. Cookie `sb-access-token` → verified user.id.
 *
 * Review F2: boot-time assert — trước đây thiếu mọi key env → createClient(undefined!)
 * throw ở HANDSHAKE ĐẦU TIÊN (fail muộn, khó debug). Giờ fail fast khi start.
 */

function resolvePublishableKey(): string {
  const key =
    process.env.SUPABASE_PUBLIC_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!process.env.SUPABASE_URL || !key) {
    throw new Error(
      "[raid-server] Missing env: SUPABASE_URL + SUPABASE_PUBLIC_KEY (hoặc NEXT_PUBLIC_* alias). " +
        "auth.ts không thể verify JWT — fail fast at boot.",
    );
  }
  return key;
}

const PUBLISHABLE_KEY = resolvePublishableKey();

function parseCookie(cookie: string, name: string): string | null {
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

/** Trả userId từ cookie, hoặc null nếu không hợp lệ. */
export async function getUserFromCookie(cookieHeader: string | null): Promise<string | null> {
  if (!cookieHeader) return null;
  const token = parseCookie(cookieHeader, "sb-access-token");
  if (!token) return null;
  const sb = createClient(
    process.env.SUPABASE_URL!,
    PUBLISHABLE_KEY, // publishable/anon key — chỉ để verify JWT
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const {
    data: { user },
  } = await sb.auth.getUser(token);
  return user?.id ?? null;
}
