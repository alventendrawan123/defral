# Defral — Integration Plan
## Frontend × Backend × Smart Contract

> **Deadline:** Thursday 2026-08-13 · 17:00 WIB  
> **Current time:** Monday 2026-08-11 · 22:05 WIB  
> **Remaining:** ~43 hours  
> **Chain:** Base Sepolia `84532`

---

## 1. Current State

| Layer | Status | Owner |
|---|---|---|
| **Smart Contract** | ✅ Deployed & verified on Base Sepolia | alven |
| **Backend agent** | ✅ Built, 36/36 tests green, starts clean | islakun |
| **Backend HTTP server** | ✅ Built, Scalar docs at `/docs` | islakun |
| **Frontend** | ✅ Built, runs against committed snapshot | bima |
| **Integration** | ⚠️ Not connected end-to-end yet | all |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     BASE SEPOLIA                        │
│                                                         │
│  DefralVault ←── KeeperHub EOA (agentExecutor)         │
│      │                    ↑                             │
│      │            KeeperHub API                         │
│      │                    ↑                             │
│      ↓             backend/agent              ←── POLL  │
│  MockLendingPool         (guard loop)                   │
│  NavOracle               5 min idle                     │
│                                                         │
│  [viem multicall reads] ←── backend/src/index.ts        │
│                                    ↓                    │
│                           GET /api/position             │
│                           GET /api/events               │
│                           GET /api/executions/:id       │
│                           GET /docs (Scalar)            │
│                                    ↓                    │
│                          frontend (Next.js)             │
│                       NEXT_PUBLIC_API_URL               │
└─────────────────────────────────────────────────────────┘
```

**Key invariants (never change these):**
- `guardRepay()` and `sweepCoupon()` are **zero-argument** — agent sends no price, no amount, no destination
- Reserve funds **never leave borrower's wallet** — no `withdraw()`, no `topUp()` in vault
- Agent EOA dUSD balance must be **exactly zero** after any rescue
- Publisher key ≠ Agent key ≠ Borrower key — **three separate signers**

---

## 3. Contract Addresses (Base Sepolia)

| Contract | Address |
|---|---|
| DefralVault (demo) | `0x4f634d7173eFf255973E762c3Fe04DF4887FfB35` |
| DefralVaultFactory | `0x1cbb29944ecfe0c5d8961f31bec296504615ac19` |
| MockLendingPool | `0x35371ed6e29dde1fde4dbe8a6048ffb0c860b9ed` |
| NavOracle (dUST) | `0x44b94bb593f6de51ad3385264c0168eec8e56392` |
| MockUSD (dUSD, 6dp) | `0x9d9734fbb490b603a27f82ec0e23cdfdd9d6b838` |
| MockTreasury (dUST, 18dp) | `0x0a72124d5e606ab4264a653b6942738cbabd2d43` |

| Actor | Address |
|---|---|
| agentExecutor (KeeperHub EOA) | `0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3` |
| borrower demo | `0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2` |
| publisher NAV | `0x104bd087D5e4767370D8569A32B2DD986c3b1c4A` |
| deployer / pool owner | `0xe2d3B7FEA35Ea3B7B8d530cfF58a8227ce62BFAD` |

> ⚠️ **Demo vault** is at the first address. **Do NOT use** rehearsal vault `0x8E11A9a4f43271a37f75AFE6e64746A824A06094` — it's already been used.

---

## 4. Canonical Numbers

These numbers must appear **identically** in Solidity, backend, and UI. If any one differs, the core argument breaks.

| Stage | Health (bps) | Outstanding (dUSD) | Action |
|---|---|---|---|
| Open | 16,667 | 6,000.000000 | — |
| NAV $1.00 → $0.76 | 12,667 | 6,000.000000 | below trigger 13,000 |
| `guardRepay()` | **14,500** | **5,241.379310** | repaid **758.620690** |
| `sweepCoupon()` | 14,818 | 5,128.879310 | swept **112.500000** |

Decimals: **dUSD = 6dp · dUST = 18dp · oracle price = 8dp · health = bps (÷10,000)**

---

## 5. Integration Tasks

### Phase 1 — Backend goes live (Tonight, Mon 22:00 → Tue 02:00 WIB)

**Owner: islakun**

#### 5.1 Fill `.env` with real values

File: `backend/.env`

```env
# Already set (keep these):
VAULT_ADDRESS=0x4f634d7173eFf255973E762c3Fe04DF4887FfB35
NAV_ORACLE_ADDRESS=0x44B94bb593F6De51Ad3385264C0168eEc8E56392
LENDING_POOL_ADDRESS=0x35371eD6E29ddE1fDE4DBe8A6048fFb0C860b9eD
DUSD_ADDRESS=0x9D9734fBb490b603A27f82ec0e23cDfDD9D6b838
DUST_ADDRESS=0x0A72124d5e606aB4264a653B6942738CBAbd2D43
RPC_URL=https://sepolia.base.org
CHAIN_ID=84532
PORT=3001

