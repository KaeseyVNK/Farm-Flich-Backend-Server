// Wave 3 P4 — DecorMode SM thuần: con trỏ đặt/nhặt decor. Scene giữ state này;
// store mutation (placeDecor/removeDecor/rotateDecor) tách khỏi SM — SM chỉ
// quyết định UI state, caller đọc kết quả store rồi đẩy event place-ok/removed.
export interface DecorModeState {
  active: boolean;
  /** defId đang cầm để đặt; null = chế độ chỉnh sửa (nhặt/xoay decor có sẵn). */
  defId: string | null;
  /** uid decor dưới con trỏ (chế độ chỉnh sửa). */
  uid: string | null;
  cursorTx: number;
  cursorTy: number;
  rot: 0 | 90 | 180 | 270;
  flip: boolean;
}

export type DecorModeEvent =
  | { type: "enter"; defId?: string; tx: number; ty: number }
  | { type: "exit" }
  | { type: "move"; dx: number; dy: number; cols: number; rows: number }
  | { type: "rotate" }
  | { type: "flip" }
  | { type: "target"; uid: string | null }
  | { type: "place-ok"; remaining: number }
  | { type: "removed" };

export function initialDecorMode(): DecorModeState {
  return { active: false, defId: null, uid: null, cursorTx: 0, cursorTy: 0, rot: 0, flip: false };
}

export function nextDecorMode(s: DecorModeState, e: DecorModeEvent): DecorModeState {
  switch (e.type) {
    case "enter":
      return {
        active: true,
        defId: e.defId ?? null,
        uid: null,
        cursorTx: e.tx,
        cursorTy: e.ty,
        rot: 0,
        flip: false,
      };
    case "exit":
      return initialDecorMode();
    case "move": {
      if (!s.active) return s;
      return {
        ...s,
        cursorTx: Math.max(0, Math.min(e.cols - 1, s.cursorTx + e.dx)),
        cursorTy: Math.max(0, Math.min(e.rows - 1, s.cursorTy + e.dy)),
      };
    }
    case "rotate":
      if (!s.active) return s;
      return { ...s, rot: (((s.rot + 90) % 360) as DecorModeState["rot"]) };
    case "flip":
      if (!s.active) return s;
      return { ...s, flip: !s.flip };
    case "target":
      if (!s.active) return s;
      return { ...s, uid: e.uid };
    case "place-ok":
      // Hết kho → thoát; còn → giữ chế độ đặt tiếp (reset rot/flip cho món mới).
      return e.remaining <= 0
        ? initialDecorMode()
        : { ...s, rot: 0, flip: false };
    case "removed":
      return { ...s, uid: null };
  }
}
