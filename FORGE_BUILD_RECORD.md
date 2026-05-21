# FORGE BUILD RECORD — SEALFORGE Week 1 Scaffold
## Builder: FORGE — SNAPKITTY Build Agent | Build Infrastructure Domain
## Architect: NOVA — SNAPKITTY Agent 9 | Synthetic Intelligence Domain
## Date: 2026-05-21 | PUBLIC | Sealed to WORM Ledger

---

> *"FORGE doesn't ask what to build. FORGE asks what will hold."*

---

## WHAT FORGE BUILT

FORGE delivered the complete Week 1 production scaffold for SEALFORGE —
scanning existing WORM patterns from `webhook-vault` and `bridge.ts`,
matching conventions exactly across 8 files.

---

## FILE INVENTORY

### `src/storage/worm-log.ts`
**Pattern:** Direct port from webhook-vault, adapted for SEALFORGE's event model.

WORM chain implementation:
- `WormLog` class — singleton, self-initializing, loads chain tip on boot
- `append(type, payload)` — seals any event into the chain; returns full `WormEntry`
- `verifyChain()` — replays all entries from GENESIS, returns `true/false`
- `getAll(limit, offset)` — paginated read with inline chain validity flag
- `getById(id)` — O(n) scan by UUID
- `tip()` — returns current chain head hash

Chain formula: `HMAC-SHA256(prevHash:id:receivedAt:JSON.stringify(payload))`
Chain starts at literal string `'GENESIS'`.
HMAC key: `process.env.WORM_SECRET` — falls back to `'dev-worm-key'` in dev only.

**Key FORGE decision:** Named the env var `WORM_SECRET` — clean namespace for a new
product, not inheriting `VAULT_SECRET` (webhook-vault) or `VAULT_MASTER_SECRET`
(bridge.ts/optimizer.ts). Each product owns its own secret name.

---

### `src/agent/seal.ts`
**Pattern:** Matches `bridge.ts` `sealWork()` exactly. Adds timing-safe verify.

Exports:
- `AgentWorkSeal` — `{ agent: string, timestamp: string, signature: string }`
- `SealedOutput<T>` — generic envelope `{ payload: T, seal: AgentWorkSeal }`
- `sealWork(agentName, payload)` — HMAC-SHA256 of `${agent}:${ts}:${JSON.stringify(payload)}`
- `sealOutput<T>(agentName, payload)` — convenience wrapper returns `SealedOutput<T>`
- `verifySeal(seal, payload)` — uses `crypto.timingSafeEqual` to prevent timing attacks

**Key FORGE decision:** `crypto.timingSafeEqual` on verification — constant-time
comparison blocks timing-based signature forgery. Standard `===` comparison
leaks timing information proportional to where strings diverge.

---

### `src/server.ts`
**Pattern:** Zero-dependency Node.js `http.createServer` — same approach as webhook-vault.

Routes:
- `GET /health` — returns `{ status: 'ok', tip, ts }` — no auth, used by Docker HEALTHCHECK
- `GET /chain/verify` — returns sealed `SealedOutput` wrapping `{ chainValid, tip }`
- `POST /events` — parses JSON body, calls `worm.append('event', payload)`, returns `WormEntry`
- `GET /events?limit&offset` — paginated ledger read with `chainValid` flag
- All other paths → `404 { error: 'not_found' }`

`WormLog` singleton exported from `server.ts` so `index.ts` can seal lifecycle events
against the same chain instance.

---

### `src/index.ts`
**Pattern:** Boot + graceful shutdown with lifecycle WORM sealing.

- Calls `startServer()` on boot
- Immediately appends `lifecycle: { event: 'server_start', version, ts }` to WORM chain
- Registers `SIGTERM` and `SIGINT` handlers — both append `server_stop` before exiting
- 10-second force-kill timeout via `timer.unref()` — Docker-compliant graceful shutdown

**Key FORGE decision:** `timer.unref()` prevents the force-kill timer from holding
the event loop open if the server closes cleanly before 10 seconds. Without this,
Docker containers hang at shutdown waiting for a timer that never needs to fire.

---

### `Dockerfile`
**Pattern:** Two-stage build — builder + runner. Node 22 Alpine.

```
Stage 1 (builder): node:22-alpine — npm ci + tsc
Stage 2 (runner):  node:22-alpine — copy dist/ + node_modules only
```

Security decisions:
- `addgroup -S appgroup && adduser -S appuser -G appgroup` — non-root user
- `USER appuser` before `CMD` — container never runs as root
- `VOLUME ["/app/data"]` — WORM log directory declared as Docker volume
- `HEALTHCHECK` via inline Node script — no `curl` or `wget` dependency needed
- `EXPOSE 3000` — matches `PORT` default in `server.ts`

---

### `package.json`
- Runtime deps: `uuid` (entry IDs), `axios` (future SDK outbound calls)
- Dev deps: `typescript`, `ts-node`, `@types/node`, `@types/uuid`
- Scripts: `build` (tsc), `dev` (ts-node src/index.ts), `start` (node dist/index.js), `typecheck` (tsc --noEmit)
- Engine pin: `node >= 18` — required for `crypto.timingSafeEqual` stability
- Contributors: NOVA (Architect) + FORGE (Builder) + Ahmad Ali Parr + Jessica Lee Westerhoff

### `tsconfig.json`
- Matches webhook-vault exactly: `ES2020`, `commonjs`, `strict: true`, `esModuleInterop: true`
- `outDir: ./dist`, `rootDir: ./src`, `declaration: true`, `sourceMap: true`

### `.gitignore`
- Excludes: `node_modules/`, `dist/`, `data/`, `*.worm.jsonl`, `.env*`, `*.log`
- **Critical:** `data/` and `*.worm.jsonl` are runtime-only — the WORM log is
  never committed to git. The log lives on the host, not in the repo.

---

## FORGE'S ARCHITECTURAL DECISIONS (SUMMARY)

| Decision | Why |
|----------|-----|
| `WORM_SECRET` env var name | Clean namespace — each product owns its secret |
| `crypto.timingSafeEqual` for verify | Blocks timing-based signature forgery |
| `timer.unref()` on shutdown timer | Docker-compliant — doesn't hold event loop open |
| Two-stage Dockerfile | Smaller runtime image — no build tooling in prod container |
| Non-root `appuser` | Security baseline — container compromise ≠ host root |
| `WormLog` singleton in `server.ts` | Single chain instance shared between server and lifecycle events |
| `data/` in `.gitignore` | WORM log is operational state, not source code |

---

## CHAIN OF CUSTODY

```
NOVA (Architect) → designed SEALFORGE product spec
FORGE (Builder)  → delivered Week 1 scaffold
CLAUDE           → executed file writes + GitHub push
```

All three signed. All three in the record.

---

## NEXT BUILD TARGET (FORGE + NOVA — Week 2)

- Ingest API (Next.js) — `POST /api/v1/ingest` — Zod validation, prompt fingerprinting
- TypeScript SDK — `@sealforge/sdk` — `sf.trace({ promptId, input, call })`
- End-to-end smoke test: SDK call → ingest → seal → return `{ seal, merkleRoot, ledgerEntryId }`

---

*FORGE — Build Agent — SNAPKITTY SACM — 2026-05-21*
*NOVA — Agent 9 — Synthetic Intelligence — SNAPKITTY SACM — 2026-05-21*
*Sealed to WORM ledger via git commit hash*
