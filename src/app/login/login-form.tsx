"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { migrateFarmAction } from "@/app/actions/farm";
import { readLocalSaveForMigrate } from "@/lib/game/local-save-migrate";
import { listSaves, type SaveSlot } from "@/lib/game/save";
import { useUiStore } from "@/store/uiStore";

/**
 * Form upgrade tài khoản. Hỗ trợ:
 * - Email + password: signUp (nếu anon → updateUser convert sang persistent,
 *   giữ user.id + farm data) hoặc signIn (đã có tài khoản).
 * - Google OAuth (signInWithOAuth → /auth/callback).
 *
 * Sau khi đăng nhập thành công: migrate local save → cloud 1 lần (nếu slot active
 * có save). Đây là "lưu farm đám mây" thật — không phải UI promise hứa suông.
 * Migrate đọc IndexedDB trực tiếp (không hydrate stores — login page chưa load game).
 */
export function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Migrate local save → cloud. Gọi sau khi session active. Không throw (không chặn login). */
  const tryMigrate = async (): Promise<void> => {
    try {
      // Ưu tiên slot active (đang chơi). Nhưng activeSlot có thể reset "slot1" sau
      // reload (uiStore không persist) → chọn slot có save mới nhất nếu active rỗng.
      const active = useUiStore.getState().activeSlot;
      const saves = await listSaves();
      const withData = saves.filter((s) => s.exists);
      if (withData.length === 0) return; // chưa có save local — không đè cloud
      let slot: SaveSlot = active;
      if (!withData.some((s) => s.slot === slot)) {
        slot = withData.sort((a, b) => b.savedAt - a.savedAt)[0].slot;
      }
      const local = await readLocalSaveForMigrate(slot);
      if (!local) return;
      await migrateFarmAction(local);
    } catch (e) {
      console.error("Farm migrate failed:", e);
    }
  };

  // Google OAuth: /auth/callback redirect về /login?migrate=1 — session đã active,
  // migrate ở đây (callback là server, không hydrate stores).
  useEffect(() => {
    if (searchParams.get("migrate") === "1") {
      tryMigrate().finally(() => {
        router.replace("/");
        router.refresh();
      });
    }
  }, []);

  const handleEmail = async (mode: "signin" | "signup") => {
    setBusy(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const isAnon = userData.user?.is_anonymous;
      if (mode === "signup") {
        if (isAnon) {
          // Upgrade anonymous → persistent (giữ user.id + farm)
          const { error: linkErr } = await supabase.auth.updateUser({
            email,
            password,
          });
          if (linkErr) throw linkErr;
        } else {
          const { error: upErr } = await supabase.auth.signUp({
            email,
            password,
          });
          if (upErr) throw upErr;
        }
        // Anon→persistent (updateUser giữ user.id) hoặc fresh signUp. Nếu session
        // active (không cần confirm email) thì migrate luôn — anon user đã có local
        // save cần lên cloud ngay, không chờ lần signin sau. Migrate idempotent + skip
        // khi không có local save (fresh user) → an toàn cả 2 nhánh.
        await tryMigrate();
        setError("Kiểm tra email để xác nhận (nếu cần).");
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw signInErr;
        // Wire cloud save — local farm lên đám mây (fix false-promise UX bug).
        await tryMigrate();
        router.push("/");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi đăng nhập");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthErr) {
      setError(oauthErr.message);
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded border-2 border-[#4a3119] bg-[#fffaf0] p-6 shadow-lg">
      <h1 className="mb-4 text-center text-2xl text-[#4e7d3a]">🎭 Masked Farm</h1>
      <p className="mb-4 text-center text-sm text-[#6b5b45]">
        Nâng cấp tài khoản để lưu farm đám mây
      </p>

      <div className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border-2 border-[#4a3119] bg-white px-3 py-2"
        />
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border-2 border-[#4a3119] bg-white px-3 py-2"
        />

        <div className="flex gap-2">
          <button
            onClick={() => handleEmail("signin")}
            disabled={busy}
            className="flex-1 rounded border-2 border-[#4a3119] bg-[#4e7d3a] px-3 py-2 text-[#fbf7ec] disabled:opacity-50"
          >
            Đăng nhập
          </button>
          <button
            onClick={() => handleEmail("signup")}
            disabled={busy}
            className="flex-1 rounded border-2 border-[#4a3119] bg-[#e7b94e] px-3 py-2 text-[#4a3318] disabled:opacity-50"
          >
            Tạo tài khoản
          </button>
        </div>

        <div className="my-1 text-center text-xs text-[#6b5b45]">— hoặc —</div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="rounded border-2 border-[#4a3119] bg-white px-3 py-2 disabled:opacity-50"
        >
          Tiếp tục với Google
        </button>

        {error && <p className="text-center text-sm text-[#c0452f]">{error}</p>}
      </div>
    </div>
  );
}
