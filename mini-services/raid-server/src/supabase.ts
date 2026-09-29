import { createClient } from "@supabase/supabase-js";

/**
 * raid-server Supabase client (service role — server-only, bypass RLS).
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (KHÔNG NEXT_PUBLIC_).
 * Dùng cho: load farm khi raid, check shield/daily-cap, write RaidEvent/RaidSession (finalize phase 6).
 * Review F2: boot-time assert — thiếu key fail fast thay vì crash ở query đầu.
 */

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!process.env.SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "[raid-server] Missing env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. " +
      "DB writes (RaidSession/RaidEvent/finalize) không thể hoạt động — fail fast at boot.",
  );
}

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
