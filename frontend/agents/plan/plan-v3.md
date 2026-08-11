# Frontend Plan v3 — current state audit + remaining work

**Defral · KeeperHub Agents Onchain Hackathon · deadline 2026-08-13 17:00 WIB**  
**Written 2026-08-12 00:11 WIB — after backend integration landed on main.**

> Authority order (highest first):
> 1. `infoFromContracttoFE.md` — chain facts, read 2026-08-11
> 2. `docs/CONTRACTS.md` — addresses, selectors, canonical numbers
> 3. `../prd/PRD-defral.md` — behaviour and limits
> 4. This plan — remaining work only
> 5. `../rules/rules.template.md` — HOW every line is written, always

---

## 0. What already works (do NOT touch)

The following was built and is green in CI. Leave it alone.

| Item | Status | Notes |
|---|---|---|
| `services/chain/vaultReads.ts` | ✅ Done | multicall, bigint, all 10 tuple fields |
| `services/chain/snapshot.ts` | ✅ Done | committed fallback reads `chain-snapshot.json` |
| `services/chain/vaultSnapshot.ts` | ✅ Done | backend mode → `GET /api/position`, fallback to RPC, then snapshot |
| `services/chain/client.ts` | ✅ Done | viem public client, `NEXT_PUBLIC_RPC_URL` |
| `constants/contracts.ts` | ✅ Done | addresses, decimals, chain id |
| `constants/capabilities.ts` | ✅ Done | 8 rows, real executionIds and tx hashes |
| `constants/protocol.ts` | ✅ Done | bps constants |
| `types/index.ts` | ✅ Done | bigint types, CapabilityEvidence union, ProofEntry |
| `utils/decimals.ts` | ✅ Done | formatMoney, bps helpers |
| `utils/health.ts` | ✅ Done | protection floor, runway |
| `app/dashboard/_components/` | ✅ Done | live chain data, HealthRing, OraclePanel, PositionStats |
| `app/vault/_components/` | ✅ Done | read-only policy, reserve, borrower pill |
| `app/proof/_components/` | ✅ Done | reads `proof-archive.json`, backend mode uses `/api/events` |
| `docs/evidence/proof-archive.json` | ✅ Done | real executionIds, real tx hashes, no fabrications |
| `services/evidenceArchive.ts` | ✅ Done | sync static + async live (`readProofArchiveLive`) |
| 53 tests | ✅ Green | `pnpm test` passes |
| Type check | ✅ Clean | `pnpm type-check` zero errors |

---

## 1. What is still missing or broken

Ordered by impact. Items marked **🔴 MUST** block submission. Items marked **🟡 SHOULD** matter for the demo video. Items marked **⚪ NICE** can be cut if time runs out.

---

### 1.1 🔴 MUST — `chain-snapshot.json` is stale

**File:** `frontend/docs/evidence/chain-snapshot.json`

Current content was committed before the prove runs. The vault's `outstanding` and `reserve` have changed. Dashboard will show committed snapshot values when the RPC is unreachable (which happens during judging).

**Fix:** after the final prove run before submission, regenerate this file.

```bash
# Run this from repo root after pnpm dev:server is running:
curl http://localhost:3001/api/position | node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const d = JSON.parse(Buffer.concat(chunks).toString());
  console.log(JSON.stringify({
    vault: d.vault,
    blockNumber: d.blockNumber,
    position: d.position,
    guardRepayQuote: d.guardRepayQuote,
    couponDue: d.couponDue,
    healthRatioBps: d.healthRatioBps,
    liquidationBps: d.liquidationBps,
    maxStaleSeconds: d.maxStaleSeconds,
    oracle: d.oracle,
    tokens: d.tokens
  }, null, 2));
}" > frontend/docs/evidence/chain-snapshot.json
```

Or ask alven to run `cast call` once more and paste the values.

**Acceptance:** `chain-snapshot.json` contains `lastActedRound` > 0 and `outstanding` matching the latest prove run.

---

### 1.2 🔴 MUST — `proof-archive.json` needs entries from the demo vault

**File:** `frontend/docs/evidence/proof-archive.json`

Current entries all point to the rehearsal vault `0x8E11A9a4...`. The prove runs tonight produced real execution records on the **demo vault** `0x4f634d71...`. Add at least the refusal and rescue from tonight's prove run so the proof page shows evidence from the vault a judge will inspect.

New entries to add (from `docs/evidence/prove-run-2026-08-11T15-47-41-190Z.json`):

```json
{
  "id": "refused-healthy-demo",
  "rank": 6,
  "title": "The agent is refused on the live demo vault",
  "claim": "The demo vault (never defended before) refuses guardRepay while the position is healthy.",
  "caller": "0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3",
  "callerRole": "agentExecutor",
  "target": "0x4f634d7173eFf255973E762c3Fe04DF4887FfB35",
  "targetLabel": "demo vault",
  "kind": "execution-record",
  "contractError": "Refused_Healthy(19497, 13000)",
  "executionId": "<executionId from prove-run JSON step 2>",
  "transactionLink": null,
  "receiptStatus": "reverted",
  "blockNumber": null,
  "gasUsed": null,
  "isSponsored": true,
  "reading": "The demo vault has never been defended. The contract re-reads the oracle in the same transaction and refuses while the ratio is above the trigger."
}
```

