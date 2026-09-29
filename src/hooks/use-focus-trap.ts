"use client";

import { useEffect } from "react";

/**
 * Focus trap cho modal (a11y). Khi `active` true:
 * - Focus phần tử focusable đầu tiên (keyboard + screen reader).
 * - Tab/Shift+Tab vòng trong container, không thoát ra ngoài.
 * - Restore focus về phần tử gọi modal khi close.
 *
 * Modal phải có `role="dialog" aria-modal="true"` (đã có). Hook này hoàn
 * thiện semantics: aria-modal mà không trap = tab lọt ra sau overlay.
 */
export function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const container = containerRef.current;

    // Restore focus element sau khi trap đóng (phần tử mở modal).
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const FOCUSABLE = [
      "button:not([disabled])",
      "[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    const getFocusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    // Focus phần tử focusable đầu tiên. Nếu không có (modal rỗng) → focus chính container.
    const focusFirst = () => {
      const first = getFocusable()[0] ?? container;
      first.focus();
    };

    // Defer 1 frame — cho phép layout hoàn tất trước khi focus.
    const raf = requestAnimationFrame(focusFirst);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      // Shift+Tab ở phần tử đầu → nhảy xuống cuối. Tab ở cuối → quay lại đầu.
      if (e.shiftKey && (activeEl === first || !container.contains(activeEl))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [active, containerRef]);
}
