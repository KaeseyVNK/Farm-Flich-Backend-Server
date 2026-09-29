"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * useAnonAuth — tự động đăng nhập anonymous nếu chưa có session.
 * Chạy 1 lần khi GameLayout mount. Anonymous user = user.id tạm trong cookie,
 * upgrade sang persistent qua /login (giữ user.id + data).
 *
 * Chạy ngầm, không block render. Lỗi sign-in không fatal (game vẫn chơi offline cache).
 */
export function useAnonAuth() {
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        // signInAnonymously reject (Supabase down/quota) → nuốt — game chơi
        // offline cache được. Trước đây reject = unhandled promise rejection.
        if (!user && !cancelled) await supabase.auth.signInAnonymously();
      } catch {
        /* non-fatal — offline cache path */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
