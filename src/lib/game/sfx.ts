// WebAudio-based sound effect engine. All SFX are generated procedurally with
// oscillators + noise buffers — no external audio files, zero bundle cost.
// Volumes are read from the uiStore at play-time so the UI sliders take effect
// immediately.

import { useUiStore } from "@/store/uiStore";
import { playSfxFile, resumeAudioEngine } from "@/lib/game/audio/audio-engine";

type SfxName =
  | "till"
  | "plant"
  | "water"
  | "chop"
  | "mine"
  | "harvest"
  | "cut"
  | "eat"
  | "click"
  | "error"
  | "levelup"
  | "coin"
  | "rooster"
  | "crickets"
  | "place"
  | "step"
  // Wave 1 P4 — fishing (procedural synth; file .ogg chưa có trong pack).
  | "cast"
  | "bite"
  | "reel"
  | "fishcatch"
  // Wave 2 P4 — cooking (procedural synth).
  | "cook";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);
      // Pre-generate a white-noise buffer for percussive SFX
      const len = ctx.sampleRate * 0.5;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

/** Resume the AudioContext (browsers suspend it until a user gesture). */
export function resumeAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume();
}

/** Read the SFX volume (0..1) from the uiStore. */
function sfxVolume(): number {
  try {
    const s = useUiStore.getState();
    return s.muted ? 0 : s.sfxVolume;
  } catch {
    return 0.5;
  }
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  vol = 0.3,
  attack = 0.005,
  release = 0.05,
) {
  const c = getCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + duration + release);
}

function playSweep(
  fromFreq: number,
  toFreq: number,
  duration: number,
  type: OscillatorType = "sine",
  vol = 0.3,
) {
  const c = getCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fromFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), now + duration);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + duration + 0.05);
}

function playNoise(
  duration: number,
  vol = 0.3,
  filterFreq = 1000,
  filterType: BiquadFilterType = "lowpass",
) {
  const c = getCtx();
  if (!c || !masterGain || !noiseBuffer) return;
  const now = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start(now);
  src.stop(now + duration + 0.05);
}

/**
 * Play a named sound effect. Thử file .ogg qua audio-engine trước (Task 11);
 * event không có file / fetch lỗi → fallback procedural synth. Safe to call
 * anytime; no-ops if audio is off.
 */
export function playSfx(name: SfxName) {
  const vol = sfxVolume();
  if (vol <= 0) return;
  resumeAudioEngine();
  resumeAudio();
  void playSfxFile(name).then((played) => {
    if (!played) playProceduralSfx(name);
  });
}

/** Procedural synth fallback (oscillators + noise) — giữ nguyên hành vi cũ. */
function playProceduralSfx(name: SfxName) {
  const vol = sfxVolume();
  if (vol <= 0) return;
  resumeAudio();
  const c = getCtx();
  if (!c) return;
  // Scale all gains by the user's sfxVolume
  const v = vol;
  switch (name) {
    case "till":
      // dull thud + scratch
      playTone(120, 0.15, "square", 0.25 * v);
      playNoise(0.12, 0.15 * v, 800, "lowpass");
      break;
    case "plant":
      // soft pop
      playSweep(400, 600, 0.12, "sine", 0.2 * v);
      break;
    case "water":
      // shimmering hiss
      playNoise(0.3, 0.18 * v, 3000, "bandpass");
      playTone(800, 0.2, "sine", 0.08 * v);
      break;
    case "chop":
      // woody thunk
      playTone(180, 0.1, "square", 0.3 * v);
      playNoise(0.08, 0.2 * v, 500, "lowpass");
      break;
    case "mine":
      // metallic clink
      playTone(900, 0.08, "square", 0.2 * v);
      playTone(1400, 0.06, "triangle", 0.15 * v);
      playNoise(0.06, 0.12 * v, 4000, "highpass");
      break;
    case "harvest":
      // cheerful two-note
      playTone(660, 0.1, "triangle", 0.2 * v);
      setTimeout(() => playTone(880, 0.12, "triangle", 0.2 * v), 80);
      break;
    case "cut":
      // swish
      playNoise(0.15, 0.15 * v, 2000, "bandpass");
      break;
    case "step":
      // footstep scuff — noise burst 60ms gain thấp (placeholder tới Task 10 sampler)
      playNoise(0.06, 0.1 * v, 900, "lowpass");
      break;
    case "eat":
      // munch
      playTone(200, 0.06, "square", 0.15 * v);
      setTimeout(() => playTone(180, 0.06, "square", 0.15 * v), 70);
      break;
    case "click":
      playTone(600, 0.04, "square", 0.12 * v);
      break;
    case "error":
      playTone(220, 0.12, "sawtooth", 0.18 * v);
      setTimeout(() => playTone(180, 0.12, "sawtooth", 0.18 * v), 100);
      break;
    case "levelup":
      // ascending arpeggio
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => playTone(f, 0.15, "triangle", 0.25 * v), i * 90),
      );
      break;
    case "coin":
      playTone(988, 0.06, "square", 0.2 * v);
      setTimeout(() => playTone(1319, 0.1, "square", 0.2 * v), 50);
      break;
    case "place":
      playTone(440, 0.08, "square", 0.2 * v);
      playNoise(0.05, 0.1 * v, 600, "lowpass");
      break;
    case "rooster":
      // day-start crow
      playSweep(300, 800, 0.25, "sawtooth", 0.2 * v);
      setTimeout(() => playSweep(800, 400, 0.2, "sawtooth", 0.18 * v), 200);
      break;
    case "crickets":
      // night chirps
      for (let i = 0; i < 4; i++) {
        setTimeout(() => playTone(2000 + Math.random() * 500, 0.03, "square", 0.08 * v), i * 120);
      }
      break;
    case "cast":
      // quẳng cần — whoosh ngắn + splash noise
      playSweep(600, 200, 0.12, "sine", 0.15 * v);
      setTimeout(() => playNoise(0.15, 0.2 * v, 1400, "lowpass"), 80);
      break;
    case "bite":
      // cá cắn — plop 2 nốt lên
      playSweep(300, 700, 0.1, "sine", 0.25 * v);
      setTimeout(() => playSweep(500, 900, 0.08, "sine", 0.2 * v), 90);
      break;
    case "reel":
      // tiếng kén — tick nhịp
      playTone(1500, 0.03, "square", 0.08 * v);
      break;
    case "fishcatch":
      // bắt được — chime 2 tone vui
      playTone(880, 0.12, "triangle", 0.22 * v);
      setTimeout(() => playTone(1320, 0.18, "triangle", 0.22 * v), 110);
      break;
    case "cook":
      // W2 — xèo chảo: hai tone sawtooth ấm đi xuống
      playTone(520, 0.16, "sawtooth", 0.1 * v);
      setTimeout(() => playTone(390, 0.22, "sawtooth", 0.08 * v), 120);
      break;
  }
}
