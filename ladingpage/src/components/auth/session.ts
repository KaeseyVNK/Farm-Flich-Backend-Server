"use client";

import { useSyncExternalStore } from "react";
import { buildGameLaunchUrl, GAME_API_BASE_URL } from "@/lib/game-api";

export const SESSION_STORAGE_KEY = "farmfilch.webSession.v1";
type AuthSnapshot = { ready: boolean; token: string | null; playerId: string | null; username: string | null; cashMilli: number | null; walletAddress: string | null };
const EMPTY: AuthSnapshot = { ready: false, token: null, playerId: null, username: null, cashMilli: null, walletAddress: null };
let snapshot = EMPTY;
let booted = false;
let authRevision = 0;
const listeners = new Set<() => void>();

function update(next: AuthSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function clearSession() {
  authRevision++;
  try { window.localStorage.removeItem(SESSION_STORAGE_KEY); } catch { /* Privacy mode: in-memory session still works. */ }
  update({ ...EMPTY, ready: true });
}

function readStoredSession() {
  authRevision++;
  try {
    const value = JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) ?? "null");
    if (value && typeof value.token === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(value.token) &&
        typeof value.playerId === "string" && value.playerId && typeof value.username === "string") {
      update({ ...EMPTY, ready: true, token: value.token, playerId: value.playerId, username: value.username });
      return;
    }
  } catch { /* Invalid/blocked storage means signed out. */ }
  update({ ...EMPTY, ready: true });
}