Pull the real `executionId` from `docs/evidence/prove-run-2026-08-11T15-47-41-190Z.json` step 2.

**Acceptance:** proof-archive has ≥1 entry with `targetLabel: "demo vault"` and a real `executionId`.

---

### 1.3 🔴 MUST — `SNAPSHOT_NOTICE` copy must be accurate

**File:** `frontend/src/constants/copy.ts`

Check that `SNAPSHOT_NOTICE` says something like:
> "Live data unavailable. Showing a snapshot taken at block N."

and NOT something that implies the demo is live when it is serving committed snapshot.

Also verify `REHEARSAL_DISCLOSURE` text is present and says clearly that the successful defence ran on the rehearsal vault.

**Acceptance:** `pnpm test` includes copy tests that assert no banned claims. Check `copy.test.ts` passes.

---

### 1.4 🔴 MUST — backend CORS for production URL

**File:** `backend/src/index.ts`

`ALLOWED_ORIGIN` defaults to `http://localhost:3000`. If the frontend is deployed to Vercel for judging, CORS will block all API calls and the frontend silently falls back to snapshot mode.

**Fix:** set `ALLOWED_ORIGIN=https://defral.vercel.app` (or whatever the Vercel URL is) in backend `.env` before deploying. Also add `*` fallback or multiple origins if needed.

**Acceptance:** dashboard shows `source: 'chain'` (no committed snapshot banner) when opened from the production URL.

---

### 1.5 🟡 SHOULD — `AgentPosture` "oracle-stale" state has no UI copy

**File:** `frontend/src/app/dashboard/_components/oracle-panel.tsx`

The oracle is currently stale after every prove run (price was pushed low and restored, but `updatedAt` lags). The dashboard may show `oracle-stale` posture.

Per plan v2 §5.6 and PRD §11:
> "The last price is N minutes old. Above one hour the contract refuses to act at all, by design." — amber, not red.

Check `OraclePanel` renders this state clearly.

**Acceptance:** when `ageSeconds > maxStaleSeconds`, the panel shows an amber notice explaining the staleness is a designed safety gate, not a defect.

---

### 1.6 🟡 SHOULD — `OutcomeComparison` on landing uses invented data

**File:** `frontend/src/app/(landing)/_components/container.tsx`

Currently reads `readProofArchive().filter(entry => MINED_TRANSACTION_IDS.includes(entry.id))` where `MINED_TRANSACTION_IDS = ['guard-repay-success', 'not-agent']`.

Both of those entries ARE real (not fabricated) — this is fine. But the `OutcomeComparison` component may have hardcoded liquidation numbers that don't match the chain.

Check `outcome-comparison.tsx` for any hardcoded numbers.

**Acceptance:** landing page outcome comparison numbers match the canonical values: repaid 758.62, health 12667→14500, target 14500.

---

### 1.7 🟡 SHOULD — dashboard shows `blockNumber` from snapshot banner

**File:** `frontend/src/app/dashboard/_components/container.tsx`

When `snapshot.source === 'committed-snapshot'`, the banner shows `Block {snapshot.blockNumber?.toString()}`. If `blockNumber` is `undefined` (which it will be after the stale snapshot is replaced), the banner reads "Block undefined".

**Fix:** render "Block N" only if `blockNumber` is defined, else "an earlier block".

```tsx
{snapshot.source === 'committed-snapshot' ? (
  <p>...{SNAPSHOT_NOTICE} {snapshot.blockNumber ? `Block ${snapshot.blockNumber.toString()}.` : 'an earlier block.'}</p>
) : null}
```

**Acceptance:** no "Block undefined" visible in any state.

---

### 1.8 🟡 SHOULD — `revalidate = 30` on `/dashboard` and `/vault` is correct but needs `NEXT_PUBLIC_RPC_URL`

**File:** `frontend/.env`

Currently:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Missing:
```
NEXT_PUBLIC_RPC_URL=https://base-sepolia-rpc.publicnode.com
```

Without this, `client.ts` falls back to the default `https://sepolia.base.org` which was down earlier tonight. Add it to `frontend/.env`.

**Acceptance:** `pnpm type-check` passes and `loadVaultSnapshot()` uses publicnode RPC.

---

### 1.9 ⚪ NICE — `/connect` and `/onboarding` routes still show fake mutation UI

**Files:** `frontend/src/app/connect/`, `frontend/src/app/onboarding/`

Per plan v2 §5.8 and conflict C5: these routes should become read-only explainers. They carry no argument for the submission — cut the fake state mutation, replace with honest copy about what a borrower does.

If time is short, leave them as-is. They don't appear in the demo video.

**Acceptance:** no `onClick` on these pages performs a state change.

---

