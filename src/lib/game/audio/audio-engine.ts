// Audio engine file-based: 3 bus (music/sfx/ambient) → master. Decode 1 lần và
// cache theo file. Event thiếu file / fetch lỗi → trả false để caller fallback
// procedural (sfx.ts / music.ts cũ). Nguồn file: AUDIO_MANIFEST (Task 10).

import { AUDIO_MANIFEST } from "@/lib/game/audio/audio-manifest";
import { useUiStore } from "@/store/uiStore";

type Bus = "music" | "sfx" | "ambient";

interface EngineState {
  ctx?: AudioContext;
  master?: GainNode;
  buses?: Record<Bus, GainNode>;
  buffers: Map<string, AudioBuffer>;
  looping: Map<string, { src: AudioBufferSourceNode; gain: GainNode }>;
}

const state: EngineState = { buffers: new Map(), looping: new Map() };

// Chống race loop-start: playLoop stop loop hiện tại RỒI await bufferFor (fetch +
// decode). Nếu 2 lệnh start chạy xen kẽ, cả 2 có thể qua bước stop và cùng start
// → double loop / loop mồ côi không stop được.
// - Music: 1 track/bus tại một thời điểm → seq dùng chung cả bus (busSeq.music).
// - Ambient: nhiều event chồng nhau được (birds + cave) — seq dùng chung cả bus
//   sẽ hủy nhầm start in-flight của event KHÁC → seq RIÊNG theo event (loopSeq),
//   stopLoop bump khi xóa để vô hiệu start trễ của đúng event đó.
const busSeq: Record<Bus, number> = { music: 0, sfx: 0, ambient: 0 };
const loopSeq = new Map<string, number>();
// Event ambient có playLoop đang await (chưa kịp đăng ký vào looping) —
// stopBus("ambient") phải bump cả các event này kẻo start trễ "hồi sinh" sau stop-all.
const pendingLoops = new Set<string>();

function nextLoopSeq(event: string): number {
  const n = (loopSeq.get(event) ?? 0) + 1;
  loopSeq.set(event, n);
  return n;
}

export function initAudioEngine(): void {
  if (state.ctx) return;
  if (typeof window === "undefined") return;
  const Ctor = window.AudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const buses = {
    music: ctx.createGain(),
    sfx: ctx.createGain(),
    ambient: ctx.createGain(),
  } as Record<Bus, GainNode>;
  for (const b of Object.values(buses)) b.connect(master);
  state.ctx = ctx;
  state.master = master;
  state.buses = buses;
  applyAudioVolumes();
}

/** Resume AudioContext (autoplay policy: browser suspend tới khi có user gesture). */
export function resumeAudioEngine(): void {
  initAudioEngine();
  if (state.ctx?.state === "suspended") void state.ctx.resume();
}

/** Fetch + decode 1 lần, cache theo đường dẫn file. Lỗi → undefined (caller fallback). */
async function bufferFor(file: string): Promise<AudioBuffer | undefined> {
  const cached = state.buffers.get(file);
  if (cached) return cached;
  if (!state.ctx) return undefined;
  try {
    const res = await fetch(file);
    if (!res.ok) return undefined;
    const buf = await state.ctx.decodeAudioData(await res.arrayBuffer());
    state.buffers.set(file, buf);
    return buf;
  } catch {
    return undefined;
  }
}

export function sfxHasFile(event: string): boolean {
  return AUDIO_MANIFEST.some((e) => e.event === event);
}

/** One-shot SFX. false = không có file / fetch lỗi → caller fallback procedural. */
export async function playSfxFile(event: string): Promise<boolean> {
  initAudioEngine();
  const entry = AUDIO_MANIFEST.find((e) => e.event === event && e.bus === "sfx");
  if (!entry || !state.ctx || !state.buses) return false;
  const buf = await bufferFor(entry.file);
  if (!buf) return false;
  const src = state.ctx.createBufferSource();
  src.buffer = buf;
  const g = state.ctx.createGain();
  g.gain.value = entry.volume ?? 1;
  src.connect(g).connect(state.buses.sfx);
  src.start();
  return true;
}

