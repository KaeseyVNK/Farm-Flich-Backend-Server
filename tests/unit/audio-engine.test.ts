// @vitest-environment jsdom
// Audio engine (Task 11) — 3 bus music/sfx/ambient → master, file-based qua
// AUDIO_MANIFEST. Mock WebAudio + fetch TRƯỚC khi import module (pattern
// music-race.test.ts). Fetch luôn lỗi → verify đường fallback (trả false để
// caller dùng procedural).
import { describe, it, expect, vi, beforeEach } from "vitest";

const gains: number[] = [];
class FakeGain {
  gain = { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
  connect() {
    gains.push(0);
    return this;
  }
}
class FakeBufferSource {
  buffer: unknown = null;
  loop = false;
  start = vi.fn();
  stop = vi.fn();
  // WebAudio semantics: connect trả về node đích để chain src.connect(g).connect(bus)
  connect = vi.fn((node: unknown) => node);
}
const sources: FakeBufferSource[] = [];
class FakeCtx {
  currentTime = 0;
  destination = {};
  createGain() {
    return new FakeGain();
  }
  createBufferSource() {
    const s = new FakeBufferSource();
    sources.push(s);
    return s;
  }
  decodeAudioData = vi.fn().mockResolvedValue({ duration: 1 });
}
vi.stubGlobal("AudioContext", FakeCtx);
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

import {
  initAudioEngine,
  playSfxFile,
  applyAudioVolumes,
  sfxHasFile,
  playMusicTrack,
  stopMusicTracks,
  playAmbientTrack,
  stopAmbientTracks,
} from "@/lib/game/audio/audio-engine";
import { AUDIO_MANIFEST } from "@/lib/game/audio/audio-manifest";

describe("audio-engine", () => {
  beforeEach(() => {
    initAudioEngine();
  });
  it("initAudioEngine idempotent", () => {
    expect(() => {
      initAudioEngine();
      initAudioEngine();
    }).not.toThrow();
  });
  it("sfxHasFile theo manifest", () => {
    expect(sfxHasFile("till")).toBe(AUDIO_MANIFEST.some((e) => e.event === "till"));
  });
  it("playSfxFile trả false khi fetch lỗi (caller fallback procedural)", async () => {
    await expect(playSfxFile("till")).resolves.toBe(false);
  });
  it("applyAudioVolumes không throw khi muted", async () => {
    const { useUiStore } = await import("@/store/uiStore");
    useUiStore.getState().setMuted(true);
    expect(() => applyAudioVolumes()).not.toThrow();
    useUiStore.getState().setMuted(false);
  });
});

// ---- Race-guard regression: playLoop stop-then-await (fetch/decode) ----
// Fetch mock điều khiển được (deferred) — mô phỏng 2 lệnh start xen kẽ, stop
// giữa await. Mỗi test dùng event KHÁC NHAU: engine cache buffer theo file,
// cache hit sẽ bỏ qua fetch → mất window race.
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
}
function defer<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function okResponse() {
  return { ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) };
}
function startedSince(before: number): FakeBufferSource[] {
  return sources.slice(before).filter((s) => s.start.mock.calls.length > 0);
}

describe("audio-engine loop race guard", () => {
  it("(a) hai playMusicTrack(A) xen kẽ — chỉ lệnh sau cùng start (1 source)", async () => {
    const d1 = defer<Response>();
    const d2 = defer<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise));
    const before = sources.length;

    const p1 = playMusicTrack("music-spring");
    const p2 = playMusicTrack("music-spring");
    // Lệnh 2 hoàn thành trước (fetch resolve trước) → lệnh 1 thành stale.
    d2.resolve(okResponse() as unknown as Response);
    await expect(p2).resolves.toBe(true);
    d1.resolve(okResponse() as unknown as Response);
    await expect(p1).resolves.toBe(false);

    const started = startedSince(before);
    expect(started).toHaveLength(1);
    expect(started[0].loop).toBe(true);
  });

  it("(b) stopMusicTracks trong lúc await — không có looping entry, không source nào start", async () => {
    const d = defer<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(d.promise));
    const before = sources.length;

    const p = playMusicTrack("music-summer");
    stopMusicTracks(); // chạy trong lúc fetch đang treo
    d.resolve(okResponse() as unknown as Response);
    await expect(p).resolves.toBe(false);

    // Không source nào được tạo (createBufferSource chỉ gọi sau khi qua stale-check)
    expect(sources.length).toBe(before);
    expect(startedSince(before)).toHaveLength(0);
  });

  it("(c) hai playAmbientTrack cùng event xen kẽ — đúng 1 source start cho event đó", async () => {
    const d1 = defer<Response>();
    const d2 = defer<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise));
    const before = sources.length;

    const p1 = playAmbientTrack("amb-day-birds");
    const p2 = playAmbientTrack("amb-day-birds");
    d2.resolve(okResponse() as unknown as Response);
    await expect(p2).resolves.toBe(true);
    d1.resolve(okResponse() as unknown as Response);
    await expect(p1).resolves.toBe(false);

    const started = startedSince(before);
    expect(started).toHaveLength(1);
    expect(started[0].loop).toBe(true);
  });

  it("(d) stopAmbientTracks trong lúc await (pendingLoops path) — không source nào start", async () => {
    const d = defer<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(d.promise));
    const before = sources.length;

    const p = playAmbientTrack("amb-beach-waves");
    stopAmbientTracks(); // chạy trong lúc fetch đang treo
    d.resolve({ ok: false } as unknown as Response);
    await expect(p).resolves.toBe(false);

    expect(sources.length).toBe(before);
    expect(startedSince(before)).toHaveLength(0);
  });

  it("(e) hai ambient event KHÁC nhau chồng nhau — cả hai cùng chạy", async () => {
    const d1 = defer<Response>();
    const d2 = defer<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise));
    const before = sources.length;

    // amb-beach-waves chưa được cache (test d resolve ok:false) → fetch thật.
    const pA = playAmbientTrack("amb-beach-waves");
    const pB = playAmbientTrack("amb-night-crickets");
    d1.resolve(okResponse() as unknown as Response);
    d2.resolve(okResponse() as unknown as Response);
    await expect(pA).resolves.toBe(true);
    // pB resolve sau — cả hai start, không cancel lẫn nhau.
    await expect(pB).resolves.toBe(true);

    const started = startedSince(before);
    expect(started).toHaveLength(2);
    expect(started.every((s) => s.loop)).toBe(true);

    stopAmbientTracks();
  });

  it("(f) sibling cùng event bị stale KHÔNG được dọn pendingLoops — stopAll giữa 2 fetch vẫn hủy start trễ", async () => {
    const d1 = defer<Response>();
    const d2 = defer<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise));
    const before = sources.length;

    const p1 = playAmbientTrack("amb-cave-drips");
    const p2 = playAmbientTrack("amb-cave-drips");
    // Fetch của lệnh STALE (p1) resolve trước — finally của p1 không được xóa
    // entry pendingLoops chung, nếu không stopAll dưới đây không bump seq.
    d1.resolve(okResponse() as unknown as Response);
    await expect(p1).resolves.toBe(false);
    stopAmbientTracks(); // rơi vào cửa sổ p2 còn đang await
    d2.resolve(okResponse() as unknown as Response);
    await expect(p2).resolves.toBe(false);

    expect(startedSince(before)).toHaveLength(0);
  });
});
