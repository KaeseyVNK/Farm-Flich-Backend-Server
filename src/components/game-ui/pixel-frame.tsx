"use client";

// PixelFrame — structural chrome only (2px frame + interior). Not a dialog, no click side
// effect. Variants map to --mf-* tokens. Contract: visual-design-specification §PixelFrame.
// No raw hex/radius>4px/blur; selection is never colour-only (selected adds an inner ring +
// expects callers to keep a text/shape marker).
import { Slot } from "@radix-ui/react-slot";
import type { ReactNode } from "react";

export type PixelFrameVariant =
  | "paper"
  | "wood"
  | "night"
  | "danger"
  | "selected"
  | "inset";

const FRAME_CLASS: Record<PixelFrameVariant, string> = {
  paper:
    "border-2 border-[var(--mf-frame)] bg-[var(--mf-paper)]",
  wood:
    "border-2 border-[var(--mf-frame)] bg-[var(--mf-wood)] text-[var(--mf-paper-raised)]",
  night:
    "border-2 border-[var(--mf-frame)] bg-[#202139] text-[var(--mf-paper-raised)]",
  danger:
    "border-2 border-[var(--mf-danger)] bg-[var(--mf-paper)]",
  // selected: inner harvest ring on top of paper — selection must not be colour-only.
  selected:
    "border-2 border-[var(--mf-frame)] bg-[var(--mf-paper-raised)] outline outline-2 outline-offset-[-4px] outline-[var(--mf-harvest)]",
  inset:
    "border-2 border-[var(--mf-frame)] bg-[var(--mf-muted-ink)]/30",
};

export interface PixelFrameProps {
  variant?: PixelFrameVariant;
  /** Optional title region rendered above children (e.g. panel header). */
  title?: ReactNode;
  /** Render as child element (composition) instead of a div. */
  asChild?: boolean;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

export function PixelFrame({
  variant = "paper",
  title,
  asChild = false,
  className = "",
  children,
  ...rest
}: PixelFrameProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-mf-frame={variant}
      className={`rounded-[4px] ${FRAME_CLASS[variant]} ${className}`}
      {...rest}
    >
      {title ? (
        <div className="border-b-2 border-[var(--mf-frame)] px-3 py-2">{title}</div>
      ) : null}
      {children}
    </Comp>
  );
}
