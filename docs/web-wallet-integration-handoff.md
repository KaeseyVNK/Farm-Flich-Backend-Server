# Web wallet integration handoff — 2026-10-04

Changes are local on `feature/integrate-web-login`. No commit, push or deployment.
The colleague source at `D:\.farn-flich\farm-filch` is unchanged.

Implemented flows:

- Existing username/password login, including legacy usernames, and Launch Game.
- Signed Solana wallet login, first-time farmer name selection, and signed wallet linking to an existing account.
- Privy, Web3Auth and Particle adapter integration, loaded on login/top-up routes. One immutable wallet per account, case-sensitive addresses. SDK sessions are separate from the game bearer session.
- USDT top-up page: wallet transfer or manual signature confirmation, account Cash refresh, three-decimal previews and retry for transactions not finalized yet.
- Gold/Level leaderboard with authenticated personal rank and total players.
- Expired/revoked sessions, source logout before launch-code exchange, stale login responses, signature replay and cross-account wallet linking are rejected.

Canonical identity and Cash remain in farm-filch. UnityServer verifies wallet
nonce signatures, derives player IDs from the authenticated session and bridges
to the backend. WebGL keeps the existing `/auth/exchange` contract; no new game
wallet UI or replacement farm snapshot is required.

Public landing build variables:

```
NEXT_PUBLIC_GAME_API_URL=http://localhost:3000
NEXT_PUBLIC_GAME_URL=http://localhost:9599/
NEXT_PUBLIC_WALLET_PROVIDER=privy
NEXT_PUBLIC_PRIVY_APP_ID=<public app ID>
```

Alternatives: `web3auth` with `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`, or `particles`
with `NEXT_PUBLIC_PARTICLE_PROJECT_ID`, `NEXT_PUBLIC_PARTICLE_CLIENT_KEY`,
`NEXT_PUBLIC_PARTICLE_APP_ID`. Provider IDs/origin allowlists must be supplied
by the web owner; none were copied from the colleague's environment files.

Server-only landing `SOLANA_RPC_UPSTREAM` must target the same chain as backend
`DEPOSIT_SOL_RPC_URL`. The proxy permits only required Solana methods and has a
body/timeout limit. Do not put RPC credentials or bridge tokens in public env.
Backend deposit variables, mint/treasury/ATA verification and ledger contract
are described in [unity-wallet-deposit.md](unity-wallet-deposit.md).
`DEPOSIT_NETWORK` is an immutable chain identifier used for idempotency.

Both wallet provider and deposits deliberately remain unconfigured on local.
Real provider login/payment has not been tested, and no real money was sent.
Particle automatic connection uses `/auth/particles-token`, a session-bound
RS256 JWT. Configure server-only `PARTICLE_JWT_PRIVATE_KEY` (RSA 2048+ bits),
optional `PARTICLE_JWT_KEY_UUID` registered in the Particle dashboard, and
`PARTICLE_JWT_TTL_SECONDS` (30–600; default 120). After connecting silently,
the wallet still signs the player-bound link nonce. Missing configuration
falls back to manual connection. There is no gas subsidy.

Landing build/dev use Webpack. Particle's AWS credential dependency uses the
official browser entry; no fake cryptography/AWS stub is installed. The
Turbopack build encountered a Google font URL parsing error, and importing
the AWS Node aggregate breaks browser compilation. SDK build warnings about
the unused EVM Tempo import are nonfatal.

Migration `20261004140000_unity_wallet_deposit` adds wallet/deposit tables and
RLS; applied only to local PostgreSQL 127.0.0.1:54322 after a local dump backup.
No existing progress, credentials, balances or production data were replaced.

Validation commands:

```
# farm-filch: local-only DB guard, mocked chain
node node_modules/vitest/vitest.mjs run --config vitest.wallet.config.mts
# ladingpage
node --test src/lib/game-api.test.mjs src/lib/web-wallet.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build --webpack
# UnityServer: MASKED_FARM_PERSIST=0; isolated MASKED_FARM_DATA_DIR
npm test
```

Sandbox-only scripts/logs under `.playtest-data` record actual Ed25519 login,
claim/link/replay/launch API verification and browser/WebGL checks. Never
commit that directory or include its credential fixtures in a handoff archive.

Deployment remains a separate approval: additive database migration/generate
and farm-filch first, UnityServer second, landing/WebGL last, with matching
HTTPS URLs and provider origin configuration.

Final local verification (2026-10-04): backend wallet/deposit/Cash tests
17 passed; landing regression tests 7 passed; full UnityServer npm test passed.
Landing TypeScript, focused ESLint and production Webpack build passed.
Live API checks passed for signed wallet claim/login/link, nonce replay and
purpose rejection, launch exchange, canonical Cash and authenticated ranking.
Browser checks passed for legacy login, WebGL launch/reload, preserved progress,
Cash/Gold/Level pages and mobile layout, with no JavaScript errors.
The original UnityServer data/local/farms.json SHA256 remains unchanged.
No real provider login or on-chain deposit was performed.

Deposit follow-up fixes (2026-10-04): pending signatures are persisted per
player/network/linked wallet (maximum 20, no replacement of older receipts),
restored after reload and removed after successful confirmation. Confirmation
and wallet send callbacks are bound to their original session; switching
accounts clears the displayed result and cannot confirm using the new account.
If browser storage is blocked/full, copy the displayed signature or recover it
from wallet history. Restoration never sends another transfer automatically.

Before showing payment instructions or enabling payment, the web checks that
treasuryTokenAccount equals the canonical ATA for the configured mint/treasury
and that decimals/rate are 6/10. A mismatch fails closed.
The RPC proxy requires a matching Origin and caps each process at 60 requests
per minute, 8 concurrent requests and a streamed 64 KiB request body.
For a reverse proxy set server-only SOLANA_RPC_PUBLIC_ORIGIN to the public
landing origin, without a trailing slash. Multiple replicas also require a
shared ingress limit. Origin alone is not caller authentication; the global
budget bounds upstream usage even for spoofed Origin headers.

Additional regression command (landing):
`node --test src/lib/deposit-safety.test.mjs`.

Follow-up verification passed: 13 total landing tests, TypeScript, focused
ESLint and production Webpack build. Browser regression passed for pending
receipt restoration, stale account A confirmation while account B is active,
and payment blocking for a mismatched destination. Chain data was mocked;
no USDT was transferred. Actual local legacy login/WebGL exchange/F5/session
expiry/progress preservation and Cash/leaderboard checks passed again with
zero browser errors. Independent static review found no further material
issue within these four fixes.
