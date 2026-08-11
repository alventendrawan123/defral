# Defral Backend

Autonomous guard agent and HTTP API for the Defral vault on Base Sepolia.

**pnpm · TypeScript · ESM · vitest · viem · Express · KeeperHub**

---

## What this does

| Binary | Purpose |
|---|---|
| `pnpm dev:agent` | Autonomous guard agent — polls the oracle every 5 min, calls `guardRepay()` via KeeperHub when health drops below trigger |
| `pnpm dev:server` | HTTP API on `:3001` — viem multicall reads, KeeperHub proxy, Scalar docs |
| `pnpm prove` | One-command 8-step proof chain — runs live on Base Sepolia |
| `pnpm test` | 36 unit tests — zero network calls, zero chain dependency |

---

## Layout

```
backend/
├── agent/
│   ├── src/
│   │   ├── types.ts          # Domain types (Party, Loan, GuardPolicy, ...)
│   │   ├── health.ts         # Pure math: healthRatioBps, repayAmountToTarget
│   │   ├── errors.ts         # Typed error classes (ExecutionRevertedError, ...)
│   │   ├── ledger.ts         # Ledger interface + MockLedger (in-memory)
│   │   ├── guard.ts          # runGuardCycle — decision logic, no I/O
│   │   ├── keeperhub-ledger.ts  # KeeperHubLedger implements Ledger
│   │   └── index.ts          # Main loop with inFlight overlap guard
│   └── test/
│       ├── health.test.ts    # 14 tests — pin canonical numbers
│       ├── guard.test.ts     # 11 tests — MockLedger acceptance suite
│       └── keeperhub.test.ts # 11 tests — stubFetch KeeperHub contract
├── src/
│   ├── types.ts              # HTTP response shapes
│   ├── evm-ledger.ts         # viem multicall reads for HTTP API
│   ├── reconciler.ts         # Event-log reconciliation for unknown outcomes
│   ├── openapi.ts            # OpenAPI 3.1 spec (served at /openapi.json)
│   └── index.ts              # Express server — /api/position, /api/events, /docs
├── scripts/
│   └── prove.ts              # 8-step proof chain
├── .env.example              # Copy to .env and fill in secrets
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Setup

```bash
pnpm install --ignore-scripts

cp .env.example .env
# Edit .env — minimum required:
#   KEEPERHUB_API_KEY=kh_...
#   PUBLISHER_KEY=0x...   (only for pnpm prove)
```

---

## Commands

```bash
pnpm test          # 36 tests — health + guard + keeperhub — zero network
pnpm dev:agent     # start guard agent
pnpm dev:server    # start HTTP API on :3001
pnpm prove         # run 8-step proof chain live on Base Sepolia
```

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `RPC_URL` | no | `https://base-sepolia-rpc.publicnode.com` | Base Sepolia RPC |
| `CHAIN_ID` | no | `84532` | Chain ID |
| `VAULT_ADDRESS` | yes | — | DefralVault address |
| `LENDING_POOL_ADDRESS` | yes | — | MockLendingPool address |
| `NAV_ORACLE_ADDRESS` | yes | — | NavOracle address |
| `DUSD_ADDRESS` | yes | — | MockUSD (dUSD) address |
| `DUST_ADDRESS` | yes | — | MockTreasury (dUST) address |
| `KEEPERHUB_API_KEY` | yes | — | KeeperHub API key — never commit |
| `LEDGER` | no | `keeperhub` | `"mock"` for dry run without chain |
| `POLL_MS` | no | `300000` | Poll interval in ms. 5 min = 5000/month quota safe |
| `OVERLAP_GUARD` | no | `on` | `"off"` only to demo the overlap bug on camera |
| `PORT` | no | `3001` | HTTP server port |
| `PUBLISHER_KEY` | no | — | Publisher private key — only for `pnpm prove` |
| `ALLOWED_ORIGIN` | no | `http://localhost:3000` | CORS allowed origin |

---

## Architecture

### The seam: `Ledger` interface

