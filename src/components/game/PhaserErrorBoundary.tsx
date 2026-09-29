"use client";
// ErrorBoundary quanh PhaserGame — pitfall "nothing renders/black screen".
// Phaser scene crash → fallback message + reload button; không treo cả trang.
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message?: string;
}

export class PhaserErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: unknown): void {
    console.error("[PhaserErrorBoundary] caught", err);
  }

  private reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#1a1410] p-6 text-center"
          role="alert"
        >
          <p className="font-pixel text-sm text-[#e7b94e]">⚠ Lỗi hiển thị</p>
          <p className="max-w-md text-xs text-[#6b5b45]">
            {this.state.message ?? "Game engine không thể hiển thị."}
          </p>
          <button
            onClick={this.reload}
            className="rounded-lg border-2 border-[#4a3119] bg-[#e7b94e] px-4 py-2 text-xs font-bold text-[#3b2f23] hover:bg-[#f0c964]"
          >
            Tải lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
