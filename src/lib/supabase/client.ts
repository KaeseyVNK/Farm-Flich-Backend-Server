import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client cho Client Components (browser). Singleton — mỗi call trả cùng
 * instance (trước đây tạo new client mỗi render → auth listener + session fetch
 * leak khi component re-render). globalThis guard giữ 1 instance qua React
 * StrictMode double-mount + Next.js dev hot-reload.
 */
export function createClient() {
  const g = globalThis as typeof globalThis & { __supabaseBrowser?: ReturnType<typeof createBrowserClient> };
  if (g.__supabaseBrowser) return g.__supabaseBrowser;
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  g.__supabaseBrowser = client;
  return client;
}
