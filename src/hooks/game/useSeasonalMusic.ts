"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";
import { startMusic, stopMusic, updateVolume } from "@/lib/game/music";
import { applyAudioVolumes } from "@/lib/game/audio/audio-engine";

/**
 * useSeasonalMusic — starts the seasonal music track (file-based qua audio
 * engine, fallback procedural) when the player enters the game, switches tracks
 * when the season changes, and updates the volume when an audio setting changes.
 * Music is stopped while the start screen is showing.
 */
export function useSeasonalMusic() {
  const season = useGameStore((s) => s.season);
  const showStartScreen = useUiStore((s) => s.showStartScreen);
  const musicVolume = useUiStore((s) => s.musicVolume);
  const ambientVolume = useUiStore((s) => s.ambientVolume);
  const sfxVolume = useUiStore((s) => s.sfxVolume);
  const muted = useUiStore((s) => s.muted);

  // Start/stop music based on start-screen visibility
  useEffect(() => {
    if (showStartScreen) {
      stopMusic();
    } else {
      startMusic(season);
    }
    // Cleanup: component unmount (logout/navigate ra ngoài GameLayout, ví dụ
    // /play, /auth) → WebAudio vẫn chạy nếu không stop → leak audio ngầm sau
    // logout. stopMusic() là no-op nếu chưa từng start.
    return () => {
      stopMusic();
    };
  }, [showStartScreen, season]);

  // Update volume when the setting changes — áp cho cả 3 bus của audio engine.
  // sfxVolume PHẢI nằm trong deps: bus gain của engine chỉ áp qua
  // applyAudioVolumes() (không đọc store lúc play như path procedural cũ).
  useEffect(() => {
    applyAudioVolumes();
    updateVolume();
  }, [musicVolume, ambientVolume, sfxVolume, muted]);
}
