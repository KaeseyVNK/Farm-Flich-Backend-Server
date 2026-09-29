"use server";

import { createClient } from "@/lib/supabase/server";
import { safeRpcError } from "@/lib/social/safe-errors";
import { checkRateLimitDb } from "@/lib/social/db-rate-limit";

/**
 * Village chat insert (audit M1). Server-side auth + length cap + rate-limit
 * DB-backed (review F6/F4: in-memory per-process → multi-instance nhân limit;
 * client-only throttle bypass được bằng direct action call).
 */
const MAX_MSG_LEN = 500;

export async function sendVillageChatAction(msg: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = msg.trim();
  if (!trimmed) return { ok: false, error: "rỗng" };
  if (trimmed.length > MAX_MSG_LEN) return { ok: false, error: `quá dài (>${MAX_MSG_LEN})` };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };
  let allowed = false;
  try {
    allowed = await checkRateLimitDb(user.id, "chat");
  } catch {
    return { ok: false, error: "rate-limited (DB lỗi — thử lại)" };
  }
  if (!allowed) return { ok: false, error: "rate-limited: quá 10 tin/phút" };
  const { error } = await supabase.from("VillageChat").insert({ userId: user.id, msg: trimmed });
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  return { ok: true };
}