# Fill these in:
KEEPERHUB_API_KEY=kh_...          # from KeeperHub dashboard → Settings → API Keys
LEDGER=keeperhub                  # switch from mock to live
POLL_MS=300000                    # 5 min — safe for 5000/month quota
OVERLAP_GUARD=on                  # always on except during demo recording

# Only for pnpm prove:
PUBLISHER_KEY=0x...               # ask alven — publisher of NavOracle
```

#### 5.2 Verify first real rescue on chain

```bash
cd backend
pnpm dev:server   # confirm: Backend listening on http://localhost:3001
pnpm dev:agent    # confirm: Agent starting. ledger=keeperhub ...
```

Then watch the agent log. Push a price dip via alven's publisher key:
```bash
cast send 0x44b94bb593f6de51ad3385264c0168eec8e56392 \
  "setPrice(int256)" 76000000 \
  --private-key $PUBLISHER_KEY \
  --rpc-url https://sepolia.base.org
```

Expected agent log:
```
Price dipped 24.00%. Repaid $758.62 from your reserve. Position safe. — Defral
```

Expected on-chain: `Rescued` event, tx verified on BaseScan.

#### 5.3 Verify HTTP server endpoints

```bash
# Position snapshot
curl http://localhost:3001/api/position | jq .healthRatioBps

# Rescue events
curl http://localhost:3001/api/events | jq .

# Scalar docs
open http://localhost:3001/docs

# Health check
curl http://localhost:3001/health
```

Acceptance: all return JSON, no 500 errors.

---

### Phase 2 — Frontend connects to backend (Tue 09:00 → 12:00 WIB)

**Owner: bima** (with islakun on standby)

#### 5.4 Frontend `.env` — already set

File: `frontend/.env`
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

This enables `isBackendMode()` → `true` in `frontend/src/constants/env.ts`.

#### 5.5 How frontend data flow works

The frontend already has two modes built in:

**Mode A — No backend (`NEXT_PUBLIC_API_URL` unset):**
- `loadVaultSnapshot()` → `readVaultSnapshot()` via direct RPC
- Fallback: `readCommittedSnapshot()` from `docs/evidence/chain-snapshot.json`

**Mode B — Backend mode (`NEXT_PUBLIC_API_URL` set):**
- Frontend currently calls `loadVaultSnapshot()` directly via viem (not the backend HTTP API)
- **Action needed:** wire frontend to call `GET /api/position` when `isBackendMode()` is true

#### 5.6 Wire `/api/position` into frontend data fetching

File to edit: `frontend/src/services/chain/vaultSnapshot.ts`

Current code calls `readVaultSnapshot()` directly. Add a branch:

```typescript
// frontend/src/services/chain/vaultSnapshot.ts

import { isBackendMode, PUBLIC_ENV } from '@/constants/env';

export async function loadVaultSnapshot(): Promise<VaultSnapshot> {
  if (isBackendMode()) {
    return fetchSnapshotFromBackend();
  }
  try {
    return await readVaultSnapshot();
  } catch {
    return readCommittedSnapshot();
  }
}

