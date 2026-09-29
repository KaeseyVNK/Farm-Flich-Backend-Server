// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { PhaserErrorBoundary } from "../../src/components/game/PhaserErrorBoundary";

describe("PhaserErrorBoundary", () => {
  it("getDerivedStateFromError set hasError + message", () => {
    const state = PhaserErrorBoundary.getDerivedStateFromError(new Error("phaser exploded"));
    expect(state.hasError).toBe(true);
    expect(state.message).toContain("phaser exploded");
  });

  it("getDerivedStateFromError handle non-Error throw", () => {
    const state = PhaserErrorBoundary.getDerivedStateFromError("string error");
    expect(state.hasError).toBe(true);
    expect(state.message).toBe("string error");
  });

  it("componentDidCatch log error (không rethrow)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boundary = new PhaserErrorBoundary({ children: null });
    expect(() => boundary.componentDidCatch(new Error("x"))).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("default state hasError=false", () => {
    const boundary = new PhaserErrorBoundary({ children: null });
    expect(boundary.state.hasError).toBe(false);
  });
});
