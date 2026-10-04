# Web login, wallet, Cash and WebGL launch

This landing app reuses the colleague's login form, connected to our existing UnityServer and farm-filch database. The original backend Supabase login and `/unity-launch` remain separate and unchanged.

## Configuration

Public build-time variables (no secrets):

```
NEXT_PUBLIC_GAME_API_URL=http://localhost:3000
NEXT_PUBLIC_GAME_URL=http://localhost:9599/
```

Local landing runs on port 3004, farm-filch bridge on 3001, UnityServer on 3000, WebGL on 9599. For production configure HTTPS URLs; the landing and WebGL hosts must match the client's redirect allowlist. Never put BRIDGE_TOKEN in NEXT_PUBLIC variables.

## Contract

- Browser login: `POST /auth/login` `{username,password}` with `X-Client-Version: 4`.
- Browser session is stored in localStorage (`farmfilch.webSession.v1`); passwords are never persisted. Server-side expiry/revocation remains authoritative. If storage is blocked, login still works until the page reloads.
- Browser launch: `POST /auth/web-launch-code` with the session bearer. No player ID supplied by the browser is trusted. The 90-second, single-use code requires its original session to remain valid until exchange.
- WebGL URL: `server`, `launchCode`, `webLogin=<landing origin>/login`.
- Game exchanges through `/auth/exchange` and clears the consumed code from its URL. F5 returns to `/login?launch=1`; a valid web session gets a new code, an expired one shows login.
- Cash reads `/wallet/cash`: integer milliCash from farm-filch, displayed with three fractional digits. Wallet identities and deposit receipts are stored in the same canonical database; no second balance source is used.
- Wallet sign-in uses `/auth/wallet-nonce`, `/auth/wallet`, `/auth/wallet-claim`. Account linking uses a separate signed challenge bound to the authenticated player, then `/auth/link-wallet`.
- `/buy-cash` supports wallet payment and manual transaction confirmation. Deposits require a linked signer, finalized USDT transfer and atomic receipt. Rate: 1 USDT = 10 Cash. Local deposits remain disabled until explicitly configured.
- `/leaderboard` supports Gold/Level, total players and authenticated personal rank. Browser-provided player IDs are ignored.
- Login responses from an obsolete request are discarded and revoked after logout or another account signs in.

Keep `/auth/launch-code` bridge-only. Do not replace our Prisma schema/migrations or copy the colleague's nested game server over UnityServer.

## Checks

`node --test src/lib/game-api.test.mjs src/lib/web-wallet.test.mjs`

Use `next build --webpack` / `next dev --webpack`; the SDK's AWS import resolves to its official browser entry. Public wallet provider IDs must be configured at build time. Detailed configuration and backend checks: [handoff](../docs/web-wallet-integration-handoff.md).

Run the full UnityServer suite and the local browser/WebGL integration checks before deployment. New username rules apply on the server; the form accepts legacy names unchanged.
