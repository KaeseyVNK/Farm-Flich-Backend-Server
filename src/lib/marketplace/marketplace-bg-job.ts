import { createClient } from "@/lib/supabase/server";

/**
 * Marketplace expire sweep (phase 6 F6.5). TTL 7d — bg job đóng listing hết hạn
 * + refund inventory cho seller (atomic RPC expire_listing).
 *
 * Gọi qua API route /api/cron/marketplace-expire (Vercel cron) HOẶC server action
 * `runMarketplaceExpireAction` (thủ công/dev).
 *
 * Idempotent: RPC chỉ đóng status='active' đã quá expiresAt, FOR UPDATE SKIP LOCKED
 * chống race với marketplace_buy.
 */
export const EXPIRE_BATCH_LIMIT = 100;

export async function expireExpiredListings(limit = EXPIRE_BATCH_LIMIT): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("expire_listing", { p_limit: limit });
  if (error) {
    console.error("[marketplace] expire sweep error", error.message);
    return 0;
  }
  return Number(data ?? 0);
}
