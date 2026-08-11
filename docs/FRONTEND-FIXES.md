# Frontend Fix Plan — Rabu 12 Agt 2026

**Scope:** frontend only. No SC, no backend.  
**Deadline:** Kamis 13 Agt 17:00 WIB  
**Written:** 2026-08-12 00:17 WIB

Video recording dan demo dihandle sendiri — tidak ada di sini.

---

## Current state

| Item | Status |
|---|---|
| Chain reads (`vaultReads.ts`) | ✅ done |
| Backend integration (`vaultSnapshot.ts`) | ✅ done |
| Capability matrix (8 rows, real evidence) | ✅ done |
| Proof archive (`proof-archive.json`) | ✅ done, real executionIds |
| Dashboard live data | ✅ done |
| Vault read-only page | ✅ done |
| Oracle-stale amber copy | ✅ done (`POSTURE_COPY['oracle-stale']`) |
| 53 tests | ✅ green |
| Type check | ✅ zero errors |

---

## Fixes needed (ordered by priority)

### FIX-1 🔴 Block number undefined guard

**File:** `frontend/src/app/dashboard/_components/container.tsx`  
**File:** `frontend/src/app/vault/_components/container.tsx`

**Problem:** both containers render:
```tsx
Block {snapshot.blockNumber?.toString()}.
```
When `blockNumber` is `undefined` (as it will be after chain-snapshot is refreshed from the backend which doesn't always include it), the UI shows "Block undefined."

**Fix:**
```tsx
{snapshot.source === 'committed-snapshot' ? (
  <p className="rounded-md border border-line-soft bg-surface-sunken px-4 py-2 text-sm text-ink-muted">
    {SNAPSHOT_NOTICE}{snapshot.blockNumber ? ` Block ${snapshot.blockNumber.toString()}.` : ''}
  </p>
) : null}
```

**Acceptance:** no "Block undefined" visible in any render state.

---

### FIX-2 🔴 `chain-snapshot.json` is stale

**File:** `frontend/docs/evidence/chain-snapshot.json`

**Problem:** snapshot was committed before the prove runs. The vault's `outstanding` and `reserve` have changed from multiple rescues. The snapshot fallback shows wrong numbers.

**Fix:** regenerate after `pnpm dev:server` is running:

```bash
# From repo root, with backend running on :3001
curl -s http://localhost:3001/api/position > /tmp/pos.json

# Then manually copy fields into frontend/docs/evidence/chain-snapshot.json
# matching the schema the frontend's chainSnapshotSchema expects
```

Or use the backend RPC directly with `cast`:
```bash
cast call 0x4f634d7173eFf255973E762c3Fe04DF4887FfB35 \
  "getPosition()" \
  --rpc-url https://base-sepolia-rpc.publicnode.com
```

**Acceptance:** `chain-snapshot.json` has `lastActedRound > 0` and `outstanding` matching the current on-chain state.

---

### FIX-3 🔴 Add `NEXT_PUBLIC_RPC_URL` to `frontend/.env`

**File:** `frontend/.env`

**Problem:** `NEXT_PUBLIC_RPC_URL` is missing. The viem client falls back to `https://sepolia.base.org` which was down on 2026-08-11. Direct RPC reads (non-backend mode) will fail silently.

**Fix:** add to `frontend/.env`:
```env
NEXT_PUBLIC_RPC_URL=https://base-sepolia-rpc.publicnode.com
```

Also add to `frontend/.env.example` for documentation.

**Acceptance:** `PUBLIC_ENV.NEXT_PUBLIC_RPC_URL` resolves to publicnode URL in both dev and production.

---

### FIX-4 🟡 Add demo vault entry to `proof-archive.json`

**File:** `frontend/docs/evidence/proof-archive.json`

**Problem:** all 5 entries point to the rehearsal vault `0x8E11A9a4...`. The prove runs tonight produced real execution records on the **demo vault** `0x4f634d71...`. A judge inspecting the demo vault on BaseScan sees no matching proof entries.

**Fix:** add one entry from tonight's prove run (Step 2 — refusal on demo vault):

Open `docs/evidence/prove-run-2026-08-11T15-47-41-190Z.json`, find Step 2 `executionId`, add:

```json
{
  "id": "refused-healthy-demo",
  "rank": 6,
  "title": "The live demo vault refuses the agent when the position is healthy",
  "claim": "The demo vault — never defended before — re-reads the oracle and refuses while the ratio is above the trigger.",
  "caller": "0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3",
  "callerRole": "agentExecutor",
  "target": "0x4f634d7173eFf255973E762c3Fe04DF4887FfB35",
  "targetLabel": "demo vault",
  "kind": "execution-record",
  "contractError": "Refused_Healthy(19497, 13000)",
  "executionId": "<from prove-run JSON step 2>",
  "transactionLink": null,
  "receiptStatus": "reverted",
  "blockNumber": null,
  "gasUsed": null,
  "isSponsored": true,
  "reading": "The demo position has never been defended. The contract returned its own error carrying the live ratio and the borrower's trigger."
}
```

**Acceptance:** proof page shows ≥1 entry with `targetLabel: "demo vault"`. Tests still pass.

---

### FIX-5 🟡 Proof archive source files list

**File:** `frontend/docs/evidence/proof-archive.json`

**Problem:** `sourceFiles` lists old evidence paths. Add the prove-run JSON path so the footer on `/proof` is accurate:

```json
"sourceFiles": [
  "docs/evidence/p3-refusal-evidence.json",
  "docs/evidence/p0-guard-path-end-to-end.json",
  "docs/evidence/live-contract-function-sweep.json",
  "docs/evidence/prove-run-2026-08-11T15-47-41-190Z.json"
]
```

**Acceptance:** `/proof` footer lists all source files.

---

### FIX-6 ⚪ `frontend/.env.example` missing `NEXT_PUBLIC_RPC_URL`

**File:** `frontend/.env.example`

Current content:
```env
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Should be:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_RPC_URL=https://base-sepolia-rpc.publicnode.com
```

**Acceptance:** `frontend/.env.example` documents all three variables.

---

## Execution order (pagi Rabu 12 Agt)

```
1. FIX-3  — add NEXT_PUBLIC_RPC_URL to frontend/.env and .env.example (2 min)
2. FIX-1  — fix blockNumber undefined guard in dashboard + vault container (5 min)
3. FIX-2  — regenerate chain-snapshot.json (10 min, needs backend running)
4. FIX-4  — add demo vault entry to proof-archive.json (5 min)
5. FIX-5  — update proof archive sourceFiles (2 min)
6.        — pnpm test && pnpm type-check && pnpm build (confirm all green)
7.        — commit with conventional message (lowercase subject, <100 char body lines)
```

Total estimated time: **~30 minutes**

---

## Commit message template

```
fix(frontend): refresh snapshot, add demo vault proof entry

- regenerate chain-snapshot.json from live backend
- add refused-healthy-demo entry to proof-archive.json
- fix blockNumber undefined guard in snapshot banner
- add NEXT_PUBLIC_RPC_URL to env files
```

---

## Definition of done

- [ ] No "Block undefined" in any render state
- [ ] `chain-snapshot.json` has `lastActedRound > 0`
- [ ] `proof-archive.json` has ≥1 entry with `targetLabel: "demo vault"`
- [ ] `NEXT_PUBLIC_RPC_URL` set in `frontend/.env`
- [ ] `pnpm test` 53/53 green
- [ ] `pnpm type-check` zero errors
- [ ] `pnpm build` succeeds
- [ ] All committed with conventional commit messages
