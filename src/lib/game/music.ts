// Procedural background music engine. Generates a slow, looping ambient pad
// per season using WebAudio oscillators — no external audio files.
// Each season has a distinct chord progression + timbre:
//   Spring: bright major 7th (Cmaj7) — hopeful
//   Summer: lively major (Fmaj) — warm
//   Fall:   minor 7th (Am7) — mellow
//   Winter: sparse minor (Dm) — cold/ethereal

import { useUiStore } from "@/store/uiStore";
import type { Season } from "@/lib/game/constants";
import {
  playMusicTrack,
  stopMusicTracks,
  applyAudioVolumes,
  resumeAudioEngine,
} from "@/lib/game/audio/audio-engine";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let activeNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
let lfo: OscillatorNode | null = null;
let lfoGain: GainNode | null = null;
let currentSeason: Season | null = null;
let isPlaying = false;
// Generation token chống race stop→start nhanh. stopMusic() hẹn giờ stopAll()
// sau 1.1s (fade). Nếu startMusic() gọi trước đó (đóng start screen ngay), token
// tăng → setTimeout cũ thấy token cũ → bỏ qua → không dừng nhầm track mới.
let musicGen = 0;
// Token chống race stop→start với file-based track: startMusic() await fetch
// của playMusicTrack; nếu stopMusic() chạy trong lúc await, token bump → callback
// trễ bỏ qua (không start track đã stop, không fallback procedural sai lúc).
let fileStartSeq = 0;

// Chord frequencies (Hz) for each season — root, third, fifth, seventh
const CHORDS: Record<Season, { freqs: number[]; type: OscillatorType; rate: number }> = {
  Spring: { freqs: [261.63, 329.63, 392.0, 493.88], type: "sine", rate: 0.08 }, // Cmaj7
  Summer: { freqs: [174.61, 261.63, 349.23, 440.0], type: "triangle", rate: 0.1 }, // Fmaj
  Fall: { freqs: [220.0, 261.63, 329.63, 392.0], type: "sine", rate: 0.06 }, // Am7
  Winter: { freqs: [146.83, 174.61, 220.0, 293.66], type: "sine", rate: 0.04 }, // Dm
};

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

function stopAll() {
  for (const node of activeNodes) {
    try {
      node.gain.gain.cancelScheduledValues(ctx?.currentTime ?? 0);
      node.gain.gain.setValueAtTime(node.gain.gain.value, ctx?.currentTime ?? 0);
      node.gain.gain.exponentialRampToValueAtTime(0.001, (ctx?.currentTime ?? 0) + 0.5);
      node.osc.stop((ctx?.currentTime ?? 0) + 0.6);
    } catch {
      /* noop */
    }
  }
  activeNodes = [];
  if (lfo) {
    try {
      lfo.stop();
    } catch {
      /* noop */
    }
    lfo = null;
  }
  lfoGain = null;
}

/**
 * Start (or switch) the seasonal music track. Thử file .ogg qua audio-engine
 * (bus music, event `music-<season>`); fetch lỗi → fallback procedural pad.
 * Safe to call repeatedly.
 */
export function startMusic(season: Season) {
  resumeAudioEngine();
  // If already playing this season, do nothing. Bump gen: nếu stopMusic() vừa
  // fade (setTimeout 1.1s đang chờ, isPlaying vẫn true, currentSeason giữ nguyên)
  // và startMusic cùng season gọi lại ngay (mở→đóng start screen nhanh), branch
  // này return sớm — nếu không bump, setTimeout cũ thấy gen không đổi → stopAll
  // dừng nhầm track vừa "tiếp tục" → âm nhạc im lặng vĩnh viễn (không ai gọi
  // startMusic lại). Bump gen hủy hiệu lực stop đang chờ; vô hại nếu không có.
  if (isPlaying && currentSeason === season) {
    musicGen++;
    updateVolume();
    // stopMusic() có thể vừa stop file track (stopMusicTracks) trong lúc fade —
    // phát lại file (cache sẵn, gần như liền mạch); fetch lỗi thì fallback pad.
    tryFileMusic(season);
    return;
  }

  currentSeason = season;
  isPlaying = true;
  // Bump gen — hủy hiệu lực setTimeout stopMusic() đang chờ (race stop→start).
  musicGen++;
  tryFileMusic(season);
}

/** Route qua file engine, fallback procedural nếu không có file / fetch lỗi. */
function tryFileMusic(season: Season) {
  const seq = ++fileStartSeq;
  void playMusicTrack(`music-${season.toLowerCase()}`).then((played) => {
    if (played) return; // file track đang phát trên bus music của audio-engine
    // Chỉ fallback khi lệnh start này vẫn mới nhất (không bị stopMusic/ lệnh
    // khác vượt qua trong lúc await fetch) và season chưa đổi.
    if (seq !== fileStartSeq || currentSeason !== season) return;
    startProceduralMusic(season);
  });
}

/** Procedural pad fallback (oscillator chord + tremolo LFO) — hành vi cũ. */
function startProceduralMusic(season: Season) {
  const c = getCtx();
  if (!c || !masterGain) return;
  if (c.state === "suspended") c.resume();

  // Fade out + stop existing
  stopAll();
  const chord = CHORDS[season];
  const now = c.currentTime;

  // Set master gain (fades in over 2s)
  const vol = musicVolume();
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(vol, now + 2);

  // Create a slow LFO to modulate the master gain for a gentle tremolo
  lfo = c.createOscillator();
  lfoGain = c.createGain();
  lfo.frequency.value = chord.rate;
  lfoGain.gain.value = vol * 0.25; // 25% depth
  lfo.connect(lfoGain);
  lfoGain.connect(masterGain.gain);
  lfo.start(now);

  // Create the chord pad — 4 detuned oscillators
  for (let i = 0; i < chord.freqs.length; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = chord.type;
    osc.frequency.value = chord.freqs[i];
    // Slight detune for richness
    osc.detune.value = (i - 1.5) * 4;
    // Each voice at lower volume; sum stays balanced
    const voiceVol = 0.15 / chord.freqs.length;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(voiceVol, now + 2);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    activeNodes.push({ osc, gain });
  }
}

/** Stop the music (fades out over 1s). */
export function stopMusic() {
  // Vô hiệu file start đang await fetch + stop file loop trên bus music.
  fileStartSeq++;
  stopMusicTracks();
  const c = getCtx();
  if (!c || !masterGain) return;
  const gen = musicGen;
  const now = c.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(0, now + 1);
  setTimeout(() => {
    // Skip nếu startMusic() chạy trong lúc fade — track mới không bị dừng nhầm.
    if (gen !== musicGen) return;
    stopAll();
    isPlaying = false;
    currentSeason = null;
  }, 1100);
}

/** Update the master gain to match the current musicVolume setting. */
export function updateVolume() {
  // Bus gain của audio-engine áp luôn (file-based không có fade riêng).
  applyAudioVolumes();
  const c = getCtx();
  if (!c || !masterGain || !isPlaying) return;
  const now = c.currentTime;
  const vol = musicVolume();
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(vol, now + 0.3);
  if (lfoGain) lfoGain.gain.value = vol * 0.25;
}

function musicVolume(): number {
  try {
    const s = useUiStore.getState();
    return s.muted ? 0 : s.musicVolume;
  } catch {
    return 0.3;
  }
}

export function isMusicPlaying(): boolean {
  return isPlaying;
}
