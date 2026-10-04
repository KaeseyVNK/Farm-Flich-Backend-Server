/**
 * Web3Auth adapter — singleton imperative, Solana namespace (chainId "0x65").
 * JRPC ghim từ source @web3auth (authSolanaWallet.js):
 *   solana_signMessage   params { data: <UTF-8 string>, from: <base58> } → base58
 *   solana_sendTransaction params { message: <base64 wire tx> }          → base58
 *   solana_requestAccounts → string[] (base58)
 * CHỈ ký message UTF-8 thuần (validator phía iframe là code remote).
 */

import type { Web3Auth } from "@web3auth/modal";
import type { WalletAdapter, WalletConnection, UsdtTransferTarget } from "./adapter";
import { WalletConnectCancelledError, resolveSolanaRpc } from "./adapter";
import { buildUnsignedUsdtTransfer, toBase64 } from "./solana-transfer";

const SOLANA_MAINNET_CHAIN = {
  chainNamespace: "solana",
  chainId: "0x65",
  rpcTarget: resolveSolanaRpc(),
  displayName: "Solana",
  blockExplorerUrl: "https://solscan.io",
  ticker: "SOL",
  tickerName: "Solana",
  logo: "",
} as const;

let instancePromise: Promise<Web3Auth> | null = null;

function getWeb3Auth(): Promise<Web3Auth> {
  if (!instancePromise) {
    instancePromise = (async () => {
      const { Web3Auth: Web3AuthSdk, WEB3AUTH_NETWORK } = await import("@web3auth/modal");
      const sdk = new Web3AuthSdk({
        clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID ?? "",
        web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
        chains: [SOLANA_MAINNET_CHAIN],
        defaultChainId: "0x65",
        uiConfig: { mode: "light" },
        // Modal: Google + Email (embedded) + ví ngoài Solana. "metamask" là
        // connector EIP155-only → ẩn; wallet-connect-v2 hỗ trợ Solana ở v11.
        modalConfig: {
          connectors: {
            auth: {
              label: "Log in",
              loginMethods: {
                google: { name: "Google", showOnModal: true },
                email_passwordless: { name: "Email", showOnModal: true },
                facebook: { showOnModal: false }, twitter: { showOnModal: false },
                discord: { showOnModal: false }, reddit: { showOnModal: false },
                apple: { showOnModal: false }, github: { showOnModal: false },
                linkedin: { showOnModal: false }, twitch: { showOnModal: false },
                line: { showOnModal: false }, kakao: { showOnModal: false },
                wechat: { showOnModal: false }, telegram: { showOnModal: false },
                farcaster: { showOnModal: false }, sms_passwordless: { showOnModal: false },
                passkeys: { showOnModal: false }, authenticator: { showOnModal: false },
              },
            },
            metamask: { label: "MetaMask", showOnModal: false },
            "wallet-connect-v2": { label: "Other wallets (scan QR)", showOnModal: true },
            coinbase: { label: "Coinbase Wallet", showOnModal: false },
            "base-account": { label: "Base Account", showOnModal: false },
          },
        },
      });
      await sdk.init(); // nạp connectors + khôi phục session cũ nếu còn hạn
      return sdk;
    })();
    instancePromise.catch(() => { instancePromise = null; });
  }
  return instancePromise;
}

type SolanaProvider = NonNullable<NonNullable<Web3Auth["connection"]>["ethereumProvider"]>;

async function ensureConnected(): Promise<{ provider: SolanaProvider; address: string }> {
  const sdk = await getWeb3Auth();
  if (!sdk.connected) {
    await sdk.connect();
  }
  if (!sdk.connected) {
    throw new WalletConnectCancelledError();
  }
  const provider = sdk.connection?.ethereumProvider ?? null;
  if (!provider) throw new Error("web3auth provider unavailable");
  const accounts = (await provider.request<undefined, string[]>({ method: "solana_requestAccounts" })) ?? [];
  const address = accounts[0];
  if (!address) throw new Error("web3auth returned no solana account");
  return { provider, address };
}

export const web3authAdapter: WalletAdapter = {
  id: "web3auth",
  supportsSilentLink: false,

  async connect(): Promise<WalletConnection> {
    const { address } = await ensureConnected();
    return { address };
  },

  async signPersonalMessage(address: string, message: string): Promise<string> {
    const { provider } = await ensureConnected();
    const signature = await provider.request<{ data: string; from: string }, string>({
      method: "solana_signMessage",
      params: { data: message, from: address },
    });
    if (!signature) throw new Error("empty solana_signMessage result");
    return signature; // đã là base58
  },

  async sendUsdtTransfer(rawAmount: bigint, target: UsdtTransferTarget, payer: string): Promise<string> {
    const { provider } = await ensureConnected();
    const rpcUrl = resolveSolanaRpc();
    const tx = await buildUnsignedUsdtTransfer(payer, target.treasury, target.mint, rawAmount, rpcUrl);
    const signature = await provider.request<{ message: string }, string>({
      method: "solana_sendTransaction",
      params: { message: toBase64(tx.serialize()) },
    });
    if (!signature) throw new Error("empty solana_sendTransaction result");
    return signature;
  },
};
