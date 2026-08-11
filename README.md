# Defral

A collateralized loan position that defends itself — built on KeeperHub for Base Sepolia.

An autonomous agent watches the oracle and repays part of your debt before your position can be liquidated, using a reserve that never leaves your wallet. The contract refuses both agent actions while your position is healthy. The agent has exactly **two capabilities, both zero-argument** — it cannot send a price, an amount, or a destination.

> This project reuses conceptual work from an earlier Canton build by the same team. The boundary between what was carried over and what was written this week is documented up front in [PROVENANCE.md](./docs/PROVENANCE.md), including the one claim that did not survive the move.

Base Sepolia is a public chain. Every storage slot and every event log this product writes is readable by anyone. We make no privacy claim of any kind.

---

## Addresses (Base Sepolia · chainId 84532)

| Contract                  | Address                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **DefralVault (demo)**    | [`0x4f634d7173eFf255973E762c3Fe04DF4887FfB35`](https://sepolia.basescan.org/address/0x4f634d7173eFf255973E762c3Fe04DF4887FfB35) |
| MockLendingPool           | [`0x35371ed6e29dde1fde4dbe8a6048ffb0c860b9ed`](https://sepolia.basescan.org/address/0x35371ed6e29dde1fde4dbe8a6048ffb0c860b9ed) |
| NavOracle (dUST)          | [`0x44b94bb593f6de51ad3385264c0168eec8e56392`](https://sepolia.basescan.org/address/0x44b94bb593f6de51ad3385264c0168eec8e56392) |
| MockUSD (dUSD, 6dp)       | [`0x9d9734fbb490b603a27f82ec0e23cdfdd9d6b838`](https://sepolia.basescan.org/address/0x9d9734fbb490b603a27f82ec0e23cdfdd9d6b838) |
| MockTreasury (dUST, 18dp) | [`0x0a72124d5e606ab4264a653b6942738cbabd2d43`](https://sepolia.basescan.org/address/0x0a72124d5e606ab4264a653b6942738cbabd2d43) |

| Actor                         | Address                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| agentExecutor (KeeperHub EOA) | [`0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3`](https://sepolia.basescan.org/address/0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3) |
| borrower demo                 | `0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2`                                                                                    |

---

## Layout

| Path                       | What lives there                                                      |
| -------------------------- | --------------------------------------------------------------------- |
| `sc/`                      | Solidity contracts — Foundry. DefralVault, MockLendingPool, NavOracle |
| `backend/agent/`           | Autonomous guard agent — KeeperHub + viem                             |
| `backend/src/`             | HTTP API — Express, Scalar docs at `/docs`                            |
| `backend/scripts/prove.ts` | One-command proof chain — 8 steps, zero arguments                     |
| `frontend/`                | Next.js App Router frontend                                           |
| `frontend/docs/evidence/`  | Committed execution archive that `/proof` reads                       |
| `docs/abi/`                | Contract ABIs — shared by frontend and backend                        |
| `docs/evidence/`           | Archived prove run JSON — committed, readable after log expiry        |
| `docs/CONTRACTS.md`        | Contract addresses, function selectors, canonical numbers             |
| `docs/INTEGRATION.md`      | Full integration plan for all three layers                            |
| `docs/PROVENANCE.md`       | What was carried over from Cermin-RWA and what changed                |

---

## Quick start

### Smart contracts (Foundry)

```bash
cd sc
forge install
forge test
```

### Backend

```bash
cd backend
pnpm install --ignore-scripts

# Copy and fill in env vars
cp .env.example .env
# Edit .env: set KEEPERHUB_API_KEY and PUBLISHER_KEY

# Run guard agent (autonomous, polls every 5 min)
pnpm dev:agent

# Run HTTP API on :3001
pnpm dev:server

# Run all tests (36 tests, zero network calls)
pnpm test

# Run full 8-step proof chain (needs PUBLISHER_KEY)
pnpm prove
```

### Frontend

```bash
cd frontend
pnpm install --ignore-scripts

# Run dev server on :3000
pnpm dev

# Type check
pnpm type-check

# Run tests (53 tests)
pnpm test
```

The frontend works with no backend configured — it reads from the committed snapshot in `frontend/docs/evidence/chain-snapshot.json`. Set `NEXT_PUBLIC_API_URL=http://localhost:3001` in `frontend/.env` to connect to a live backend.

---

## How it works

```
oracle pushes new NAV price
        │
        ▼
agent reads: price + position + reserve (one multicall, one block)
        │
        ├─ health ≥ trigger (13000 bps)?  → do nothing
        │
        └─ health < trigger?
                │
                ├─ reserve > 0?  → guardRepay()   ← repays from borrower wallet
                │                                    directly to pool
                │                                    contract re-reads oracle
                │                                    inside the same tx
                │                                    refuses if already healthy
                │
                └─ reserve = 0?  → open grace period, notify pool
```

**Defence window:** 13000 bps (trigger) → 11000 bps (liquidation). The agent's only job is to keep the position above 11000.

**Canonical numbers** (identical in Solidity, agent, and UI):

| Stage                 | Health (bps) | Outstanding (dUSD) |
| --------------------- | ------------ | ------------------ |
| Open                  | 16,667       | 6,000.000000       |
| NAV $1.00 → $0.76     | 12,667       | 6,000.000000       |
| After `guardRepay()`  | **14,500**   | **5,241.379310**   |
| After `sweepCoupon()` | 14,818       | 5,128.879310       |

---

## Verification

Every claim on the site ends in something you can open yourself.

### Capability Matrix

Eight things the agent might do — each row has a transaction or an explicit statement that the function does not exist in the ABI.

### `/proof` page

Reads a JSON archive committed to this repository (`frontend/docs/evidence/proof-archive.json`). Works after execution logs expire. In backend mode (`NEXT_PUBLIC_API_URL` set), fetches live `Rescued` events from `GET /api/events`.

### Sponsored transactions

Sponsored transactions do not appear in wallet history: the `From` column on the explorer is the KeeperHub relayer and the action runs as an internal call. **Open the Logs tab** — that is where `Rescued` events are.

### Prove run

```bash
cd backend
pnpm prove
```

Runs 8 steps live on Base Sepolia:

1. Restore NAV to 1.00 — confirm healthy position
2. `guardRepay()` on healthy → **Refusal** (Refused_Healthy)
3. Publisher pushes NAV below trigger
4. Agent fires `guardRepay()` → **Rescue** (health restored)
5. Unguarded position at same price → **Liquidation** (Branch B)
6. `sweepCoupon()` → yield applied to debt
7. `guardRepay()` on restored position → **Refusal** (Refused_AlreadyActed)
8. Assert agent EOA dUSD balance == **0**

Output archived to `docs/evidence/prove-run-<timestamp>.json` and committed.

---

## API reference

The backend serves a Scalar API reference at **http://localhost:3001/docs**.

| Endpoint                  | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `GET /api/position`       | Live vault snapshot (one multicall, one block) |
| `GET /api/events`         | `Rescued` event log decoded from chain         |
| `GET /api/executions/:id` | KeeperHub execution status proxy               |
| `GET /openapi.json`       | OpenAPI 3.1 spec                               |
| `GET /docs`               | Scalar interactive docs                        |
| `GET /health`             | Server health check                            |

---

## Environment variables

### `backend/.env`

```env
RPC_URL=https://base-sepolia-rpc.publicnode.com
CHAIN_ID=84532
VAULT_ADDRESS=0x4f634d7173eFf255973E762c3Fe04DF4887FfB35
LENDING_POOL_ADDRESS=0x35371eD6E29ddE1fDE4DBe8A6048fFb0C860b9eD
NAV_ORACLE_ADDRESS=0x44B94bb593F6De51Ad3385264C0168eEc8E56392
DUSD_ADDRESS=0x9D9734fBb490b603A27f82ec0e23cDfDD9D6b838
DUST_ADDRESS=0x0A72124d5e606aB4264a653B6942738CBAbd2D43
KEEPERHUB_API_KEY=kh_...
LEDGER=keeperhub          # "mock" for dry run without chain
POLL_MS=300000            # 5 min idle; 60000 during demo recording
OVERLAP_GUARD=on          # "off" only to demonstrate the overlap bug on camera
PORT=3001
PUBLISHER_KEY=0x...       # only needed for pnpm prove
```

### `frontend/.env`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001   # omit to use committed snapshot
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_RPC_URL=https://base-sepolia-rpc.publicnode.com
```

---

## What we do not claim

- **Privacy** — removed from this version. Every storage slot is public. See [PROVENANCE.md](./docs/PROVENANCE.md).
- **MEV protection** — real, but mutually exclusive with gas sponsorship on testnet.
- **Multi-borrower onboarding** — one demo borrower. The idempotency key design handles multi-tenant safely.
- **Top-up collateral as defence** — requires swap; `/execute/swap` is a stub 501.
- **Grace period as a 72-hour timer** — present as state, not as a full enforcement engine.

---

## Team

| Name     | Role            |
| -------- | --------------- |
| Alven    | Smart contracts |
| Isallkun | Backend & agent |
| Bima     | Frontend        |
