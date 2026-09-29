"use server";

import { createClient } from "@/lib/supabase/server";
import { getGold, getInventoryQty } from "@/lib/game/wallet-service";

/**
 * Server Actions — wallet (read-only). Wrap auth (session.user.id) + service.
 * App-layer authz: userId lấy từ session, KHÔNG từ client input (chặn spoof).
 *
 * Code-review C1: `changeGold`/`changeInventory` từng export dưới "use server"
 * = POST RPC công khai cho MỌI user đăng nhập (delta tùy ý → mint gold/item).
 * Zero production callers → xóa thay vì guard. Mutations chỉ qua RPC
 * security-definer (craft_mask/marketplace_buy/steal_with_loss_cap...).
 */

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized: chưa đăng nhập");
  return user.id;
}

/**
 * Cloud gold sink reconcile (review H4). Cloud `User.gold` chỉ là SINK — bounty/
 * craft trừ qua RPC security-definer; gameplay earnings local-first. Flow:
 * 1. Trước sink (bounty/craft/mask): `fetchCloudGold` check đủ vàng cloud.
 * 2. Sink OK: client tự trừ local (`gameStore.addGold(-cost)`) → 2 balance hội tụ.
 * 3. fetchCloudGold trả -1 khi offline/chưa auth → caller skip check (fail-open,
 *    RPC vẫn chặn thiếu vàng ở DB layer — chỉ là UX preview).
 */
export async function fetchGold(): Promise<number> {
  try {
    const uid = await requireUserId();
    return (await getGold(uid)) ?? 0;
  } catch {
    return -1;
  }
}

export async function fetchInventoryQty(itemId: string): Promise<number> {
  const uid = await requireUserId();
  return getInventoryQty(uid, itemId);
}
