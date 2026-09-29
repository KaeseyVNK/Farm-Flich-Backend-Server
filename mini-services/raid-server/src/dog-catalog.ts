/**
 * W7b-P1 — Giống chó (§10.1). Pure catalog — DUPLICATE của
 * src/lib/raid/dog-catalog.ts (raid-server process riêng, KHÔNG import src/ —
 * pattern constants.ts). Sync-comment 2 chiều: sửa ở đây → sửa bản client.
 *
 * Stats áp lên Room.tickDog (vision/hearing/speed) + lure logic (7b-P3):
 * - retriever: cân bằng (mặc định cũ).
 * - hound: tầm hơi +2 tile (ngửi ra thief trong bóng tối).
 * - shepherd: speed ×1.2.
 * - corgi: squeeze flag — QUA KHE 1 TILE (map raid hiện chưa có fence-hẹp
 *   tile; flag data-ready, effect khi fence tiles xuất hiện — note plan).
 * - maan: alert nhạy (bump +15 thay +3 khi thấy thief) + lureImmune (không bị
 *   mồi dụ — §10 "giống alarm-cao cứng").
 */
export type DogBreedId = "retriever" | "hound" | "shepherd" | "corgi" | "maan";

export interface DogBreed {
  id: DogBreedId;
  name: string;
  price: number; // vàng mua (DefenseUpgradePanel)
  /** Nhân tốc bước chase (lockdown ×1.4 stack nhân tiếp). */
  speedMul: number;
  /** Cộng thêm tile vào tầm nhìn (vision). */
  visionAdd: number;
  /** Cộng thêm tile vào tầm nghe (hearing) — hound đặc trưng. */
  hearingAdd: number;
  /** Alert bump thêm khi thấy thief (maan 15). */
  alertSeeBonus: number;
  /** Qua khe 1 tile (data-ready — chưa có fence tiles trên map). */
  squeeze: boolean;
  /** Miễn nhiễm mồi dụ (§10 alarm-cao). */
  lureImmune: boolean;
}

export const DOG_BREEDS: DogBreed[] = [
  { id: "retriever", name: "Retriever", price: 1500, speedMul: 1, visionAdd: 0, hearingAdd: 0, alertSeeBonus: 0, squeeze: false, lureImmune: false },
  { id: "hound", name: "Hound", price: 2200, speedMul: 1, visionAdd: 0, hearingAdd: 2, alertSeeBonus: 0, squeeze: false, lureImmune: false },
  { id: "shepherd", name: "Shepherd", price: 2600, speedMul: 1.2, visionAdd: 0, hearingAdd: 0, alertSeeBonus: 0, squeeze: false, lureImmune: false },
  { id: "corgi", name: "Corgi", price: 1800, speedMul: 0.95, visionAdd: 1, hearingAdd: 0, alertSeeBonus: 0, squeeze: true, lureImmune: false },
  { id: "maan", name: "Mãn", price: 3000, speedMul: 1, visionAdd: 0, hearingAdd: 0, alertSeeBonus: 12, squeeze: false, lureImmune: true },
];

export function breedById(id: string): DogBreed | undefined {
  return DOG_BREEDS.find((b) => b.id === id);
}

/** Stats hiệu dụng của 1 con chó (breed × level, blood-moon thêm bởi room). */
export function breedStats(id: string): {
  speedMul: number;
  visionAdd: number;
  hearingAdd: number;
  alertSeeBonus: number;
  lureImmune: boolean;
} {
  const b = breedById(id) ?? DOG_BREEDS[0];
  return {
    speedMul: b.speedMul,
    visionAdd: b.visionAdd,
    hearingAdd: b.hearingAdd,
    alertSeeBonus: b.alertSeeBonus,
    lureImmune: b.lureImmune,
  };
}
