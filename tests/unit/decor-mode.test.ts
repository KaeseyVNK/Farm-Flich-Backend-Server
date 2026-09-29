import { describe, it, expect } from "vitest";
import {
  initialDecorMode,
  nextDecorMode,
  type DecorModeState,
} from "../../src/lib/game/decor/decor-mode";

const s0 = initialDecorMode();

describe("decor-mode SM (W3 P4)", () => {
  it("enter với defId → active, cursor tại vị trí player", () => {
    const s = nextDecorMode(s0, { type: "enter", defId: "fence_wood", tx: 10, ty: 10 });
    expect(s.active).toBe(true);
    expect(s.defId).toBe("fence_wood");
    expect(s.cursorTx).toBe(10);
    expect(s.rot).toBe(0);
  });

  it("enter không defId = chế độ chỉnh sửa (nhặt/xoay decor có sẵn)", () => {
    const s = nextDecorMode(s0, { type: "enter", tx: 10, ty: 10 });
    expect(s.active).toBe(true);
    expect(s.defId).toBeNull();
  });

  it("exit → về initial (giữ cursor reset)", () => {
    const s = nextDecorMode(nextDecorMode(s0, { type: "enter", defId: "fence_wood", tx: 5, ty: 5 }), { type: "exit" });
    expect(s.active).toBe(false);
    expect(s.defId).toBeNull();
  });

  it("move dịch cursor, clamp theo bounds event", () => {
    let s = nextDecorMode(s0, { type: "enter", defId: "fence_wood", tx: 10, ty: 10 });
    s = nextDecorMode(s, { type: "move", dx: 1, dy: 0, cols: 60, rows: 60 });
    expect(s.cursorTx).toBe(11);
    s = nextDecorMode(s, { type: "move", dx: 0, dy: -5, cols: 60, rows: 60 });
    expect(s.cursorTy).toBe(5);
    s = nextDecorMode(s, { type: "move", dx: -99, dy: 0, cols: 60, rows: 60 });
    expect(s.cursorTx).toBe(0);
    s = nextDecorMode(s, { type: "move", dx: 99, dy: 0, cols: 60, rows: 60 });
    expect(s.cursorTx).toBe(59);
  });

  it("rotate vòng 0→90→180→270→0; flip lật", () => {
    let s = nextDecorMode(s0, { type: "enter", defId: "fence_wood", tx: 1, ty: 1 });
    expect(s.rot).toBe(0);
    s = nextDecorMode(s, { type: "rotate" });
    expect(s.rot).toBe(90);
    s = nextDecorMode(s, { type: "rotate" });
    expect(s.rot).toBe(180);
    s = nextDecorMode(s, { type: "rotate" });
    expect(s.rot).toBe(270);
    s = nextDecorMode(s, { type: "rotate" });
    expect(s.rot).toBe(0);
    s = nextDecorMode(s, { type: "flip" });
    expect(s.flip).toBe(true);
    s = nextDecorMode(s, { type: "flip" });
    expect(s.flip).toBe(false);
  });

  it("place-ok khi hết kho → thoát chế độ; còn kho → giữ để đặt tiếp", () => {
    let s = nextDecorMode(s0, { type: "enter", defId: "fence_wood", tx: 1, ty: 1 });
    s = nextDecorMode(s, { type: "place-ok", remaining: 0 });
    expect(s.active).toBe(false);
    let s2 = nextDecorMode(s0, { type: "enter", defId: "fence_wood", tx: 1, ty: 1 });
    s2 = nextDecorMode(s2, { type: "place-ok", remaining: 2 });
    expect(s2.active).toBe(true);
  });

  it("event khi inactive → no-op (trừ enter)", () => {
    expect(nextDecorMode(s0, { type: "move", dx: 1, dy: 1, cols: 60, rows: 60 })).toBe(s0);
    expect(nextDecorMode(s0, { type: "rotate" })).toBe(s0);
  });

  it("target: uid dưới con trỏ (chế độ chỉnh sửa) — set/clear", () => {
    let s = nextDecorMode(s0, { type: "enter", tx: 3, ty: 3 });
    s = nextDecorMode(s, { type: "target", uid: "u9" });
    expect(s.uid).toBe("u9");
    s = nextDecorMode(s, { type: "target", uid: null });
    expect(s.uid).toBeNull();
  });
});
