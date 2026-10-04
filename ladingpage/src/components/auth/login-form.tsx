"use client";

/**
 * Form đăng nhập username/password → POST {GAME_API}/auth/login.
 * Thành công: lưu phiên (session.ts) — parent (LoginSection) sẽ chuyển sang
 * thẻ tài khoản và nút Launch Game.
 */

import { useState } from "react";
import { LogIn } from "lucide-react";
import { loginWithPassword } from "./session";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await loginWithPassword(username, password);
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    // Thành công: LoginSection đọc lại store → chuyển sang thẻ tài khoản;
    // The game continues account/character setup after launch when required.
  }

  const inputClass =
    "pixel-border-sm h-12 w-full rounded-md bg-white px-3 text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={onSubmit} className="pixel-border mx-auto flex w-full max-w-md flex-col gap-4 bg-[#fffcf0] p-6 shadow-[4px_4px_0_#231b18] md:p-8">
      <div>
        <h2 className="font-display text-2xl font-extrabold text-ink">Log In</h2>
        <p className="mt-1 text-sm font-semibold text-ink/70">
          Use the account you play Farm &amp; Filch with, then press Launch Game.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="login-username" className="text-sm font-extrabold text-ink">
          Username
        </label>
        <input
          id="login-username"
          name="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="your in-game username"
          aria-invalid={Boolean(error)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="login-password" className="text-sm font-extrabold text-ink">
          Password
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={4}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="your password"
          aria-invalid={Boolean(error)}
          className={inputClass}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-bold text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="pixel-shadow-hover inline-flex h-12 items-center justify-center gap-2 border-[3px] border-[#231b18] bg-sun px-5 font-display text-base font-extrabold text-[#231b18] shadow-[3px_3px_0_#231b18] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7c948] disabled:translate-y-0 disabled:opacity-60"
      >
        <LogIn className="size-4" aria-hidden="true" />
        {submitting ? "Logging in…" : "Log in"}
      </button>
      <p className="text-sm font-bold text-ink/60" role="status" aria-live="polite">
        New account? Choose 1–10 letters, numbers or underscores. Existing account names still work.
      </p>
    </form>
  );
}
