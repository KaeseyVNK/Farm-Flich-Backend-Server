"use client";

// PixelButton — semantic button with documented states. Owns focus/disabled/loading visual
// only; never owns store mutations or overlay policy. Always has a visible label unless an
// explicit aria-label + adjacent visible context is supplied. 44px mobile target enforced by
// the globals.css safety net; this component keeps a comfortable default. Contract:
// visual-design-specification §PixelButton.
import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type PixelButtonVariant =
  | "primary"
  | "secondary"
  | "quiet"
  | "danger"
  | "icon"
  | "keycap";

const BASE =
  "relative inline-flex items-center justify-center gap-1.5 font-extrabold leading-none " +
  "select-none transition-[transform,background-color,border-color] duration-150 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mf-focus)] " +
  "active:translate-y-[1px] motion-reduce:transition-none motion-reduce:active:translate-y-0";

const VARIANT_CLASS: Record<PixelButtonVariant, string> = {
  // primary: leaf/confirm — text + (raised paper) so colour is not the sole signal
  primary:
    "min-h-[44px] px-4 py-2 rounded-[4px] border-2 border-[var(--mf-frame)] " +
    "bg-[var(--mf-leaf)] text-[var(--mf-paper-raised)] hover:brightness-110",
  secondary:
    "min-h-[44px] px-4 py-2 rounded-[4px] border-2 border-[var(--mf-frame)] " +
    "bg-[var(--mf-paper-raised)] text-[var(--mf-ink)] hover:bg-[var(--mf-paper)]",
  quiet:
    "min-h-[44px] px-3 py-2 rounded-[4px] border-2 border-transparent " +
    "bg-transparent text-[var(--mf-ink)] hover:bg-[var(--mf-muted-ink)]/25",
  // danger: destructive confirm/alarm only — never a routine secondary control
  danger:
    "min-h-[44px] px-4 py-2 rounded-[4px] border-2 border-[var(--mf-danger)] " +
    "bg-[var(--mf-danger)] text-[var(--mf-paper-raised)] hover:brightness-110",
  icon:
    "h-12 w-12 rounded-[4px] border-2 border-[var(--mf-frame)] " +
    "bg-[var(--mf-paper)] text-[var(--mf-ink)] hover:bg-[var(--mf-paper-raised)]",
  keycap:
    "min-h-[28px] min-w-[28px] px-1.5 rounded-[2px] border border-[var(--mf-frame)] " +
    "bg-[var(--mf-muted-ink)]/40 text-[var(--mf-ink)] font-mono text-[10px]",
};

export interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PixelButtonVariant;
  /** Show a non-flashing busy indicator; label remains visible. Prevents duplicate submit. */
  loading?: boolean;
  /** Visible label. Required unless an explicit aria-label is supplied. */
  children?: ReactNode;
  /** Render as child element (composition). */
  asChild?: boolean;
}

export function PixelButton({
  variant = "secondary",
  loading = false,
  disabled,
  className = "",
  children,
  asChild = false,
  type,
  ...rest
}: PixelButtonProps) {
  const Comp = asChild ? Slot : "button";
  const isDisabled = disabled || loading;
  return (
    <Comp
      data-mf-button={variant}
      data-loading={loading || undefined}
      type={asChild ? undefined : (type ?? "button")}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      disabled={asChild ? undefined : isDisabled}
      className={`${BASE} ${VARIANT_CLASS[variant]} ${
        isDisabled ? "opacity-50 cursor-not-allowed motion-reduce:transition-none" : ""
      } ${className}`}
      {...rest}
    >
      {children}
      {loading ? (
        <span
          aria-hidden
          className="ml-1 inline-block h-2 w-2 rounded-[1px] bg-current motion-reduce:hidden"
        />
      ) : null}
    </Comp>
  );
}
