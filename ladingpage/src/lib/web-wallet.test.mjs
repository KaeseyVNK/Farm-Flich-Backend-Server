import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

function load(relative, extra = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, relative), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name === 'react' ? { useSyncExternalStore: (_, read) => read() } : { GAME_API_BASE_URL: 'http://localhost:3000' }, AbortSignal, ...extra });
  return exports;
}
function session() {
  const pending = [], revoked = [], stored = new Map(), events = new Map();
  const api = load('../components/auth/session.ts', {
    window: { localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) }, addEventListener: (key, fn) => events.set(key, fn) },
    fetch: (url, options) => {
      assert.equal(options.headers['X-Client-Version'], '4');
      if (url.endsWith('/auth/logout')) { revoked.push(options.headers.Authorization); return Promise.resolve({ status: 200, json: async () => ({ ok: true }) }); }
      return new Promise(resolve => pending.push(body => resolve({ status: 200, json: async () => body })));
    },
  });
  api.bootAuthFromStorage();
  return { api, pending, revoked, stored, events };
}
const response = (playerId, token) => ({ ok: true, playerId, sessionToken: token, username: playerId });

test('TC-WEB-WALLET-01: pending password response cannot restore a logged-out session', async () => {
  const { api, pending, revoked, stored } = session();
  const login = api.loginWithPassword('first', 'fake-password');
  await api.logout();
  pending[0](response('first', 'older-token'));
  assert.equal((await login).ok, false);
  assert.equal(api.getAuthSnapshot().token, null);
  assert.equal(stored.size, 0);
  assert.deepEqual(revoked, ['Bearer older-token']);
});
test('TC-WEB-WALLET-02: late wallet response cannot overwrite a newer password login', async () => {
  const { api, pending, revoked } = session();
  const older = api.loginWithWallet('fake-address', 'fake-signature');
  const newer = api.loginWithPassword('newer', 'fake-password');
  pending[1](response('newer', 'newer-token'));
  assert.equal((await newer).ok, true);
  pending[0](response('older', 'older-token'));
  assert.equal((await older).ok, false);
  assert.equal(api.getAuthSnapshot().playerId, 'newer');
  assert.deepEqual(revoked, ['Bearer older-token']);
});
test('TC-WEB-WALLET-03: another tab cancels an outstanding login', async () => {
  const { api, pending, events, stored } = session();
  const login = api.loginWithPassword('first', 'fake-password');
  stored.set(api.SESSION_STORAGE_KEY, JSON.stringify({ token: 'other-token', username: 'other', playerId: 'other' }));
  events.get('storage')({ key: api.SESSION_STORAGE_KEY });
  pending[0](response('first', 'older-token'));
  assert.equal((await login).ok, false);
  assert.equal(api.getAuthSnapshot().playerId, 'other');
  assert.equal(api.isSameWallet('ABc', 'Abc'), false);
});
test('TC-WEB-WALLET-04: Cash previews retain 3 decimals and reject unsafe totals', () => {
  const math = load('../components/deposit/usdt-amount.ts');
  assert.equal(math.rawToCash(BigInt(1234567), 10, 6), 12.345);
  assert.equal(math.rawToCash(BigInt(1000000), 10, 6), 10);
  assert.equal(math.rawToCash(BigInt('999999999999999999999'), 10, 6), null);
});
test('TC-WEB-WALLET-05: new wallet names match the server 1–10 rule', () => {
  const names = load('./farmer-name.ts');
  assert.equal(names.validateFarmerName(' A_1 ').value, 'a_1');
  assert.equal(names.validateFarmerName('abcdefghijk').ok, false);
});
