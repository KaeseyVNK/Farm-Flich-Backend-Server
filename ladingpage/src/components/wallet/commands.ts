/**
 * Hàng đợi lệnh ví dùng chung cho các SDK dạng React-context (Privy, Particles —
 * connect/sign/sendTransaction của chúng chỉ tồn tại qua hooks).
 *
 * Adapter (thuần TS, không hooks) enqueue lệnh; component bridge (bên trong
 * provider) drain và xử lý bằng hooks rồi resolve/reject promise của lệnh.
 * Chỉ MỘT provider active tại một thời điểm → chỉ một bridge drain queue.
 */

export type WalletCommand =
  | { kind: "connect"; resolve: (address: string) => void; reject: (e: unknown) => void }
  | { kind: "connect-silent"; jwt: string; resolve: (address: string) => void; reject: (e: unknown) => void }
  | { kind: "sign"; address: string; message: string; resolve: (signature: string) => void; reject: (e: unknown) => void }
  | { kind: "logout"; resolve: () => void; reject: (e: unknown) => void }
  | { kind: "auth-state"; resolve: (authenticated: boolean) => void; reject: (e: unknown) => void }
  | { kind: "send-usdt"; payer: string; rawAmount: bigint; treasury: string; mint: string; resolve: (signature: string) => void; reject: (e: unknown) => void };

const queue: WalletCommand[] = [];
let notify: (() => void) | null = null;

/** Adapter gọi — đẩy lệnh vào queue và đánh thức bridge. */
export function enqueueWalletCommand(cmd: WalletCommand): void {
  queue.push(cmd);
  notify?.();
}

/** Bridge đăng ký qua useSyncExternalStore — đổi callback = re-render. */
export function subscribeWalletCommands(callback: () => void): () => void {
  notify = callback;
  return () => {
    if (notify === callback) notify = null;
  };
}

/** Bridge đọc số lệnh chờ (snapshot cho useSyncExternalStore). */
export function pendingWalletCommandCount(): number {
  return queue.length;
}

/** Bridge lấy toàn bộ lệnh đang chờ (queue rỗng sau khi drain). */
export function drainWalletCommands(): WalletCommand[] {
  return queue.splice(0, queue.length);
}
