// Sentry foundation (phase 1). Full rollout phase 9.
// Lazy init: chỉ init khi NEXT_PUBLIC_SENTRY_DSN set. No-op dev/test.
// Capture exception + breadcrumb cho asset-load warn (phase 1) + cloud sync (phase 6).
import * as Sentry from "@sentry/nextjs";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return; // no-op khi chưa cấu hình
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_RATE ?? 0.1),
    environment: process.env.NODE_ENV,
  });
  initialized = true;
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) initSentry();
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export function addBreadcrumb(msg: string, category: string, level: "info" | "warning" | "error" = "info"): void {
  if (!initialized) return; // breadcrumb chỉ khi đã init (prod)
  Sentry.addBreadcrumb({ message: msg, category, level });
}
