# Code Standards — Masked Farm

> YAGNI / KISS / DRY. File ngắn, test thật, server-authoritative.

## Nguyên tắc
- **YAGNI:** không build feature ngoài scope MVP.
- **KISS:** shortest working diff. 1 dòng giải quyết = 1 dòng.
- **DRY:** check module có sẵn trước khi tạo mới.
- **Deletion over addition.** No unrequested abstraction (no interface 1 impl, no factory 1 product, no config cho value bất biến).

## File naming + size
- kebab-case, tên dài mô tả đủ (self-documenting cho Grep/Glob).
- Code file <200 dòng → modularize theo logical boundary. Markdown/config/bash/env không giới hạn.

## Server-authoritative pattern
- Gold + Inventory: **RPC atomic** (`UPDATE...WHERE qty>=X RETURNING`, rowcount check) — KHÔNG app-code check-then-write.
- Farm JSONB (terrain/crops/objects/forage/shippingBoxes/gameMeta phi-gold): client ghi.
- Raid join: atomic `RETURNING` gate (presence chỉ hint).
- Prisma `service_role` server-only. RLS = roadmap.

## Test strategy (TDD-lite)
- Pure logic test trước: dog BFS/LOS, puzzle gen/validate, alert FSM, shield, loss-cap, finalize transaction, join atomic.
- I/O (Supabase/Prisma) defer — integration dùng **local postgres docker** (`tests/integration/`, cô lập, không quota Supabase).
- **Không mock/fake/cheat để pass build.** Real Bun test + real local postgres.
- Self-check assert trong `room.tick` (invariants: bounds, alert ∈ [0,100], bite count ≤3).

## Test commands
| Lệnh | Scope |
|---|---|
| `npm test` | vitest root |
| `cd mini-services/raid-server && bun test` | raid-server unit |
| `npm run test:integration` | 2-client raid flow (local postgres) |

## Code quality
- TS strict, kebab-case file, descriptive comment cho logic phức tạp.
- try/catch ở trust boundary + nơi có data loss risk.
- **No Edge Functions** (wall-clock < raid tick — Supabase Edge loại).
- No new dependency nếu stdlib/installed giải quyết được.
- Comment giải thích **why** (invariant/race/trade-off), KHÔNG reference plan artifact (phase/F1/audit/H7 —review-audit-self-decision rule §5).

## Git
- Conventional commit: `feat:` · `fix:` · `refactor:` · `test:`. Không `chore`/`docs` cho file `.claude`.
- No AI reference trong commit message.
- **No secrets commit** (`.env.local`, service role key, DB password) — `.gitignore` đã có.
- Lint pass before commit (`npm run lint`).
- Test pass before push. Không ignore fail test để pass CI.

## Lint / Build
- `npm run lint` — eslint
- `npm run build` — next build (standalone output)

## Review gate
- `code-reviewer` agent sau mỗi feature implementation.
- Fix critical/high trước merge.

Xem `./project-overview-pdr.md` (scope), `./system-architecture.md` (authority boundary).
