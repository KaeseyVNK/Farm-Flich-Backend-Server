import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

/**
 * Trang upgrade tài khoản (email/oauth). Nếu đã login non-anonymous → redirect `/`.
 * Anonymous user vẫn vào đây để upgrade (giữ user.id + data).
 */
export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && !user.is_anonymous) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6efe0] p-4">
      {/* LoginForm dùng useSearchParams (?migrate=1) — cần Suspense boundary để tránh
          CSR bailout khi static rendering (Next.js App Router). */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
