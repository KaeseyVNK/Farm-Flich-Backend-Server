import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh + validate Supabase session mỗi request (Next.js 16 proxy).
 * Per-request client — KHÔNG cache global.
 *
 * MVP: anonymous được phép mọi route (signInAnonymously tạo user tạm).
 * Proxy chỉ refresh session, KHÔNG ép redirect — UI tự gate (StartScreen).
 * Sau upgrade login, session persistent qua cookie.
 *
 * Dùng getUser() (verify JWT server-side, stable supabase-js 2.112).
 * ponytail: research đề xuất getClaims() (mới, chống session spoof) —
 * swap khi supabase-js stable getClaims; getUser đủ anti-spoof cho MVP.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([k, v]) =>
            response.headers.set(k, v as string),
          );
        },
      },
    },
  );

  // Refresh session (đọc + validate JWT). Không redirect — anon OK.
  await supabase.auth.getUser();

  return response;
}
