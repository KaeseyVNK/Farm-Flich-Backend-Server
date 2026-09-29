/**
 * Sanitize error message trả client (review Low) — raw PostgREST/Prisma message
 * leak constraint names, RPC internals, SQL fragments. Map lỗi đã biết → thông
 * điệp thân thiện; lạ → generic. Log full message server-side để debug.
 */

const FRIENDLY: [RegExp, string][] = [
  [/user mismatch|insufficient_privilege|forbidden/i, "Không có quyền thực hiện"],
  [/không đủ|insufficient|không tồn tại.*gold|not enough/i, "Không đủ tài nguyên"],
  [/đã sở hữu|already|duplicate|unique/i, "Đã thực hiện trước đó"],
  [/không active|đã đổi trạng thái|hết hạn|expired|race/i, "Trạng thái đã thay đổi — thử lại"],
  [/không phải bạn|not friends|friendship/i, "Chỉ dành cho bạn bè"],
  [/cap |vượt |ngoài band|phải |> ?\d+/i, "Giá trị không hợp lệ"],
  [/foreign_key|violat/i, "Dữ liệu không hợp lệ"],
];

export function safeActionError(e: unknown, context = "action"): string {
  const raw = e instanceof Error ? e.message : String(e);
  console.error(`[${context}]`, raw); // full detail chỉ ở log server
  if (/rate-limited/i.test(raw)) return "Quá nhanh — chờ chút rồi thử lại";
  for (const [pattern, msg] of FRIENDLY) {
    if (pattern.test(raw)) return msg;
  }
  return "Không thực hiện được — thử lại.";
}

/** Supabase error object → sanitized string (null khi không có lỗi). */
export function safeRpcError(error: { message: string } | null, context = "rpc"): string | undefined {
  if (!error) return undefined;
  return safeActionError(new Error(error.message), context);
}
