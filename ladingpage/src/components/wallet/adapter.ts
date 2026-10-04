/**
 * Lớp wallet adapter (spec 2026-10-01-wallet-adapter-design) — registry chọn
 * provider giữa Particles / Privy / Web3Auth, mặc định Privy.
 *
 * File này CỐ TÌNH không import SDK nào (kể cả type): các adapter thật được
 * `await import()` trong getWalletAdapter() — trang marketing không tải chunk
 * ví, và hygiene gate cấm import SDK ngoài thư mục wallet/.
 */

export type WalletAdapterId = "privy" | "web3auth" | "particles";

export type WalletConnection = {
  /** Địa chỉ ví Solana (base58, phân biệt hoa/thường). */
  address: string;
};

/** Điểm đến của lệnh chuyển USDT (từ GET /deposit/info). */
export type UsdtTransferTarget = { treasury: string; mint: string };

export interface WalletAdapter {
  readonly id: WalletAdapterId;
  /** Particles = true (JWT ngầm sau mật khẩu); Privy/Web3Auth = false. */
  readonly supportsSilentLink: boolean;
  /** Kết nối tương tác — session còn hạn thì im lặng, chưa thì mở modal 1 lần.
   *  User đóng modal → WalletConnectCancelledError. */
  connect(): Promise<WalletConnection>;
  /** Ký message (UTF-8) bằng ví Solana → chữ ký base58 (64-byte ed25519).
   *  MỖI ADAPTER tự chuẩn hóa encoding SDK của mình về base58. */
  signPersonalMessage(address: string, message: string): Promise<string>;
  /** Dựng + gửi lệnh SPL transferChecked USDT → chữ ký giao dịch base58.
   *  rawAmount là đơn vị nhỏ nhất (6 decimals). */
  sendUsdtTransfer(rawAmount: bigint, target: UsdtTransferTarget, payer: string): Promise<string>;
  /**
   * Huỷ phiên provider (Privy) để lần connect() KẾ mở chooser chọn phương
   * thức/ví thay vì im lặng trả về đúng ví cũ — đường "Use a different
   * wallet" (2026-10-04). Optional: provider nào chưa hỗ trợ thì UI ẩn nút.
   */
  logout?(): Promise<void>;
  /** Phiên SDK ví còn sống không (Privy: cookie iframe riêng, chết độc lập
   *  với login game — reload trang / browser chặn cookie 3rd-party đều giết
   *  nó). false → UI hiện bước "đăng nhập ví" có giải thích TRƯỚC khi bật
   *  modal. Optional: adapter chưa hỗ trợ → UI coi như true (bỏ qua bước). */
  isAuthenticated?(): Promise<boolean>;
  /** Chỉ Particles có: connect silent bằng JWT từ POST /auth/particles-token. */
  connectSilent?(jwt: string): Promise<WalletConnection>;
}

/** RPC public mặc định — SSR fallback và upstream của proxy /api/solana-rpc.
 *  Prod nên set NEXT_PUBLIC_SOLANA_RPC (RPC trả phí). */
export const DEFAULT_SOLANA_RPC = "https://api.mainnet-beta.solana.com";

/** URL RPC client dùng lúc CHẠY: NEXT_PUBLIC_SOLANA_RPC nếu build có set,
 *  còn không thì same-origin proxy `${location.origin}/api/solana-rpc` —
 *  browser gọi thẳng public RPC bị 403 THEO ORIGIN HEADER (live 2026-10-03),
 *  qua proxy server-side thì 200. web3.js bắt buộc URL tuyệt đối
 *  ("Endpoint URL must start with http:") nên dùng origin đầy đủ, không phải
 *  path tương đối. SSR (không window) fallback public RPC — server không
 *  fetch qua hàm này. */
export function resolveSolanaRpc(): string {
  if (process.env.NEXT_PUBLIC_SOLANA_RPC) return process.env.NEXT_PUBLIC_SOLANA_RPC;
  if (typeof window !== "undefined") return `${window.location.origin}/api/solana-rpc`;
  return DEFAULT_SOLANA_RPC;
}

/** Người dùng đóng modal kết nối → không phải lỗi hệ thống, UI về idle. */
export class WalletConnectCancelledError extends Error {
  constructor() {
    super("wallet connect cancelled");
    this.name = "WalletConnectCancelledError";
  }
}

const PLACEHOLDER_PATTERN = /placeholder|^\s*$/i;

function envConfigured(name: string, read: (key: string) => string | undefined): boolean {
  const value = read(name) ?? "";
  return value.length > 0 && !PLACEHOLDER_PATTERN.test(value);
}

