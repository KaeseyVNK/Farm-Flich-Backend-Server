// Ambient director (Task 12) — chọn ambient track theo zone + giờ trong ngày.
// Day = 6:00–18:00 (360–1080 phút). Beach/cave ghi đè giờ (waves/drips luôn),
// house im lặng. Director switch track CHỈ khi track đổi (re-check mỗi call
// rất rẻ — so sánh chuỗi) để gọi an toàn mỗi frame từ FarmScene.update().
import { playAmbientTrack, stopAmbientTracks, resumeAudioEngine } from "./audio-engine";

export type AmbientTrack =
  | "amb-day-birds"
  | "amb-night-crickets"
  | "amb-beach-waves"
  | "amb-cave-drips"
  | "none";

/** Pure: zone + phút trong ngày → ambient track. */
export function ambientTrackFor(zone: string, timeMinutes: number): AmbientTrack {
  if (zone === "beach") return "amb-beach-waves";
  if (zone === "cave") return "amb-cave-drips";
  if (zone === "house") return "none";
  const day = timeMinutes >= 360 && timeMinutes < 1080;
  return day ? "amb-day-birds" : "amb-night-crickets";
}

export function createAmbientDirector(): {
  update(zone: string, timeMinutes: number): void;
  destroy(): void;
} {
  let current: AmbientTrack = "none";
  return {
    update(zone, timeMinutes) {
      const next = ambientTrackFor(zone, timeMinutes);
      if (next === current) return;
      current = next;
      stopAmbientTracks();
      if (next !== "none") {
        // Autoplay policy: browser suspend AudioContext tới user gesture —
        // resume thử mỗi lần switch track (mirror pattern resumeAudio() sfx.ts;
        // race-guarded bên trong audio-engine, no-op nếu đã running).
        resumeAudioEngine();
        void playAmbientTrack(next);
      }
    },
    destroy() {
      current = "none";
      stopAmbientTracks();
    },
  };
}