async function fetchSnapshotFromBackend(): Promise<VaultSnapshot> {
  const res = await fetch(`${PUBLIC_ENV.NEXT_PUBLIC_API_URL}/api/position`, {
    next: { revalidate: 30 }, // Next.js 13 ISR
  });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  const data = await res.json();
  // Map string bigints back to BigInt for frontend types
  return {
    ...data,
    vault: data.vault,
    position: {
      ...data.position,
      outstanding: BigInt(data.position.outstanding),
      collateralAmount: BigInt(data.position.collateralAmount),
      maxRepayPerEvent: BigInt(data.position.maxRepayPerEvent),
      reserve: BigInt(data.position.reserve),
      lastActedRound: BigInt(data.position.lastActedRound),
    },
    guardRepayQuote: BigInt(data.guardRepayQuote),
    couponDue: BigInt(data.couponDue),
    oracle: {
      ...data.oracle,
      roundId: BigInt(data.oracle.roundId),
      price: BigInt(data.oracle.price),
    },
    blockNumber: data.blockNumber ? BigInt(data.blockNumber) : undefined,
    source: 'chain' as const,
  };
}
```

#### 5.7 Wire `/api/events` into proof page

File to edit: `frontend/src/services/evidenceArchive.ts`

Current code reads from `docs/evidence/proof-archive.json` (static file).  
In backend mode, fetch from `GET /api/events`:

```typescript
// frontend/src/services/evidenceArchive.ts

import { isBackendMode, PUBLIC_ENV } from '@/constants/env';

export async function readProofArchive(): Promise<ProofEntry[]> {
  if (isBackendMode()) {
    const res = await fetch(`${PUBLIC_ENV.NEXT_PUBLIC_API_URL}/api/events`);
    if (!res.ok) return readStaticProofArchive(); // fallback
    const events = await res.json();
    return mapRescueEventsToProofEntries(events);
  }
  return readStaticProofArchive();
}
```

> Note: `mapRescueEventsToProofEntries` converts `RescueEventView[]` from backend  
> to `ProofEntry[]` shape the frontend expects. See schema mapping in §6.

#### 5.8 CORS — confirm backend allows frontend origin

`backend/src/index.ts` already sets:
```
Access-Control-Allow-Origin: http://localhost:3000
```

For production, set `ALLOWED_ORIGIN=https://defral.vercel.app` in backend `.env`.

---

### Phase 3 — Proof run (Tue 15:00 → 18:00 WIB)

**Owner: islakun + alven**

#### 5.9 Run `pnpm prove`

Requires `PUBLISHER_KEY` from alven in `backend/.env`.

```bash
cd backend
pnpm prove
```

This runs the full 8-step proof chain:
1. Read healthy position → health 16,667
2. `guardRepay()` on healthy → **Refusal #1** (Refused_Healthy)
3. Push NAV 1.00 → 0.76 via publisher key
4. `guardRepay()` after dip → **Rescue receipt** (758.62 repaid, 12667→14500)
5. `liquidate()` on unguarded position → **Liquidation receipt**
6. `sweepCoupon()` → 112.50 swept, health → 14,818
7. `guardRepay()` on restored position → **Refusal #2**
8. Assert agent EOA dUSD balance == 0

Output: `docs/evidence/prove-run-<timestamp>.json`  
**Commit this file immediately after it succeeds.**

#### 5.10 Update committed snapshot

After the rescue, update the committed snapshot so the frontend fallback reflects live state:

```bash
# Run a fresh snapshot and save to docs/evidence/chain-snapshot.json
curl http://localhost:3001/api/position | \
  jq '{
    vault: .vault,
    blockNumber: .blockNumber,
    position: {
      borrower: .position.borrower,
      outstanding: .position.outstanding,
      collateralAmount: .position.collateralAmount,
      triggerBps: .position.triggerBps,
      targetBps: .position.targetBps,
      maxRepayPerEvent: .position.maxRepayPerEvent,
      isCouponSweepEnabled: .position.isCouponSweepEnabled,
      reserve: .position.reserve,
      lastActedRound: .position.lastActedRound,
      isAgentRevoked: .position.isAgentRevoked
    },
    guardRepayQuote: .guardRepayQuote,
    couponDue: .couponDue,
    healthRatioBps: .healthRatioBps,
    liquidationBps: .liquidationBps,
    maxStaleSeconds: .maxStaleSeconds,
    oracle: .oracle,
    tokens: .tokens
  }' > frontend/docs/evidence/chain-snapshot.json
```

---

### Phase 4 — Demo prep & video (Wed 09:00 → 17:00 WIB)

**Owner: bima** (video) + islakun (standby) + alven (price dip)

#### 5.11 Demo script

