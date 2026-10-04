# Canonical Unity wallets and Cash deposits

All routes below require `x-bridge-token` matching server-only `BRIDGE_TOKEN`.
UnityServer verifies an Ed25519 signed nonce before calling the wallet binding
route. The browser must never receive the bridge token or choose a player ID
for an authenticated operation.

- Existing `GET /api/unity/wallet?userId=...` Cash balance contract is preserved.
- `GET /api/unity/wallet?address=...` or `?playerId=...` returns
  `{ok:true,wallet:{address,playerId,username}|null}`.
- `POST /api/unity/wallet` accepts `{action:"claim",address,name}` or
  `{action:"link",address,playerId}`. Claim requires a free 1–10 character
  lowercase letters/digits/underscore name. Existing users and farms cannot be
  claimed. One immutable wallet per player, one player per wallet.
- `GET /api/unity/deposit/info` returns public configuration, never the RPC URL.
- `POST /api/unity/deposit/confirm` accepts `{playerId,signature}`. No client
  amount is accepted. The backend fetches a finalized Solana transaction,
  requires success, the linked wallet signer and transfer authority, source
  token account ownership, SPL Token program, configured mint and destination,
  treasury owner and full net balance increase.

Deposit configuration is disabled unless all of these server-only values are
set: `DEPOSIT_SOL_RPC_URL` (HTTPS), `DEPOSIT_NETWORK` (stable chain identifier),
`DEPOSIT_USDT_MINT`, `DEPOSIT_TREASURY_ADDRESS`, `DEPOSIT_TREASURY_ATA`.
`DEPOSIT_USDT_DECIMALS` must be 6. ATA is explicit to avoid silently choosing an
incorrect treasury. Operator must verify mint and treasury for the configured
chain. No default mainnet address or fallback RPC is used.

Rate is fixed at 1 USDT = 10 Cash; minimum is 1 USDT. Credits use integer
milliCash (`raw * 10000 / 10^6`), rounding down only fractions below 0.001 Cash.
`CashDeposit` unique `(network,signature)` and an account row lock make receipt
creation and credit atomic, including concurrent requests. Replays return the
current balance without crediting again, even after a purchase. Cash remains
`User.cashMilli`; Unity farm snapshots never receive authority to credit Cash.

Migration `20261004140000_unity_wallet_deposit` adds tables only and enables RLS
without public policies. Existing progress, credentials and balances are kept.
Deployment needs migration and Prisma generation before serving these routes.

Validation: `node node_modules/vitest/vitest.mjs run --config vitest.wallet.config.mts`.
This configuration refuses any database except localhost/127.0.0.1:54322.
Tests mock RPC only, create their own fixtures and delete them afterward;
no real transaction or external chain request is made.

Leaderboard now returns `myRank` and `totalUsers`. UnityServer must forward
only the authenticated player ID for personal rank. Gold and level ties use
the canonical player ID as the final deterministic sort key.
