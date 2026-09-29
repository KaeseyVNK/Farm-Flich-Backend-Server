// @vitest-environment jsdom
// Ambient director (Task 12) — chọn ambient track theo zone + giờ trong ngày.
// ambientTrackFor là pure function; module import audio-engine (side-effect
// an toàn — lazy init) nên dùng jsdom env như audio-engine.test.ts.
// Phần createAmbientDirector mock audio-engine để assert call ordering
// (stop → resume → play) — nửa caller-side của race contract Task 11.
import { describe, it, expect, vi, beforeEach } from "vitest";

const playAmbientTrack = vi.fn().mockResolvedValue(true);
const stopAmbientTracks = vi.fn();
const resumeAudioEngine = vi.fn();
vi.mock("@/lib/game/audio/audio-engine", () => ({
  playAmbientTrack: (...a: unknown[]) => playAmbientTrack(...a),
  stopAmbientTracks: (...a: unknown[]) => stopAmbientTracks(...a),
  resumeAudioEngine: (...a: unknown[]) => resumeAudioEngine(...a),
}));

import { ambientTrackFor, createAmbientDirector } from "@/lib/game/audio/ambient-director";

describe("ambientTrackFor", () => {
  it("farm ngày → birds, đêm → crickets", () => {
    expect(ambientTrackFor("farm", 600)).toBe("amb-day-birds");
    expect(ambientTrackFor("farm", 60)).toBe("amb-night-crickets");
  });
  it("beach → waves bất kể giờ", () => {
    expect(ambientTrackFor("beach", 600)).toBe("amb-beach-waves");
  });
  it("cave → drips", () => {
    expect(ambientTrackFor("cave", 600)).toBe("amb-cave-drips");
  });
  it("house → none", () => {
    expect(ambientTrackFor("house", 600)).toBe("none");
  });
});

describe("createAmbientDirector", () => {
  beforeEach(() => {
    playAmbientTrack.mockClear();
    stopAmbientTracks.mockClear();
    resumeAudioEngine.mockClear();
  });

  it("update cùng track liên tục — no-op (không stop/play lại)", () => {
    const d = createAmbientDirector();
    d.update("farm", 600);
    expect(playAmbientTrack).toHaveBeenCalledTimes(1);
    // Clear sau lần switch đầu (none → track vẫn đi qua stop; đó là hợp lệ).
    playAmbientTrack.mockClear();
    stopAmbientTracks.mockClear();
    d.update("farm", 610);
    d.update("farm", 700);
    expect(playAmbientTrack).not.toHaveBeenCalled();
    expect(stopAmbientTracks).not.toHaveBeenCalled();
  });

  it("đổi track: stop → resumeAudioEngine → play track mới (đúng thứ tự)", () => {
    const d = createAmbientDirector();
    d.update("farm", 600); // birds
    playAmbientTrack.mockClear();
    stopAmbientTracks.mockClear();
    resumeAudioEngine.mockClear();
    d.update("farm", 1200); // đêm → crickets
    expect(stopAmbientTracks).toHaveBeenCalledTimes(1);
    expect(resumeAudioEngine).toHaveBeenCalledTimes(1);
    expect(playAmbientTrack).toHaveBeenCalledWith("amb-night-crickets");
    // Thứ tự thật: stop → resume → play (qua invocationCallOrder).
     
    const calls = (stopAmbientTracks as any).mock.invocationCallOrder?.[0] ?? 0;
     
    const resume = (resumeAudioEngine as any).mock.invocationCallOrder?.[0] ?? 0;
     
    const play = (playAmbientTrack as any).mock.invocationCallOrder?.[0] ?? 0;
    expect(calls).toBeLessThan(resume);
    expect(resume).toBeLessThan(play);
  });

  it("chuyển sang zone none (house) — stop, KHÔNG play track mới", () => {
    const d = createAmbientDirector();
    d.update("farm", 600); // birds đang chạy
    stopAmbientTracks.mockClear();
    playAmbientTrack.mockClear();
    d.update("house", 600);
    expect(stopAmbientTracks).toHaveBeenCalledTimes(1);
    expect(playAmbientTrack).not.toHaveBeenCalled();
  });

  it("destroy — stop ambient, update sau destroy bật lại bình thường", () => {
    const d = createAmbientDirector();
    d.update("farm", 600);
    stopAmbientTracks.mockClear();
    d.destroy();
    expect(stopAmbientTracks).toHaveBeenCalledTimes(1);
    // Sau destroy, current = "none" → update lại zone thường sẽ play lại.
    playAmbientTrack.mockClear();
    d.update("farm", 600);
    expect(playAmbientTrack).toHaveBeenCalledWith("amb-day-birds");
  });
});
