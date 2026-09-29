import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * OAuth callback (Google). Exchange code → session → redirect `/`.
 * Review H6: sanitize `next` — userinfo trick (`@evil.com`), dot-host
 * (`.evil.com`), protocol-relative (`//evil.com`) đều cho host ngoài. Chỉ accept
 * path-relative bắt đầu bằng `/` và không có `//`/`@`/`\` ở đầu segment.
 */
function safeNextPath(rawNext: string | null): string {
  const next = rawNext ?? "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("@") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Redirect qua /login?migrate=1 — client hydrate + migrate local→cloud 1 chiều
      // sau OAuth. Callback là server component (không hydrate stores), migrate phải
      // chạy ở client. next mặc định "/" — migrate rồi mới về home.
      const target = next === "/" ? "/login?migrate=1" : next;
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  // Lỗi exchange — về login
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