The video must show every claim with a BaseScan link within 10 seconds.

| Beat | Action | Evidence |
|---|---|---|
| 0:00 | Open position screen — health 16,667, price 1.00 | Live dashboard |
| 0:30 | Show vault page — reserve 1,500, policy 13000/14500 | Live vault |
| 1:00 | alven pushes NAV 1.00 → 0.76 (tx on screen) | BaseScan tx |
| 1:30 | Dashboard updates — health 12,667, posture "would-defend" | Live dashboard |
| 2:00 | Agent fires `guardRepay()` automatically | Agent log |
| 2:15 | Show `Rescued` event tx — repaid 758.62, health 14,500 | BaseScan tx |
| 2:45 | Show unguarded position getting liquidated (Branch B) | BaseScan tx |
| 3:15 | Show refusal tx — agent tried on healthy position, chain refused | BaseScan tx |
| 3:45 | Show agent EOA dUSD balance = 0 (BaseScan token tab) | BaseScan |
| 4:00 | Show proof page — all entries, all BaseScan links | Frontend UI |

#### 5.12 Things to confirm before recording

- [ ] Both `pnpm dev:server` and `pnpm dev:agent` running
- [ ] Frontend shows live data (not committed snapshot banner)
- [ ] `docs/evidence/prove-run-*.json` committed to repo
- [ ] Demo vault position is "fresh" (health 16,667, debt 6,000)
- [ ] alven has publisher key ready to push price dip on cue
- [ ] BaseScan shows contract verified (green checkmark)
- [ ] Agent EOA balance confirmed zero before demo

---

## 6. Data Schema Mapping