```
guard.ts  ──────────────────────────────────────────►  Ledger interface
                                                              │
                                              ┌───────────────┴───────────────┐
                                              │                               │
                                         MockLedger                  KeeperHubLedger
                                     (in-memory, tests)          (viem reads + KH writes)
```

`guard.ts` never imports viem, never calls fetch, never reads env vars.
All I/O is behind the `Ledger` interface. The same 11 guard tests run against
both backends — `MockLedger` in the test suite, `KeeperHubLedger` on chain.

### Overlap guard

`setInterval` without an `inFlight` flag fires a new tick before the previous
one finishes. One `guardRepay` via KeeperHub takes 10–60 seconds — without the
guard, the same rescue gets submitted dozens of times.

Fix: `async while` + explicit `inFlight` boolean. Set `OVERLAP_GUARD=off` to
demonstrate the bug on camera. Never use `off` in production.

### KeeperHub critical path

| Situation | Behaviour |
|---|---|
| `status: "failed"` with HTTP 202 | **Contract revert** — throw `ExecutionRevertedError`. Do NOT mark as success. |
| `receiptStatus: "reverted"` | Contract revert — throw `ExecutionRevertedError` |
| `receiptStatus: "timeout"` / `"not_found"` / `"unconfirmed"` | **Unknown outcome** — throw `ExecutionUnknownError`. Never re-broadcast. Reconcile via `GET /api/events`. |
| HTTP 403 with spending cap message | Throw `SpendingCapError` — halt agent immediately |
| Idempotency-Key | SHA-256 of `chainId\|vault\|borrower\|roundId\|attemptEpoch` — same key on retries, new key only after confirmed terminal revert |

### Price feed contractId

```
contractId = `${oracleAddress}@${roundId}`
```

Oracle address is **immutable** in EVM — it never changes. Without `@${roundId}`,
`state.lastActedPriceFeedCidByLoan` matches on every tick after the first rescue
and the agent silently never fires again. No error, no log.

---

## HTTP API

Served at `http://localhost:3001`. Interactive docs at `/docs`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/position` | Live vault snapshot — one multicall, one block |
| `GET` | `/api/events?fromBlock=N` | Rescued event log from chain |
| `GET` | `/api/executions/:id` | KeeperHub execution status proxy |
| `GET` | `/openapi.json` | OpenAPI 3.1 spec |
| `GET` | `/docs` | Scalar interactive API reference |
| `GET` | `/health` | `{ status: "ok", ts: "..." }` |

Rate limit: 60 req/min per IP.

The `KEEPERHUB_API_KEY` is consumed server-side only — never forwarded to the browser.

---

## Tests

```
agent/test/health.test.ts    14 tests  canonical numbers: 16667, 12667, 758.62, 14500 ...
agent/test/guard.test.ts     11 tests  MockLedger: trigger, caps, grace, idempotency, multi-borrower
agent/test/keeperhub.test.ts 11 tests  stubFetch: body shape, Idempotency-Key, failed→throw,
                                       timeout→ExecutionUnknownError, SpendingCapError, idem replay
─────────────────────────────────────
Total                        36 tests  zero network calls
```

---

## Prove run

```bash
pnpm prove
```

Runs 8 steps live on Base Sepolia and archives results to `../docs/evidence/prove-run-<ts>.json`:

| Step | Action | Expected |
|---|---|---|
| 0 | Restore NAV to 1.00 | — |
| 1 | Read position | health ≥ 13000 |
| 2 | `guardRepay()` on healthy position | ✅ `Refused_Healthy` |
| 3 | Publisher pushes NAV below trigger | tx on BaseScan |
| 4 | `guardRepay()` after dip | ✅ Rescue |
| 5 | `guardRepay()` on unguarded position at same price | ✅ Liquidation / Refused_AlreadyActed |
| 6 | `sweepCoupon()` | ✅ Swept / Refused_NoCouponDue |
| 7 | `guardRepay()` on restored position | ✅ `Refused_Healthy` / `Refused_AlreadyActed` |
| 8 | Check agent EOA dUSD balance | ✅ Must be **0** |

Dip price is calculated dynamically from current outstanding debt so the prove
run works regardless of how many times it has been run before.
