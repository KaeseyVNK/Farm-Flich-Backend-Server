"use client";

import { createClient } from "@/lib/supabase/client";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

const UNITY_API_URL = process.env.NEXT_PUBLIC_UNITY_SERVER_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
const UNITY_WEBGL_URL = process.env.NEXT_PUBLIC_UNITY_WEBGL_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:9599/" : "");

type LaunchResponse = {
  ok?: boolean;
  launchCode?: string;
  error?: string;
};

export default function UnityLaunchPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedInAs, setSignedInAs] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const autoLaunchStarted = useRef(false);

  const launchGame = useCallback(async () => {
    if (!UNITY_API_URL || !UNITY_WEBGL_URL) {
      setError("Thiếu cấu hình địa chỉ UnityServer hoặc bản WebGL.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/unity/launch", {
        method: "POST",
        cache: "no-store",
      });
      const result = await response.json() as LaunchResponse;
      if (!response.ok || !result.ok || !result.launchCode) {
        setError(response.status === 409
          ? "Tài khoản này chưa liên kết với tài khoản game. Hãy liên kết Google trong game trước."
          : result.error || "Không thể mở game. Vui lòng thử lại.");
        setBusy(false);
        return;
      }

      const gameUrl = new URL(UNITY_WEBGL_URL);
      gameUrl.searchParams.set("server", UNITY_API_URL);
      gameUrl.searchParams.set("launchCode", result.launchCode);
      gameUrl.searchParams.set("webLogin", `${window.location.origin}/unity-launch?launch=1`);
      window.location.replace(gameUrl.toString());
    } catch {
      setError("Không kết nối được máy chủ game. Vui lòng thử lại.");
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active || !user) return;
      setSignedInAs(user.email || "Tài khoản đã đăng nhập");
      if (new URLSearchParams(window.location.search).get("launch") === "1" && !autoLaunchStarted.current) {
        autoLaunchStarted.current = true;
        void launchGame();
      }
    });
    return () => { active = false; };
  }, [launchGame, supabase]);

  const signInWithPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setBusy(false);
        return;
      }
      setSignedInAs(email);
      await launchGame();
    } catch {
      setError("Không kết nối được dịch vụ đăng nhập. Vui lòng thử lại.");
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    setError("");
    const next = encodeURIComponent("/unity-launch?launch=1");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${next}` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSignedInAs("");
    setPassword("");
    setError("");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6efe0] p-4">
      <section className="w-full max-w-sm rounded border-2 border-[#4a3119] bg-[#fffaf0] p-6 shadow-lg">
        <h1 className="mb-2 text-center text-2xl font-bold text-[#4e7d3a]">Farm &amp; Filch</h1>
        <p className="mb-5 text-center text-sm text-[#6b5b45]">Đăng nhập để mở game Unity</p>

        {signedInAs ? (
          <div className="flex flex-col gap-3">
            <p className="break-all text-center text-sm text-[#3b2f23]">Đã đăng nhập: {signedInAs}</p>
            <button onClick={() => void launchGame()} disabled={busy}
              className="rounded border-2 border-[#4a3119] bg-[#4e7d3a] px-3 py-3 font-semibold text-[#fbf7ec] disabled:opacity-50">
              {busy ? "Đang mở game…" : "Launch game"}
            </button>
            <button onClick={() => void signOut()} disabled={busy}
              className="rounded border-2 border-[#4a3119] bg-[#ece0c8] px-3 py-2 text-[#5a4a36] disabled:opacity-50">
              Đăng xuất
            </button>
          </div>
        ) : (
          <form onSubmit={signInWithPassword} className="flex flex-col gap-3">
            <input type="email" required autoComplete="email" placeholder="Email"
              value={email} onChange={event => setEmail(event.target.value)}
              className="rounded border-2 border-[#4a3119] bg-white px-3 py-2" />
            <input type="password" required autoComplete="current-password" placeholder="Mật khẩu"
              value={password} onChange={event => setPassword(event.target.value)}
              className="rounded border-2 border-[#4a3119] bg-white px-3 py-2" />
            <button type="submit" disabled={busy}
              className="rounded border-2 border-[#4a3119] bg-[#4e7d3a] px-3 py-3 font-semibold text-[#fbf7ec] disabled:opacity-50">
              {busy ? "Đang đăng nhập…" : "Đăng nhập và launch game"}
            </button>
            <div className="text-center text-xs text-[#6b5b45]">hoặc</div>
            <button type="button" onClick={() => void signInWithGoogle()} disabled={busy}
              className="rounded border-2 border-[#4a3119] bg-white px-3 py-2 disabled:opacity-50">
              Tiếp tục với Google
            </button>
          </form>
        )}

        {error && <p role="alert" className="mt-4 text-center text-sm text-[#c0452f]">{error}</p>}
        <p className="mt-5 text-center text-xs text-[#6b5b45]">
          Cần dùng tài khoản game đã liên kết với Google.
        </p>
      </section>
    </main>
  );
}
