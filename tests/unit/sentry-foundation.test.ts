import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

describe("Sentry foundation (no-op without DSN)", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  it("initSentry no-op khi không DSN (không throw)", async () => {
    const { initSentry, captureException } = await import("../../src/lib/telemetry/sentry");
    expect(() => initSentry()).not.toThrow();
    expect(() => captureException(new Error("test"))).not.toThrow();
  });

  it("captureException không crash khi DSN set nhưng network fail", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://fake@sentry.example/1";
    const { captureException } = await import("../../src/lib/telemetry/sentry");
    expect(() => captureException(new Error("boom"), { ctx: 1 })).not.toThrow();
  });
});
