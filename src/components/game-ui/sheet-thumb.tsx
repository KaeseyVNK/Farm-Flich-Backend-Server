"use client";

import { assetUrl } from "@/lib/game/assets/asset-manifest";

export interface SheetFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Crop a pixel sheet cell into a square thumbnail (contain). */
export function SheetThumb({
  assetKey,
  frame,
  size,
  className,
}: {
  assetKey: string;
  frame: SheetFrame;
  size: number;
  className?: string;
}) {
  const scale = size / Math.max(frame.w, frame.h);
  const dw = frame.w * scale;
  const dh = frame.h * scale;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        imageRendering: "pixelated",
      }}
    >
      <span
        style={{
          position: "relative",
          width: dw,
          height: dh,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <img
          src={assetUrl(assetKey)}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: -frame.x * scale,
            top: -frame.y * scale,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            maxWidth: "none",
            imageRendering: "pixelated",
          }}
        />
      </span>
    </span>
  );
}