/** Đọc 1 biến env. Key PHẢI truy cập trực tiếp (process.env.NEXT_PUBLIC_X)
 * để Next inlined giá trị vào bundle lúc build — truy cập qua biến động
 * (process.env[key]) không bao giờ được inlined → undefined trên trình duyệt. */
const STATIC_ENV: Record<string, string | undefined> = {
  NEXT_PUBLIC_WALLET_PROVIDER: process.env.NEXT_PUBLIC_WALLET_PROVIDER,
  NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  NEXT_PUBLIC_WEB3AUTH_CLIENT_ID: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID,
  NEXT_PUBLIC_PARTICLE_APP_ID: process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  NEXT_PUBLIC_PARTICLE_PROJECT_ID: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID,
  NEXT_PUBLIC_PARTICLE_CLIENT_KEY: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY,
  NEXT_PUBLIC_SOLANA_RPC: process.env.NEXT_PUBLIC_SOLANA_RPC,
};

function fromEnv(key: string): string | undefined {
  return STATIC_ENV[key];
}

/**
 * Chọn provider (pure — `read` inject được để test):
 *   1. NEXT_PUBLIC_WALLET_PROVIDER explicit (`privy|web3auth|particles`, trim +
 *      lowercase) — giá trị khác → null (deploy đoán được, không tự nhảy).
 *   2. Tự dò theo key cấu hình, ưu tiên privy > web3auth > particles.
 */
export function resolveWalletProviderId(
  read: (key: string) => string | undefined = fromEnv,
): WalletAdapterId | null {
  const explicit = (read("NEXT_PUBLIC_WALLET_PROVIDER") ?? "").trim().toLowerCase();
  if (explicit) {
    if (explicit === "privy" || explicit === "web3auth" || explicit === "particles") {
      return explicit;
    }
    return null;
  }
  if (envConfigured("NEXT_PUBLIC_PRIVY_APP_ID", read)) return "privy";
  if (envConfigured("NEXT_PUBLIC_WEB3AUTH_CLIENT_ID", read)) return "web3auth";
  if (
    envConfigured("NEXT_PUBLIC_PARTICLE_PROJECT_ID", read) &&
    envConfigured("NEXT_PUBLIC_PARTICLE_CLIENT_KEY", read) &&
    envConfigured("NEXT_PUBLIC_PARTICLE_APP_ID", read)
  ) {
    return "particles";
  }
  return null;
}

/** Env của provider `id` đã đủ key thật chưa (pure). */
export function providerEnvConfigured(
  id: WalletAdapterId,
  read: (key: string) => string | undefined = fromEnv,
): boolean {
  switch (id) {
    case "privy":
      return envConfigured("NEXT_PUBLIC_PRIVY_APP_ID", read);
    case "web3auth":
      return envConfigured("NEXT_PUBLIC_WEB3AUTH_CLIENT_ID", read);
    case "particles":
      return (
        envConfigured("NEXT_PUBLIC_PARTICLE_PROJECT_ID", read) &&
        envConfigured("NEXT_PUBLIC_PARTICLE_CLIENT_KEY", read) &&
        envConfigured("NEXT_PUBLIC_PARTICLE_APP_ID", read)
      );
  }
}

/** Provider đã chọn có dùng được không — mọi UI ví gate bằng hàm này. */
export function isWalletConfigured(): boolean {
  const id = resolveWalletProviderId();
  if (!id) return false;
  const configured = providerEnvConfigured(id);
  if (!configured) {
    // explicit đặt provider nhưng thiếu key → ẩn tính năng ví + cảnh báo.
    console.warn(`[wallet] NEXT_PUBLIC_WALLET_PROVIDER=${id} is missing this provider's env keys — hiding the wallet feature.`);
  }
  return configured;
}

let instancePromise: Promise<WalletAdapter> | null = null;

/** Adapter của provider đang chọn — dynamic import đúng SDK đó, một lần duy nhất. */
export function getWalletAdapter(): Promise<WalletAdapter> {
  if (!instancePromise) {
    const id = resolveWalletProviderId();
    if (!id || !providerEnvConfigured(id)) {
      return Promise.reject(new Error("wallet provider not configured"));
    }
    instancePromise = (async () => {
      if (id === "privy") {
        const mod = await import("./privy-adapter");
        return mod.privyAdapter;
      }
      if (id === "web3auth") {
        const mod = await import("./web3auth-adapter");
        return mod.web3authAdapter;
      }
      const mod = await import("./particles-adapter");
      return mod.particlesAdapter;
    })();
    instancePromise.catch(() => {
      instancePromise = null; // nạp lỗi → cho phép gọi lại
    });
  }
  return instancePromise;
}
