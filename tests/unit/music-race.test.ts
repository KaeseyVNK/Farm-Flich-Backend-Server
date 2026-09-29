// @vitest-environment jsdom
// Regression test cho race stop→start cùng season trong music.ts.
// Kịch bản: startMusic(Spring) → stopMusic() (fade 1.1s, gen giữ nguyên, isPlaying
// vẫn true) → trong cửa sổ fade mở/đóng start screen nhanh gọi startMusic(Spring)
// lại. Trước fix: branch "already playing same season" return sớm KHÔNG bump gen →
// setTimeout stop cũ thấy gen không đổi → stopAll() dừng track vừa "tiếp tục" →
// âm nhạc im lặng vĩnh viễn (isPlaying=false, không ai gọi startMusic lại).
// Fix: bump musicGen trong branch return sớm → stop đang chờ mất hiệu lực.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as MusicModule from "@/lib/game/music";

// Fake AudioContext — chặn tất cả node tạo thật (không emit sound). Cấu trúc đủ
// cho music.ts: createGain/createOscillator/connect/start/stop/currentTime/state/
// resume + node methods (gain ramps, frequency, detune).
class FakeAudioNode {
  gain = {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
  frequency = { value: 0 };
  detune = { value: 0 };
  type = "sine";
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
class FakeAudioCtx {
  currentTime = 0;
  state = "running" as const;
  destination = new FakeAudioNode();
  createGain = () => new FakeAudioNode();
  createOscillator = () => new FakeAudioNode();
  resume = vi.fn();
}

function installFakeAudio() {
  Object.defineProperty(window, "AudioContext", {
    writable: true,
    configurable: true,
    value: FakeAudioCtx,
  });
}

describe("music stop→start race", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installFakeAudio();
  });

  async function freshModule(): Promise<typeof MusicModule> {
    vi.resetModules();
    return import("@/lib/game/music");
  }

  it("re-starting same season during fade-out keeps the track alive", async () => {
    const music = await freshModule();
    music.startMusic("Spring");
    expect(music.isMusicPlaying()).toBe(true);

    music.stopMusic(); // fade bắt đầu, setTimeout(1.1s) đang chờ
    // Mô phỏng start screen mở→đóng nhanh: gọi lại startMusic cùng season.
    music.startMusic("Spring");
    // isPlaying phải vẫn true (track được giữ lại).
    expect(music.isMusicPlaying()).toBe(true);

    // 1.1s+ sau — nếu bug, stopAll() chạy → isPlaying=false.
    vi.advanceTimersByTime(2000);
    expect(music.isMusicPlaying()).toBe(true);
  });

  it("switching season during fade-out swaps to the new track", async () => {
    const music = await freshModule();
    music.startMusic("Spring");
    music.stopMusic();
    music.startMusic("Summer"); // season khác → branch bình thường, bump gen
    vi.advanceTimersByTime(2000);
    expect(music.isMusicPlaying()).toBe(true);
  });
});