export function bootAuthFromStorage() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  readStoredSession();
  window.addEventListener("storage", event => {
    if (event.key === SESSION_STORAGE_KEY || event.key === null) readStoredSession();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useAuthSnapshot() {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}

type ApiResult = { status: number; body: Record<string, unknown> | null };
async function request(path: string, method = "GET", body?: unknown, token = snapshot.token): Promise<ApiResult> {
  try {
    const response = await fetch(`${GAME_API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json", "X-Client-Version": "4",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    const parsed = await response.json().catch(() => null);
    if (response.status === 401 && parsed?.code === "SESSION_EXPIRED" && snapshot.token === token) clearSession();
    return { status: response.status, body: parsed };
  } catch {
    return { status: 0, body: null };
  }
}

export async function loginWithPassword(username: string, password: string): Promise<{ ok: boolean; error: string }> {
  const revision = ++authRevision;
  const result = await request("/auth/login", "POST", { username: username.trim(), password }, null);
  const body = result.body;
  if (revision !== authRevision) {
    if (typeof body?.sessionToken === "string") await request("/auth/logout", "POST", undefined, body.sessionToken);
    return { ok: false, error: "Your sign-in was cancelled. Please try again." };
  }
  if (result.status !== 200 || body?.ok !== true || typeof body.sessionToken !== "string" || typeof body.playerId !== "string") {
    return { ok: false, error: result.status === 401 ? "Incorrect username or password." :
      result.status === 0 ? "Could not reach the game server. Please try again." :
      typeof body?.error === "string" ? body.error : "Sign-in is temporarily unavailable." };
  }
  const next = { ...EMPTY, ready: true, token: body.sessionToken, playerId: body.playerId,
    username: typeof body.username === "string" && body.username ? body.username : username.trim() };
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: next.token, playerId: next.playerId, username: next.username }));
  } catch { /* Continue in memory when browser storage is blocked. */ }
  update(next);
  return { ok: true, error: "" };
}

export async function ensureAccountDetails() {
  const token = snapshot.token;
  if (!token) return;
  const [result, wallet] = await Promise.all([request("/wallet/cash", "GET", undefined, token), request("/auth/wallet", "GET", undefined, token)]);
  if (snapshot.token !== token) return;
  const balance = result.body?.balanceMilliCash;
  if (result.status === 200 && result.body?.ok === true && typeof balance === "number" && Number.isSafeInteger(balance) && balance >= 0) {
    update({ ...snapshot, cashMilli: balance, walletAddress: wallet.status === 200 && wallet.body?.ok === true && typeof wallet.body.walletAddress === "string" ? wallet.body.walletAddress : null });
  }
}

/** All protected web requests use the same version and expiry handling. */
export function gameApiFetch(path: string, options: { method?: string; body?: unknown } = {}) {
  return request(path, options.method ?? (options.body === undefined ? "GET" : "POST"), options.body);
}

export function getAuthSnapshot() { return snapshot; }
export function getAuthRevision() { return authRevision; }
export function shortenAddress(address: string) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }
export function isSameWallet(a: string | null, b: string | null) { return !!a && !!b && a === b; }
export function walletMismatchMessage(connected: string, linked: string) {
  return `Wallet ${shortenAddress(connected)} does not match your linked wallet ${shortenAddress(linked)}. Use your linked wallet to top up this account.`;
}
export function walletMismatchNotice(connected: string, linked: string) {
  return `Wallet ${shortenAddress(connected)} differs from the previous wallet ${shortenAddress(linked)}. Continuing signs into the account belonging to this wallet.`;
}
// This hint is only for the login chooser. Payment authorization comes from the server.
const WALLET_HINT_KEY = "farmfilch.walletHint.v1";
export function readLinkedWallet() {
  try { return window.localStorage.getItem(WALLET_HINT_KEY); } catch { return null; }
}
export function clearLinkedWallet() {
  try { window.localStorage.removeItem(WALLET_HINT_KEY); } catch { /* Optional hint. */ }
}
export function setLinkedWallet(address: string) {
  try { window.localStorage.setItem(WALLET_HINT_KEY, address); } catch { /* Optional hint. */ }
  update({ ...snapshot, walletAddress: address });
}

type WalletLoginResult = { ok: true } | { ok: false; error: string } |
  { ok: false; code: "WALLET_NEW_USER"; suggestedName: string };

function acceptWalletSession(body: Record<string, unknown>): boolean {
  if (body.ok !== true || typeof body.sessionToken !== "string" || typeof body.playerId !== "string") return false;
  const next = { ...EMPTY, ready: true, token: body.sessionToken, playerId: body.playerId,
    username: typeof body.username === "string" ? body.username : body.playerId,
    walletAddress: typeof body.walletAddress === "string" ? body.walletAddress : null };
  try { window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: next.token, playerId: next.playerId, username: next.username })); } catch { /* In-memory session. */ }
  update(next);
  return true;
}

async function walletLogin(path: string, payload: unknown): Promise<WalletLoginResult> {
  const revision = ++authRevision;
  const result = await request(path, "POST", payload, null);
  if (revision !== authRevision) {
    if (typeof result.body?.sessionToken === "string") await request("/auth/logout", "POST", undefined, result.body.sessionToken);
    return { ok: false, error: "Your sign-in was cancelled. Please try again." };
  }
  if (result.status === 200 && result.body && acceptWalletSession(result.body)) return { ok: true };
  if (result.body?.code === "WALLET_NEW_USER" || result.body?.code === "NAME_TAKEN") {
    return { ok: false, code: "WALLET_NEW_USER", suggestedName: typeof result.body.suggestedName === "string" ? result.body.suggestedName : "farmer" };
  }
  return { ok: false, error: typeof result.body?.error === "string" ? result.body.error : "Wallet sign-in failed. Please try again." };
}
export function loginWithWallet(address: string, signature: string) { return walletLogin("/auth/wallet", { address, signature }); }
export function claimWalletAccount(address: string, signature: string, name: string) { return walletLogin("/auth/wallet-claim", { address, signature, name }); }

export async function launchGame(): Promise<string | null> {
  const token = snapshot.token;
  if (!token) return "Please log in first.";
  const result = await request("/auth/web-launch-code", "POST", undefined, token);
  if (result.status === 401) return "Your session has expired. Please log in again.";
  if (result.status !== 200 || result.body?.ok !== true || typeof result.body.code !== "string" || result.body.expiresInSeconds !== 90) {
    return "Could not launch the game. Please try again.";
  }
  // A logout or account switch during the request must not launch the previous account.
  if (snapshot.token !== token) return "Please log in again.";
  try {
    window.location.replace(buildGameLaunchUrl(result.body.code, window.location.origin));
    return null;
  } catch {
    return "The game and login addresses are not configured correctly.";
  }
}

export async function logout() {
  const token = snapshot.token;
  clearSession();
  if (token) await request("/auth/logout", "POST", undefined, token);
}