### 1.10 ⚪ NICE — `PROVENANCE.md` real-versus-mock table needs update

**File:** `docs/PROVENANCE.md`

Per plan v2 §9: rewrite the real-versus-mock table — contracts are live, defence is on rehearsal vault, refusals are execution records.

Low priority — judges read README first.

---

## 2. Execution order for Rabu 12 Agt

**Pagi (09:00–12:00) — bima:**

1. `pnpm dev:server` + `pnpm dev` — confirm dashboard shows live data
2. Fix `chain-snapshot.json` (§1.1) — regenerate from backend
3. Add demo vault entry to `proof-archive.json` (§1.2)
4. Fix `SNAPSHOT_NOTICE` / `REHEARSAL_DISCLOSURE` copy if needed (§1.3)
5. Add `NEXT_PUBLIC_RPC_URL` to `frontend/.env` (§1.8)
6. Fix `blockNumber` undefined guard (§1.7)
7. `pnpm test && pnpm type-check && pnpm build` — confirm all green

**Siang (12:00–15:00) — bima:**

8. Record demo video — shot list below (§3)
9. Check `OutcomeComparison` numbers (§1.6)
10. Check `OraclePanel` oracle-stale copy (§1.5)

**Sebelum submit — semua:**

11. Set `ALLOWED_ORIGIN` for production (§1.4)
12. Final `pnpm prove` — regenerate evidence
13. Commit all evidence + snapshot

---

## 3. Demo video shot list

Every claim must have a BaseScan link or execution record within 10 seconds.

| Beat | Screen | Evidence |
|---|---|---|
| 0:00–0:30 | Dashboard — health 16667 (or current), position details | Live data, source: chain |
| 0:30–1:00 | Vault page — reserve, trigger 130%, target 145%, agent armed | Live policy |
| 1:00–1:30 | alven pushes NAV down via `cast send` (terminal on screen) | tx hash printed |
| 1:30–2:00 | Dashboard refreshes — health drops below 13000, posture "would-defend" | Live data |
| 2:00–2:30 | Agent log fires guardRepay automatically | Terminal output |
| 2:30–3:00 | BaseScan — Rescued event, Logs tab, amount = quote exactly | BaseScan tx |
| 3:00–3:30 | Proof page — NotAgent tx first, then rescue, then refusals | /proof route |
| 3:30–4:00 | BaseScan — agent EOA token tab, dUSD balance = 0 | BaseScan token tab |
| 4:00–4:15 | `/docs` (Scalar) — show API reference | http://localhost:3001/docs |

**Rules:**
- Never show UI without a matching chain artifact within 10 seconds
- Never show the rehearsal vault without labelling it as rehearsal
- Never show a "View on BaseScan" button for a refusal/execution record
- If oracle is stale during recording, show the amber state and narrate: "this is the freshness gate working"

---

## 4. Definition of done (checklist before submission)

- [ ] `chain-snapshot.json` has `lastActedRound > 0` and real current outstanding
- [ ] `proof-archive.json` has ≥1 entry with `targetLabel: "demo vault"`
- [ ] Dashboard shows `source: 'chain'` when backend is running
- [ ] `SNAPSHOT_NOTICE` and `REHEARSAL_DISCLOSURE` copy accurate
- [ ] No "Block undefined" in snapshot banner
- [ ] `NEXT_PUBLIC_RPC_URL=https://base-sepolia-rpc.publicnode.com` in `frontend/.env`
- [ ] `pnpm test` 53/53 green
- [ ] `pnpm type-check` zero errors
- [ ] `pnpm build` succeeds
- [ ] Demo video recorded, every claim has BaseScan link within 10 seconds
- [ ] `docs/evidence/prove-run-<latest>.json` committed
- [ ] Repo public, clean clone passes `pnpm test`

---

## 5. Cut list (in order, if time runs out)

1. `/onboarding` and `/connect` cleanup (§1.9)
2. `PROVENANCE.md` rewrite (§1.10)
3. Oracle-stale amber copy polish (§1.5)
4. Outcome comparison numbers check (§1.6)

**Never cut:** capability matrix, proof page, chain-snapshot refresh, CORS config.

---

## 6. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| RPC down during video recording | Medium — happened tonight | Use `base-sepolia-rpc.publicnode.com`. Have snapshot fallback visibly ready |
| Oracle stale during recording | High — happens after every price push | alven pushes fresh NAV immediately before recording. UI shows amber state either way |
| Demo vault outstanding keeps dropping from prove runs | Medium | Use `LEDGER=mock` for agent during recording. Only fire real KH calls for evidence |
| BaseScan slow during recording | Low | Pre-open tabs. Use screenshots as backup |
| judge spots rehearsal vs demo vault mismatch | High | Say it first on both /dashboard and /proof. Already in `REHEARSAL_DISCLOSURE` |

---

*Written 2026-08-12 00:11 WIB. Supersedes plan v2 for remaining work.*  
*Plan v2 items that are already done: §5.1, §5.2, §5.3, §5.4, §5.5, §5.7. Do not re-do them.*