The backend returns bigints as **decimal strings** (JSON can't represent bigint natively).  
The frontend `VaultSnapshot` type uses `bigint`. The conversion bridge is in §5.6.

| Backend field | Type | Frontend field | Type |
|---|---|---|---|
| `position.outstanding` | `string` | `position.outstanding` | `bigint` |
| `position.collateralAmount` | `string` | `position.collateralAmount` | `bigint` |
| `position.maxRepayPerEvent` | `string` | `position.maxRepayPerEvent` | `bigint` |
| `position.reserve` | `string` | `position.reserve` | `bigint` |
| `position.lastActedRound` | `string` | `position.lastActedRound` | `bigint` |
| `guardRepayQuote` | `string` | `guardRepayQuote` | `bigint` |
| `couponDue` | `string` | `couponDue` | `bigint` |
| `oracle.roundId` | `string` | `oracle.roundId` | `bigint` |
| `oracle.price` | `string` | `oracle.price` | `bigint` |
| `blockNumber` | `string \| null` | `blockNumber` | `bigint \| undefined` |

`RescueEventView` → `ProofEntry` mapping (for proof page in backend mode):

| Backend `RescueEventView` | Frontend `ProofEntry` |
|---|---|
| `id` | `id` |
| `kind` | maps to `kind` in `ReceiptStatus` |
| `timestamp` | used to set `rank` (sort order) |
| `transactionLink` | `transactionLink` |
| `amount` | shown in `reading` string |
| `ratioBeforeBps` / `ratioAfterBps` | shown in `reading` string |

---

## 7. KeeperHub Constraints

| Constraint | Impact | Mitigation |
|---|---|---|
| **5,000 executions/month** | 60s poll = quota exhausted in 3.5 days | `POLL_MS=300000` (5 min) by default |
| **No verb reads** | Agent cannot read chain via KeeperHub | All reads via viem multicall |
| **Refused calls not broadcast** | No BaseScan tx for refusals | Use KeeperHub execution record as evidence instead |
| **status: "failed" ≠ HTTP error** | HTTP 202 returned even on revert | `assertTerminalSuccess()` in `keeperhub-ledger.ts` checks `status` field |
| **timeout/not_found = unknown** | Don't re-broadcast | Reconcile via `GET /api/events` (Rescued event log) |
| **Daily spending cap** | POSTs blocked on 403 | `SpendingCapError` halts agent immediately |

---

## 8. Environment Variables Summary

### `backend/.env`

```env
RPC_URL=https://sepolia.base.org
CHAIN_ID=84532
VAULT_ADDRESS=0x4f634d7173eFf255973E762c3Fe04DF4887FfB35
LENDING_POOL_ADDRESS=0x35371eD6E29ddE1fDE4DBe8A6048fFb0C860b9eD
NAV_ORACLE_ADDRESS=0x44B94bb593F6De51Ad3385264C0168eEc8E56392
DUSD_ADDRESS=0x9D9734fBb490b603A27f82ec0e23cDfDD9D6b838
DUST_ADDRESS=0x0A72124d5e606aB4264a653B6942738CBAbd2D43
KEEPERHUB_API_KEY=kh_...
LEDGER=keeperhub
POLL_MS=300000
OVERLAP_GUARD=on
PORT=3001
ALLOWED_ORIGIN=http://localhost:3000
PUBLISHER_KEY=0x...    # only for pnpm prove — ask alven
```

### `frontend/.env`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
```

### `sc/.env`

Managed by alven — publisher private key lives here for `cast send`.

---

## 9. Commands Reference

```bash
# Backend
cd backend
pnpm test           # 36/36 tests — run before every deploy
pnpm dev:agent      # start guard agent (LEDGER=mock for dry run)
pnpm dev:server     # start HTTP API on :3001
pnpm prove          # full 8-step proof chain (needs PUBLISHER_KEY)

# Frontend
cd frontend
pnpm dev            # start Next.js on :3000
pnpm test           # run frontend tests

# Smart contract (alven)
cd sc
forge test          # run all SC tests
forge script ...    # deploy / interact

# Price manipulation (alven only)
cast send 0x44b94bb593f6de51ad3385264c0168eec8e56392 \
  "setPrice(int256)" 76000000 \
  --private-key $PUBLISHER_KEY \
  --rpc-url https://sepolia.base.org
  # 76000000 = $0.76 (8 decimals)
  # 100000000 = $1.00 — restore with this

# Kill port 3001 if occupied (PowerShell)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force
```

---

## 10. File Ownership

| Path | Owner | Do not touch |
|---|---|---|
| `sc/` | alven | islakun, bima |
| `docs/abi/*.json` | alven | islakun, bima |
| `frontend/src/` | bima | alven, islakun |
| `frontend/docs/evidence/` | islakun | — |
| `backend/agent/` | islakun | — |
| `backend/src/` | islakun | — |
| `docs/evidence/` | islakun | — |
| `docs/CONTRACTS.md` | alven | — |

---

## 11. Integration Checklist

### Must pass before submission (Thursday 17:00 WIB)

- [ ] `pnpm test` green in both `backend/` and `frontend/`
- [ ] `forge test` green in `sc/`
- [ ] `pnpm prove` completes — `docs/evidence/prove-run-*.json` committed
- [ ] ≥1 rescue tx verified on BaseScan
- [ ] ≥2 refusal execution records (KeeperHub `status: "failed"`)
- [ ] ≥1 liquidation tx (unguarded branch B)
- [ ] Agent EOA dUSD balance = 0 (BaseScan token tab)
- [ ] Frontend shows live position (not committed snapshot banner)
- [ ] `GET /api/position` returns 200 with real chain data
- [ ] `GET /docs` loads Scalar UI
- [ ] Demo video recorded — every claim has BaseScan link within 10 seconds
- [ ] Repo public — `forge test && pnpm test` passes from clean clone

### Nice to have (cut if time is tight)

- [ ] Frontend `/proof` page shows live events from `GET /api/events`
- [ ] Scalar docs deployed publicly (Railway / Render / Fly)
- [ ] Discord notification on rescue / refusal

---

## 12. Risk Log

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Demo vault position already used | Low | High | Check health before demo; restore with price push if needed |
| KeeperHub quota exhausted | Medium | High | `POLL_MS=300000`; check dashboard before demo recording |
| Publisher key not available | Low | High | Get from alven today (Mon night) |
| RPC rate limit during demo | Low | Medium | Frontend falls back to committed snapshot automatically |
| Backend not accessible from frontend | Low | High | Both on localhost; CORS already set |
| Refusal receipt shows no BaseScan link | — | — | **By design** — KeeperHub doesn't broadcast predicted reverts. Show execution record instead |

---

*Document generated: 2026-08-11 22:05 WIB*  
*Next checkpoint: First real rescue on-chain (target: Tue 11 Aug, before 09:00 WIB)*
