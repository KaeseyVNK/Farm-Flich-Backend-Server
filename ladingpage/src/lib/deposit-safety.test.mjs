import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { PublicKey, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
const require = createRequire(import.meta.url);
function load(relative, extra = {}, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => imports[name] ?? require(name), AbortSignal, Buffer, URL, setTimeout, clearTimeout, process: { env: {} }, ...extra });
  return exports;
}
const math = load('../components/deposit/usdt-amount.ts');
const pending = load('../components/deposit/pending-deposits.ts', {}, { './usdt-amount': math });
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const owner = { playerId: "legacy'user", network: 'devnet', walletAddress: 'caseSensitive' };
test('TC-DEP-WEB-01: restores multiple receipts and separates account, chain and wallet', () => {
  const db = storage(), a = '1'.repeat(88), b = '2'.repeat(88);
  assert(pending.savePendingDeposit(owner, a, db));
  assert(pending.savePendingDeposit(owner, b, db));
  assert(pending.savePendingDeposit(owner, a, db));
  assert.deepEqual(Array.from(pending.readPendingDeposits(owner, db)), [a, b]);
  for (const changed of [{ playerId: 'other' }, { network: 'mainnet' }, { walletAddress: 'casesensitive' }]) {
    assert.equal(pending.readPendingDeposits({ ...owner, ...changed }, db).length, 0);
  }
  pending.removePendingDeposit(owner, a, db);
  assert.deepEqual(Array.from(pending.readPendingDeposits(owner, db)), [b]);
});
test('TC-DEP-WEB-02: blocked storage and full queue never overwrite existing receipts', () => {
  assert.equal(pending.savePendingDeposit(owner, '1'.repeat(88), { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } }), false);
  const db = storage();
  for (const letter of '123456789ABCDEFGHJKLM'.slice(0, 20)) assert(pending.savePendingDeposit(owner, letter.repeat(88), db));
  assert.equal(pending.savePendingDeposit(owner, 'N'.repeat(88), db), false);
  assert.equal(pending.readPendingDeposits(owner, db).length, 20);
});
test('TC-DEP-WEB-03: enabled deposits require the exact canonical treasury token account', async () => {
  const treasuryAddress = Keypair.generate().publicKey.toBase58();
  const mint = Keypair.generate().publicKey.toBase58();
  const treasuryTokenAccount = getAssociatedTokenAddressSync(new PublicKey(mint), new PublicKey(treasuryAddress)).toBase58();
  let body = { ok: true, enabled: true, decimals: 6, rate: 10, network: 'test', treasuryAddress, mint, treasuryTokenAccount };
  const api = load('../components/deposit/deposit-api.ts', { fetch: async () => ({ ok: true, json: async () => body }) }, {
    '@/lib/game-api': { GAME_API_BASE_URL: 'http://localhost:3000' }, '@/components/auth/session': {},
  });
  assert.equal((await api.fetchDepositInfo()).ok, true);
  body = { ...body, treasuryTokenAccount: Keypair.generate().publicKey.toBase58() };
  assert.equal((await api.fetchDepositInfo()).ok, false);
  body = { ...body, treasuryTokenAccount, decimals: 9 };
  assert.equal((await api.fetchDepositInfo()).ok, false);
});
function rpc(fetch, now = () => 100000) {
  return load('../app/api/solana-rpc/route.ts', { fetch, Date: { now }, process: { env: { SOLANA_RPC_UPSTREAM: 'https://rpc.invalid' } } });
}
function request(body = JSON.stringify({ jsonrpc: '2.0', method: 'getBalance', params: [] }), origin = 'http://localhost:3004') {
  return new Request('http://localhost:3004/api/solana-rpc', { method: 'POST', headers: origin ? { origin } : {}, body });
}
test('TC-DEP-WEB-04: origin and minute budget reject abuse before upstream calls', async () => {
  let calls = 0, clock = 100000;
  const api = rpc(async () => { calls++; return new Response('{}'); }, () => clock);
  assert.equal((await api.POST(request(undefined, null))).status, 403);
  for (let i = 0; i < 60; i++) assert.equal((await api.POST(request())).status, 200);
  const busy = await api.POST(request());
  assert.equal(busy.status, 429); assert(busy.headers.get('Retry-After')); assert.equal(calls, 60);
  clock += 60001;
  assert.equal((await api.POST(request())).status, 200);
});
test('TC-DEP-WEB-05: bounds parallel calls and releases slots after completion', async () => {
  const complete = [];
  const api = rpc(() => new Promise(resolve => complete.push(resolve)));
  const requests = Array.from({ length: 8 }, () => api.POST(request()));
  while (complete.length < 8) await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal((await api.POST(request())).status, 429);
  complete.forEach(resolve => resolve(new Response('{}')));
  assert((await Promise.all(requests)).every(response => response.status === 200));
});
test('TC-DEP-WEB-06: rejects oversized streaming bodies without Content-Length', async () => {
  let calls = 0;
  const api = rpc(async () => { calls++; return new Response('{}'); });
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65537)); controller.close(); } });
  const req = new Request('http://localhost:3004/api/solana-rpc', { method: 'POST', headers: { origin: 'http://localhost:3004' }, body, duplex: 'half' });
  assert.equal((await api.POST(req)).status, 413); assert.equal(calls, 0);
});
