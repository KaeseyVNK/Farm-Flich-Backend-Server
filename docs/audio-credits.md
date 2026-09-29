# Audio Credits

Tất cả file trong `public/audio/` chỉ dùng nguồn **CC0** hoặc **CC-BY** (đã được duyệt trong Task 10).
Không dùng CC-BY-SA / NC / GPL. Event nào không có file sẽ fallback về procedural WebAudio (`src/lib/game/sfx.ts`, `music.ts`).

## Bảng credit chi tiết

### SFX (`public/audio/sfx/`)

| File | Event | Nguồn (pack) | Tác giả | License |
| --- | --- | --- | --- | --- |
| `till.ogg` | till | https://opengameart.org/content/shovel-sound | themightyglider | CC0 |
| `mine.ogg` | mine | https://opengameart.org/content/breaking-rock | themightyglider | CC0 |
| `chop.ogg` | chop | https://opengameart.org/content/tree-chop-fall-thud (cắt 0.85s đầu — tiếng rìu chém, bỏ phần cây đổ) | kheetor | CC0 |
| `water.ogg` | water | https://opengameart.org/content/sound-effects-pack (Owlish Media Sound Effects, `Water/spray-bottle.wav`, cắt 1.8s) | OwlishMedia | CC0 |
| `eat.ogg` | eat | https://opengameart.org/content/rabbit-eating (`RabbitEating.wav`, cắt 1.6s đầu) | Voltiment555 | CC0 |
| `step.ogg` | step | https://opengameart.org/content/footsteps-0 (`01-footstep.ogg`) | GboxMikeFozzy | CC0 |
| `click.ogg` | click | https://opengameart.org/content/fantasy-sound-effects-library (`Menu_Select_00`) | Little Robot Sound Factory | CC-BY 3.0 |
| `error.ogg` | error | https://opengameart.org/content/fantasy-sound-effects-library (`Jingle_Lose_00`) | Little Robot Sound Factory | CC-BY 3.0 |
| `levelup.ogg` | levelup | https://opengameart.org/content/fantasy-sound-effects-library (`Jingle_Achievement_00`) | Little Robot Sound Factory | CC-BY 3.0 |
| `coin.ogg` | coin | https://opengameart.org/content/fantasy-sound-effects-library (`Pickup_Gold_00`) | Little Robot Sound Factory | CC-BY 3.0 |
| `place.ogg` | place | https://opengameart.org/content/fantasy-sound-effects-library (`Inventory_Open_00`) | Little Robot Sound Factory | CC-BY 3.0 |
| `crickets.ogg` | crickets | https://opengameart.org/content/crickets-ambient-noise-loopable (`crickets_1.mp3`) | Wolfgang_ | CC0 |

### Music (`public/audio/music/`) — loop

| File | Event | Nguồn | Tác giả | License |
| --- | --- | --- | --- | --- |
| `music-spring.ogg` | music-spring | https://opengameart.org/content/hush-hamlet (`hush_hamlet_loop_0.wav`) | Zane Little Music | CC0 |
| `music-summer.ogg` | music-summer | https://opengameart.org/content/fields-of-cabbage (`fields_of_cabbage.ogg`) | ARoachIFoundOnMyPillow | CC0 |
| `music-fall.ogg` | music-fall | https://opengameart.org/content/apple-cider (`apple_cider.ogg`) | Zane Little Music | CC0 |
| `music-winter.ogg` | music-winter | https://opengameart.org/content/northumberland (`northumberland.mp3`) | Spring Spring | CC0 |

### Ambient (`public/audio/ambient/`) — loop

| File | Event | Nguồn | Tác giả | License |
| --- | --- | --- | --- | --- |
| `amb-day-birds.ogg` | amb-day-birds | https://opengameart.org/content/park-ambiences (`park_ambience_birds.wav`, cắt 120s đầu) | Thimras | CC0 |
| `amb-night-crickets.ogg` | amb-night-crickets | https://opengameart.org/content/crickets-ambient-noise-loopable (`crickets-oneloop.mp3`) | Wolfgang_ | CC0 |
| `amb-beach-waves.ogg` | amb-beach-waves | https://opengameart.org/content/beach-ocean-waves (`wave_01_cc0-18363__jasinski__alkaibeach.flac`) | Jasinski (tổng hợp bởi qubodup) | CC0 |
| `amb-cave-drips.ogg` | amb-cave-drips | https://opengameart.org/content/loopable-dungeon-ambience (`dungeon_ambient_1.ogg`) | JaggedStone | CC0 |

## Required credits (CC-BY — phải hiển thị trong SettingsPanel)

- **Fantasy Sound Effects Library** by **Little Robot Sound Factory** (a.k.a. rubberduck) —
  https://opengameart.org/content/fantasy-sound-effects-library — www.littlerobotsoundfactory.com —
  licensed under [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/).
  Files: `click.ogg`, `error.ogg`, `levelup.ogg`, `coin.ogg`, `place.ogg`.

## Ghi chú xử lý

- Mọi file được chuyển đổi sang Ogg Vorbis (ffmpeg, native encoder q5) hoặc giữ nguyên ogg nguồn.
- Một số SFX gốc quá dài được cắt ngắn + fade out: `chop.ogg` (0.85s), `eat.ogg` (1.6s),
  `water.ogg` (1.8s), `amb-day-birds.ogg` (120s / 449s gốc).
- Event **không** có file (fallback procedural): `plant`, `harvest`, `cut`, `rooster`.
  Lý do: không tìm được file CC0/CC-BY phù hợp trên OpenGameArt; giành mapping sai còn hơn
  để engine dùng fallback procedural (ví dụ "chicken cluck" cho "rooster" là mapping tệ).
- Pack bị loại vì license: "Farm animals" (CC-BY-SA 3.0), "Snowsong" (CC-BY-SA 4.0),
  "Digging underground" (multi-license không xác định được license per-file),
  "Springs pastorales" (hỗn hợp CC-BY-SA/CC0 per-file không rõ ràng).
