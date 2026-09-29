// Camera helpers cho FarmScene. Zoom giữ 2/3 (contract).
// Camera luôn follow player — không khóa homestead.

/** Night overlay phải phủ kín viewport: rect scrollFactor(0) bị zoom co lại
 *  quanh tâm màn → kích thước = view/zoom (không hardcode 960×704). */
export function overlaySize(viewW: number, viewH: number, zoom: number): { w: number; h: number } {
  return { w: viewW / zoom, h: viewH / zoom };
}