function stopLoop(event: string): void {
  const cur = state.looping.get(event);
  if (cur) {
    try {
      cur.src.stop();
    } catch {
      /* already stopped */
    }
    state.looping.delete(event);
  }
  // Bump seq của event — vô hiệu playLoop cùng event đang await (chống đăng ký
  // trễ sau stop).
  nextLoopSeq(event);
}

/** Stop mọi loop thuộc bus (music chỉ cho phép 1 track tại một thời điểm). */
function stopBus(bus: Bus): void {
  if (bus === "music") {
    busSeq[bus]++;
    for (const key of [...state.looping.keys()]) {
      if (AUDIO_MANIFEST.find((e) => e.event === key)?.bus === bus) stopLoop(key);
    }
    return;
  }
  // Ambient: bump mọi event đang chạy (stopLoop tự bump) HOẶC đang await —
  // không đụng seq của event khác trên cùng bus.
  for (const key of [...state.looping.keys()]) {
    if (AUDIO_MANIFEST.find((e) => e.event === key)?.bus === bus) stopLoop(key);
  }
  for (const key of [...pendingLoops]) {
    if (AUDIO_MANIFEST.find((e) => e.event === key)?.bus === bus) nextLoopSeq(key);
  }
}

async function playLoop(event: string, bus: Bus): Promise<boolean> {
  initAudioEngine();
  const entry = AUDIO_MANIFEST.find((e) => e.event === event && e.bus === bus);
  if (!entry || !state.ctx || !state.buses) return false;
  // Music: 1 track/bus — stop toàn bus (bump busSeq). Ambient: nhiều event có
  // thể chồng nhau (birds + cave) — chỉ stop cùng event (stopLoop bump seq event).
  // Capture token SAU bước stop: lệnh stop/start mới hơn (sau capture) làm token
  // đổi → start trễ bị hủy (chống double loop + chống start "hồi sinh" sau stop).
  if (bus === "music") {
    stopBus(bus);
  } else {
    stopLoop(event);
    pendingLoops.add(event);
  }
  const token = bus === "music" ? busSeq[bus] : nextLoopSeq(event);
  try {
    const buf = await bufferFor(entry.file);
    if (!buf) return false;
    const stale =
      bus === "music" ? token !== busSeq[bus] : token !== (loopSeq.get(event) ?? -1);
    if (stale) return false;
    const src = state.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = state.ctx.createGain();
    g.gain.value = entry.volume ?? 1;
    src.connect(g).connect(state.buses[bus]);
    src.start();
    state.looping.set(event, { src, gain: g });
    return true;
  } finally {
    // Chỉ holder của token hiện tại được dọn pendingLoops — sibling cùng event
    // bị stale không được xóa entry chung khi call mới hơn còn đang await,
    // nếu không stopBus trong cửa sổ đó sẽ không bump seq → zombie start.
    if (bus !== "music" && token === (loopSeq.get(event) ?? -1)) pendingLoops.delete(event);
  }
}

/**
 * Start track nhạc theo mùa (event `music-<season>`). false = không có file /
 * fetch lỗi → caller (music.ts) fallback procedural pad.
 */
export async function playMusicTrack(event: string): Promise<boolean> {
  return playLoop(event, "music");
}

export function stopMusicTracks(): void {
  stopBus("music");
}

export async function playAmbientTrack(event: string): Promise<boolean> {
  return playLoop(event, "ambient");
}

export function stopAmbientTracks(): void {
  stopBus("ambient");
}

/** Áp volume từ uiStore: muted → master 0/1; 3 volume setting → 3 bus gain. */
export function applyAudioVolumes(): void {
  if (!state.master || !state.buses) return;
  let ui: { muted: boolean; musicVolume: number; sfxVolume: number; ambientVolume: number };
  try {
    ui = useUiStore.getState();
  } catch {
    return;
  }
  state.master.gain.value = ui.muted ? 0 : 1;
  state.buses.music.gain.value = ui.musicVolume;
  state.buses.sfx.gain.value = ui.sfxVolume;
  state.buses.ambient.gain.value = ui.ambientVolume;
}
