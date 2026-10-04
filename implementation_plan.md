# Web login integration — 2026-10-04

Approved by the user: keep our backend/database and integrate the colleague's username/password web UI into `ladingpage`. Work on `feature/integrate-web-login`; no commit, push, deploy or production writes.

## Client/server contract checkpoint

- Landing `/login` calls UnityServer `/auth/login` with `X-Client-Version: 4`. Existing names are not restricted by browser validation; the server validates new accounts.
- Add bearer-only `/auth/web-launch-code`, deriving the identity from the session, never browser `playerId`. Codes expire in 90 seconds, are single-use and depend on the originating web session remaining valid.
- Keep bridge-only `/auth/launch-code` and Supabase `/unity-launch` intact.
- Launch WebGL with `server`, `launchCode`, `webLogin=<landing origin>/login`. Client accepts the two exact return paths under its existing same-host HTTPS / loopback HTTP policy. Refresh obtains a fresh code; expired sessions show login.
- Cash is read through UnityServer `/wallet/cash`, backed by farm-filch's integer milliCash ledger. No wallet binding, deposits, schema replacement or teammate game-server copy.

## Validation

- Full UnityServer `npm test` with isolated persistence disabled; source `data/local/farms.json` hash must stay unchanged.
- Landing typecheck, targeted lint, production build and browser tests covering incorrect password, legacy username, launch, refresh, expired session and logout.
- Unity compilation, redirect allowlist checks and a rebuilt WebGL browser exchange.

## Status

Completed locally. Teammate source remains read-only.

### Done ? 2026-10-04

- Reused the colleague's login form/page in `ladingpage`, adapting copy and removing wallet dependencies. Added account/Cash display and session-aware Play buttons to navbar, hero and footer.
- Browser auth uses the existing game login, version header and canonical server player ID. LocalStorage stores only the web session/identity; source-session revocation invalidates pending launch codes.
- UnityServer adds `/auth/web-launch-code`; the existing bridge endpoint and exchange remain compatible. Exchange reads the current username-setup gate for web codes, so completed setup cannot be restored by an older code.
- Client accepts exact `/login` and `/unity-launch` return paths under its existing secure host policy. Added 12 executable Editor redirect checks.
- Landing app root/tracing is explicitly scoped to `ladingpage`, avoiding accidental imports of the parent backend proxy. No package/schema/migration replacement.

### Verified

- Full UnityServer `npm test`: exit 0, including TC-WEB-01..06 and existing security/economy/Filch/restart suites. Original `UnityServer/data/local/farms.json` SHA256 unchanged: `9FFAAC7F60CBD04E1813FEA60C5DE08F011EE923C04CC03AB44B486D102772A3`.
- Landing typecheck and targeted ESLint: exit 0. Five URL/content checks pass. Production Next build: exit 0.
- Unity: 12 redirect checks pass, console has no errors; WebGL release completed in 319 seconds (`.playtest-data/build-web-integration-result.txt`).
- Browser: legacy username/password, wrong password, three-decimal Cash, session persistence, source logout, WebGL exchange, F5, expired session/no loop, farm progress/appearance preservation: pass; no runtime errors or external requests.
- New account: invalid new-name rejection and character-setup launch: pass. Existing Supabase `/unity-launch` login/F5 regression: pass.
- Independent focused read-only review: PASS, limited to named server/landing auth files; Unity behavior and Cash internals verified separately by the supervisor.

### Local handoff

- Landing: `http://localhost:3004/login`
- Backend bridge: `http://localhost:3001`
- UnityServer sandbox: `http://localhost:3000`
- WebGL: `http://localhost:9599` (launch through landing so `server` is supplied).
- Demo names `web'demo` (legacy) and `webnew` (pending character setup); credentials are only in ignored `.playtest-data/integrated-web-login.json`.
- Follow `ladingpage/WEB_LOGIN_INTEGRATION.md` for public URL configuration. Wallet/deposit integration was subsequently added; actual provider/payment configuration remains pending. No commit, push, deployment or production-data mutation.

### Wallet/deposit follow-up checkpoint (2026-10-04)

- Web uses the existing UnityServer bridge and canonical farm-filch Cash ledger; game launch contract unchanged.
- Pending receipts persist per player/network/wallet and restore after reload; stale send/confirm callbacks cannot affect another session.
- Enabled payment requires configured treasury token account to match the canonical ATA; invalid settings hide all payment instructions/actions.
- RPC has a per-process 60/minute budget, 8 concurrent requests, mandatory matching Origin and streamed 64 KiB body limit. Configure public origin behind reverse proxy and shared ingress limits for replicas.
- Validation: 13 landing tests, TypeScript, focused ESLint, production Webpack build passed. Browser pending reload/account-switch/destination-mismatch regressions passed with mocked chain data. Actual local web login, WebGL launch/F5/expiry/progress and Cash/leaderboard pages passed with zero browser errors.
- No real transfer/provider login executed. Original UnityServer farm-data SHA256 unchanged. Full configuration/handoff: `docs/web-wallet-integration-handoff.md`.
