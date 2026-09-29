import { describe, it, expect } from "vitest";
import {
  smoothExp,
  updateCamera,
  createCamState,
  cameraFinalPos,
  shakeOffset,
  clampCamera,
  quantizeForZoom,
  CAMERA_RATE,
} from "../../src/lib/game/phaser/camera-smoothing";

describe("Camera exp smoothing", () => {
  it("smoothExp: frame-rate independent — 30/60/144 FPS cùng kết quả", () => {
    // Cùng tổng dt → cùng kết quả bất kể chia frame.
    const target = 100;
    const start = 0;
    const totalDt = 1; // 1 giây
    // 1 frame 1s
    const one = smoothExp(start, target, totalDt);
    // 60 frames 1/60s
    let many = start;
    for (let i = 0; i < 60; i++) many = smoothExp(many, target, totalDt / 60);
    expect(many).toBeCloseTo(one, 3);
    // 144 frames
    let hfr = start;
    for (let i = 0; i < 144; i++) hfr = smoothExp(hfr, target, totalDt / 144);
    expect(hfr).toBeCloseTo(one, 3);
  });

  it("smoothExp: tiến về target, không vượt", () => {
    const r = smoothExp(0, 100, 0.5);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(100);
  });

  it("smoothExp: dt=0 → không đổi", () => {
    expect(smoothExp(50, 100, 0)).toBe(50);
  });

  it("updateCamera: trong deadzone → ít chase; ngoài → chase", () => {
    let cam = createCamState(0, 0);
    // target trong deadzone (24px, < DEADZONE_W/2=24)
    cam = updateCamera(cam, 10, 0, 0, 0, 0.1);
    expect(Math.abs(cam.x)).toBeLessThan(15);
    // target ngoài deadzone → chase mạnh hơn
    cam = createCamState(0, 0);
    cam = updateCamera(cam, 200, 0, 0, 0, 0.5);
    expect(cam.x).toBeGreaterThan(10);
  });

  it("look-ahead: velocity > 0 → lookaheadX dương, eased", () => {
    const cam = updateCamera(createCamState(0, 0), 0, 0, 200, 0, 1);
    expect(cam.lookaheadX).toBeGreaterThan(0);
  });

  it("cameraFinalPos: +lookahead +shake", () => {
    const cam = { x: 10, y: 20, lookaheadX: 5, lookaheadY: 0 };
    const p = cameraFinalPos(cam, 3, 0);
    expect(p).toEqual({ x: 18, y: 20 });
  });

  it("shakeOffset: trauma² × noise", () => {
    expect(shakeOffset(0, 10)).toBe(0);
    expect(shakeOffset(0.5, 10)).toBeCloseTo(0.25 * 10);
    expect(shakeOffset(1, 10)).toBe(10);
  });

  it("clampCamera: trong bounds; không âm không vượt world - viewport", () => {
    const worldW = 2880;
    const viewW = 800;
    const clamped = clampCamera(50, 0, worldW, 2880, viewW, 600);
    expect(clamped.x).toBe(viewW / 2);
    const hi = clampCamera(worldW - 10, 0, worldW, 2880, viewW, 600);
    expect(hi.x).toBe(worldW - viewW / 2);
  });

  it("CAMERA_RATE = 8 (snappy)", () => {
    expect(CAMERA_RATE).toBe(8);
  });

  it("clampCamera zoom 2/3: half-view = canvas/zoom; homestead X bị đẩy khỏi mép trái", () => {
    const world = 60 * 48;
    const viewW = 960;
    const viewH = 704;
    const zoom = 2 / 3;
    const lo = clampCamera(50, 888, world, world, viewW, viewH, zoom);
    expect(lo.x).toBeCloseTo(viewW / zoom / 2);
    const mid = clampCamera(1400, 888, world, world, viewW, viewH, zoom);
    expect(mid.x).toBe(1400);
  });

  it("clampCamera: world nhỏ hơn viewport (nhà) → ghim tâm map", () => {
    const houseW = 16 * 48;
    const houseH = 12 * 48;
    const c = clampCamera(100, 100, houseW, houseH, 960, 704, 2 / 3);
    expect(c.x).toBe(houseW / 2);
    expect(c.y).toBe(houseH / 2);
  });

  it("quantizeForZoom(2/3): world*zoom là số nguyên px màn", () => {
    const zoom = 2 / 3;
    const q = quantizeForZoom(696.4, zoom);
    expect((q * zoom) % 1).toBeCloseTo(0, 10);
  });
});
