# FE Plan v2 — wiring the live contracts

**Defral · KeeperHub Agents Onchain Hackathon · deadline 2026-08-13 17:00 WIB**
**Written 2026-08-11, after the contracts went live. Supersedes plan v1.**

> Authority order, highest first:
> 1. `infoFromContracttoFE.md` (read off the chain on 2026-08-11)
> 2. `../prd/PRD-defral.md` for behaviour and limits
> 3. plan v1 (this file's predecessor) for anything neither covers
> 4. `../rules/rules.template.md` governs HOW every line is written, always
>
> Where they disagree, the higher one wins and this document records the resolution. No one picks for themselves mid-task.

---

## 0. What changed, and why this rewrite exists

Plan v1 was written when no contract existed. Everything the UI shows today comes from fixtures I invented. Nine contracts are now live and verified, so most of plan v1's frontend assumptions are now false.

Three of those assumptions are not merely stale, they are actively dangerous:

| Plan v1 said | Reality | Consequence if shipped |
|---|---|---|
| Compute health and repay in `utils/health.ts` and render it | The contract exposes `healthRatioBps()` and `quoteGuardRepay()` | JS floats round differently. v1 renders 12666 where the chain says 12667. A judge comparing the UI to BaseScan sees us off by one |
| Every Capability Matrix refusal row carries a reverted transaction link | KeeperHub refuses to broadcast a call it predicts will revert. Refusals have **no transaction at all** | Four rows link to nothing. The matrix is the centrepiece of the submission |
| `frontend/docs/evidence/*.json` is our proof archive | I wrote those files by hand. The executionIds, gas figures and idempotency keys in them are **invented** | We would be presenting fabricated evidence as proof. This must be deleted before anything else |

That last row is the reason this rewrite is not optional.

---

## 1. Facts, read from the chain

Every number below was read with `cast` against Base Sepolia on 2026-08-11. Nothing here is from a document.

### 1.1 Addresses

| Role | Address |
|---|---|
| DefralVault (demo) | `0x4f634d7173eFf255973E762c3Fe04DF4887FfB35` |
| MockLendingPool | `0x35371eD6E29ddE1fDE4DBe8A6048fFb0C860b9eD` |
| NavOracle (dUST) | `0x44B94bb593F6De51Ad3385264C0168eEc8E56392` |
| MockUSD (dUSD) | `0x9D9734fBb490b603A27f82ec0e23cDfDD9D6b838` |
| MockTreasury (dUST) | `0x0A72124d5e606aB4264a653B6942738CBAbd2D43` |
| borrower (demo) | `0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2` |
| agentExecutor | `0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3` |

Vault `0x8E11A9a4...` is the rehearsal rig. Its agent is permanently revoked. **Never render it as the demo position.** It appears in this UI exactly once, on the proof page, labelled as the rehearsal vault (see §1.4).

### 1.2 Live demo vault state

`getPosition()` returns one tuple. One call, one render. Never eight separate reads.

| Field | Raw | Decimals | Displays as |
|---|---|---|---|
| `borrower` | `0x0a25a241...` | | `0x0a25...c7f2` |
| `outstanding` | `6000000000` | 6 | 6,000.00 dUSD |
| `collateralAmount` | `10000000000000000000000` | 18 | 10,000 dUST |
| `triggerBps` | `13000` | bps | 130.00% |
| `targetBps` | `14500` | bps | 145.00% |
| `maxRepayPerEvent` | `2000000000` | 6 | 2,000.00 dUSD |
| `couponSweep` | `true` | | enabled |
| `reserve` | `3000000000` | 6 | 3,000.00 dUSD |
| `lastActedRound` | `0` | | never acted |
| `revoked` | `false` | | armed |

Other live reads:

| Call | Value | Meaning for the UI |
|---|---|---|
| `healthRatioBps()` | `16667` | 166.67%, healthy |
| `quoteGuardRepay()` | `0` | nothing to pay. **Render as "nothing to pay", never as an error** |
| `amountToReachTarget()` | `0` | same |
| `couponDue()` | `112500000` | 112.50 dUSD accrued and unswept |
| `MIN_TRIGGER_BPS` / `MAX_TRIGGER_BPS` | `12000` / `15000` | slider bounds if a write path is ever added |
| `MAX_STALE()` | `3600` | oracle older than one hour is refused |
| `pool.LIQUIDATION_BPS()` | `11000` | the liquidation line in the defence window |
| oracle `latestRoundData()` | round `3`, price `100000000`, updatedAt `1786384066` | $1.00 at 8 decimals |
| oracle `decimals()` | `8` | never hardcode this |

### 1.3 Decimals, the single most likely way to ship a wrong number

```
dUSD  (outstanding, reserve, coupon, repay quote)   6
dUST  (collateral)                                 18
oracle price                                        8
health, trigger, target, liquidation           basis points (divide by 100 for percent)
```

`6000000000` is six thousand, not six billion. Every one of these is read from the contract (`decimals()`), never written as a literal.

### 1.4 The demo vault has never been defended

This is the most important thing in this document and it is easy to miss.

`lastActedRound = 0` on the demo vault. The successful defence, transaction `0xb8f47a89...`, happened on the **rehearsal** vault. `guardRepay()` permanently lowers debt and `openPosition` reverts with `LoanAlreadyExists`, so the demo position could not be rehearsed without burning it.

So the dashboard will show a healthy, never-defended position, while the proof page shows a successful defence at a different address. **The UI must say so plainly.** If a judge notices the address differs and we have not said it first, we look like we are hiding it. If we say it first, it reads as rigour.

Copy for this, on both surfaces:

> The defence below ran on an identical rehearsal position. Defending the demo position would permanently lower its debt, and it can only be opened once, so we kept it untouched for you to inspect.

### 1.5 Live blocker: the oracle is stale right now

`updatedAt` is 28,740 seconds old against a `MAX_STALE` of 3,600. Reads are unaffected, but `guardRepay()` would refuse with `Refused_StaleOracle` at this moment.

Two consequences, both must be handled:

1. **Product:** oracle freshness is a real UI state, not an edge case. Design it (§5.6).
2. **Logistics:** alven must push a fresh NAV immediately before the video is recorded, and again before judging opens. This belongs on the run sheet, not in code.

---

## 2. Conflicts, resolved

Recorded so no one relitigates them mid-task.

| # | Conflict | Resolution | Why |
|---|---|---|---|
| C1 | v1 §1.3 makes `utils/health.ts` the source of displayed numbers. SC doc §4a forbids recomputing | **Chain wins.** `healthRatioBps()` and `quoteGuardRepay()` are read, never derived | Requirement D2 demands contract, agent and UI show identical figures. Proven on chain to the unit |
| C2 | v1 §K4 says revive `setGuardTrigger` and the sweep toggle. SC doc §7 says the FE never writes | **Read-only wins.** Both render live on-chain policy, with no control that pretends to write | No wallet integration exists and the deadline is in two days. A control that looks live and does nothing is exactly the bug K4 was written about |
| C3 | v1 §4.1 wants a reverted transaction link on refusal rows | **Execution records instead.** Render the contract's own decoded error with its live arguments | KeeperHub will not broadcast a doomed call. There is no transaction to link. Confirmed on three independent paths |
| C4 | v1 §K5 wants a second collateral, mXAU | **Cut.** Only dUST is deployed | Rendering a collateral that does not exist is the same lie as a fabricated transaction |
| C5 | v1 Goal 2 wants a complete borrower path with no terminal | **Reduced to a read-only explainer.** No fake mutation | Same reason as C2 |
| C6 | v1 §1.3 signatures use `number`. Chain returns `bigint` at three different scales | **`bigint` end to end.** Convert to string for display only at the render boundary | Float cannot hold `10000e18`. This is how the off-by-one in C1 happens |
| C7 | v1 says stack is Vite, React 19, Tailwind 4 | **Next.js App Router, React 18, Tailwind 3**, already built and shipped | It is what exists and it is green in CI |

Two rules from the SC doc that are not conflicts but are binding, repeated here so they are not lost:

- **Never claim we cannot export the agent key.** KeeperHub documents that an org owner can (`canExportKey: true`). The correct and stronger framing: the owner can export it, and it changes nothing, because the vault accepts exactly two zero-argument calls that re-read the oracle in the same transaction and refuse while the position is healthy.
- **`couponDue()` of zero is correct**, not a fault. `Refused_NoCouponDue` is the system working. Never render it red. (Today it is 112.50, so the sweep is genuinely available.)

---

## 3. Delete first

Nothing new gets built on top of invented data.

| Path | Action |
|---|---|
| `frontend/docs/evidence/executions.json` | **Delete.** Every executionId, gas figure and idempotency key in it is fabricated |
| `frontend/docs/evidence/outcomes.json` | **Delete.** Same |
| `src/services/mockData.ts` | **Replace** with a snapshot of real chain state (§5.2). Current values contradict the chain: reserve 741.38 against a real 3,000.00, maxRepay 1,500 against a real 2,000 |
| `src/constants/capabilities.ts` | **Rewrite.** All eight rows currently say `awaiting deployment`. The contracts are deployed |
| mXAU in mock data, and the collateral switch | **Remove** (C4) |
| `PROVENANCE.md` real-versus-mock table | **Rewrite.** It says "contracts not deployed" |

---

## 4. Architecture

Current structure stays. It is green in CI and matches `rules.template.md` §3. New code slots in as follows.

```
src/
├── app/
│   ├── (landing)/_components/    unchanged shape, real evidence
│   ├── dashboard/_components/    now fed by chain reads
│   ├── proof/_components/        now fed by the real archive
│   └── vault/_components/        becomes read-only policy display
├── components/ui/                unchanged
├── constants/
│   ├── contracts.ts              NEW addresses and decimals, one source
│   └── capabilities.ts           rewritten against real evidence
├── services/
│   ├── chain/
│   │   ├── client.ts             NEW viem public client
│   │   ├── vaultReads.ts         NEW getPosition, quote, coupon, oracle via multicall
│   │   └── snapshot.ts           NEW committed fallback for the parachute
│   └── evidenceArchive.ts        repointed at the real files
├── types/                        bigint-based position types
└── utils/
    ├── decimals.ts               NEW formatUnits wrappers, bps helpers
    └── health.ts                 REDUCED, see §5.5
```

### Rendering and caching, decided per route

`rules.template.md` §8 requires a deliberate choice per route and §9 requires explicit caching intent.

| Route | Strategy | Why |
|---|---|---|
| `/` landing | Static | Capability matrix and defence window are the same for everyone |
| `/proof` | Static | Reads committed JSON. Must survive KeeperHub losing its logs |
| `/dashboard` | Server Component, `export const revalidate = 30` | Live chain data, but a judge refreshing must not hammer the public RPC |
| `/vault` | Server Component, `export const revalidate = 30` | Same data, policy view |

Chain reads happen in Server Components. No `'use client'` above a leaf. No secret reaches the browser, and the RPC URL is the only environment variable, safely public.

---

## 5. Work packages

Each has acceptance criteria. Each ends green on `lint`, `type-check`, `test`, `build`, because the pre-commit hook runs all four.

### 5.1 Chain access layer

- Add `viem`. Copy `docs/abi/*.json` into `frontend/docs/abi/`, **stripping the UTF-8 BOM** (the source files have one and `JSON.parse` rejects it).
- `constants/contracts.ts`: addresses, chain id 84532, explorer base URL, token decimals. One source, so a mainnet move is one file (v1 §8.17).
- `services/chain/client.ts`: viem public client, `NEXT_PUBLIC_RPC_URL` with the public Base Sepolia endpoint as default.
- `services/chain/vaultReads.ts`: one `multicall` returning position, `quoteGuardRepay`, `couponDue`, `healthRatioBps`, oracle `latestRoundData` and `decimals`.

**Acceptance:** one network round trip renders the dashboard. Reading the demo vault yields exactly the §1.2 table. A unit test asserts the decoder maps the ten-field tuple to named fields in the right order.

### 5.2 Snapshot parachute

The parachute survives, but it stops being fiction.

- A script reads the live vault and writes `services/chain/snapshot.ts` with the real values and the block number and timestamp they were read at.
- The UI falls back to the snapshot when the RPC fails, and says so: "Showing a snapshot taken at block N. The live node did not answer."

**Acceptance:** with the RPC unreachable, every screen still tells the whole story and is visibly labelled as a snapshot. Judging runs days after the demo; a dead public RPC must not take the submission down.

### 5.3 Capability Matrix against real evidence

Evidence becomes a three-way union. The `pending` variant is deleted.

```ts
type CapabilityEvidence =
  | { kind: 'transaction'; transactionLink: string; receiptStatus: ReceiptStatus }
  | { kind: 'execution-record'; executionId: string; contractError: string }
  | { kind: 'absent-from-abi'; statement: string }
```

Eight rows, each mapped to evidence that actually exists:

| Row | Answer | Evidence |
|---|---|---|
| Read your health ratio | YES | live read, rendered inline |
| Repay while unhealthy | YES | transaction `0xb8f47a89...`, marked rehearsal vault |
| Repay while healthy | NEVER | execution record `yjh4l0m4d9jgy7qtt6g6r`, `Refused_Healthy(16667, 13000)` |
| Act twice in one round | NEVER | execution record `fh8e4y796hirzz6woa0pj`, `Refused_AlreadyActed(2)` |
| Sweep with no coupon due | NEVER | execution record `1ewhomgsu2j8grqchsule`, `Refused_NoCouponDue` |
| Act after revoke | NEVER | rehearsal vault, agent permanently revoked, `Refused_AgentRevoked` |
| Be called by anyone else | NEVER | transaction `0xb6a01688...`, `NotAgent`, called by the system deployer |
| Withdraw your reserve | NEVER | absent from the ABI, verified against the committed ABI |

**No refusal row renders a BaseScan button.** A refusal shows the contract's own error name with its live arguments, and a line saying KeeperHub declined to broadcast a call it predicted would revert.

**Acceptance:** a test asserts every row carries evidence, that no `execution-record` row carries a link, and that the `NotAgent` row is present. The union makes an empty row fail type-check.

### 5.4 Proof page

Rebuilt from the real archive at `docs/evidence/`.

Order matters. The `NotAgent` transaction goes **first**: the caller deployed every contract, owns the pool and holds every admin key, and the vault still refused. That is the strongest artifact in the repository.

Then the successful defence, then the three refusal records, each with its decoded error, then the honest-limit note that these are execution records rather than mined transactions.

**Acceptance:** page is static, reads committed JSON, and works with the network off. Zero fabricated identifiers. Every field on screen traces to a file in `docs/evidence/`.

### 5.5 Dashboard on live data

- Health ratio, repay quote, coupon due, reserve, debt and collateral all come from the chain, formatted by decimals.
- `quoteGuardRepay() === 0n` renders "Nothing to pay. The position is healthy." It is not an error and gets no red.
- `utils/health.ts` is reduced. `computeHealthRatioBps` and `computeGuardRepay` are **deleted from the render path**, because the chain provides both. What survives is the protection floor and runway, which have no on-chain equivalent, rewritten in `bigint`, kept pure and kept tested. Their tests stay as the regression net for the demo numbers.
- The defence window diagram uses live `triggerBps` and the pool's `LIQUIDATION_BPS`, not constants.

**Acceptance:** the dashboard renders 166.67%, 6,000.00 dUSD debt, 3,000.00 dUSD reserve and 112.50 dUSD coupon due, matching §1.2 to the unit. No float arithmetic anywhere between the RPC and the screen.

### 5.6 The four states, plus oracle freshness

`rules.template.md` §12 requires loading, error, empty and success on every async surface. Chain data adds a fifth that is genuinely ours:

| State | Screen shows |
|---|---|
| Loading | Skeleton, never a bare spinner |
| Error | Snapshot fallback, labelled, with a retry |
| Healthy | "Nothing to pay", the agent is armed and idle |
| Defending | The live quote and what it restores the ratio to |
| **Oracle stale** | "The last price is N minutes old. Above one hour the contract refuses to act at all, by design." Amber, not red |

The stale state is not a defect to hide. It is the freshness gate doing its job, and it is one more thing the contract refuses.

### 5.7 Vault route becomes read-only

Policy values render live from `policy()`: trigger, target, max repay per event, sweep flag, revoked flag. The reserve is shown with the sentence that makes it non-custodial: the reserve is `min(balance, allowance)`, it sits in the borrower wallet, and lowering the approval is how it comes back.

Every write control is removed rather than disabled. A greyed-out control still implies the feature exists.

**Acceptance:** no `onClick` on the page performs a state change. The trigger bounds 12000 and 15000 are read from the contract, not typed in.

### 5.8 Landing, connect and onboarding

- Landing keeps hero, capability matrix, defence window. The outcome comparison loses its invented liquidation side and becomes the real pair: the successful defence, and the deployer being refused.
- `/connect` and `/onboarding` lose their fake state mutation and become one honest explainer of what a borrower does, driven by live policy values. If time runs short, these two routes are the first thing cut. They carry no argument.

### 5.9 Copy and documentation

- Purge the "we never hold the key" framing. Replace with the export framing from §2.
- Rewrite the `PROVENANCE.md` real-versus-mock table: contracts are live, the demo position is real and unrehearsed, the defence transaction is on the rehearsal vault, refusals are execution records rather than transactions.
- Keep the grace period sentence, first person, on the chart.
- Existing copy tests stay and keep enforcing no banned claim and no em dash.

---

## 6. Testing

Per `rules.template.md` §15, behaviour over internals.

| Test | Guards against |
|---|---|
| Tuple decoder maps ten fields in order | A silent field-order swap showing reserve as debt |
| Decimal formatting at 6, 18 and 8 | The single most likely wrong number on screen |
| bps to percent | 16667 rendering as 1.6667% |
| `quoteGuardRepay` of zero renders as text, not an error | Red on a healthy position |
| Every capability row carries evidence | An empty cell in the centrepiece |
| No `execution-record` row carries a transaction link | Linking to a transaction that does not exist |
| Committed archive parses and has no null executionId | A fabricated entry creeping back |
| Copy has no banned claim and no em dash | Losing a judge on a sentence |
| Snapshot fallback renders every screen | A dead RPC during judging |

---

## 7. Sequence

Today is 2026-08-11. Video records 08-12. Deadline 08-13 17:00 WIB.

**Block 1, must land today, in order:**
1. §3 delete the fabricated evidence
2. §5.1 chain access layer
3. §5.5 dashboard on live data
4. §5.3 capability matrix on real evidence
5. §5.4 proof page

**Block 2, today if it holds:**
6. §5.6 states including oracle freshness
7. §5.2 snapshot parachute
8. §5.7 vault read-only

**Block 3, 08-12 morning:**
9. §5.8 landing and the outcome pair
10. §5.9 copy and provenance

**Cut list, in this order, if time runs out:** `/onboarding`, `/connect`, the snapshot parachute, the outcome comparison. Never cut the capability matrix or the proof page. Those carry the argument.

---

## 8. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Oracle stale during recording or judging | **Happening right now** | alven pushes NAV before recording and before judging. UI degrades honestly either way (§5.6) |
| Public Base Sepolia RPC rate limits under judging traffic | Medium | `revalidate = 30` caches server side. Snapshot parachute on failure |
| Judge spots the defence is on a different vault | High, and reasonable of them | We say it first, on both surfaces (§1.4) |
| Float creeps back in and shifts a digit | Medium | `bigint` end to end, plus the decimal tests |
| A fabricated identifier survives the purge | Low, high damage | Test asserts every archive entry traces to `docs/evidence/` |

---

## 9. Definition of done

- [ ] Zero fabricated identifiers anywhere in the repository
- [ ] Every number on screen read from the chain or from a committed real artifact
- [ ] `quoteGuardRepay` of zero reads as "nothing to pay", never as an error
- [ ] No refusal row offers a BaseScan link
- [ ] The `NotAgent` transaction is the first item on the proof page
- [ ] The rehearsal vault is disclosed on both the dashboard and the proof page
- [ ] Oracle staleness is a designed state, in amber
- [ ] No control implies a write the frontend cannot perform
- [ ] Decimals read from the contract, never hardcoded
- [ ] `bigint` from RPC to the render boundary
- [ ] No banned claim, no em dash, enforced by test
- [ ] `lint`, `type-check`, `test`, `build` green, CI green on main
- [ ] `PROVENANCE.md` real-versus-mock table matches reality

---

## 10. Open question for alven

One only. Everything else in `infoFromContracttoFE.md` was clear enough to build from.

**Can the demo vault get a NAV drop during the recording window, or does it stay healthy?** It changes what the dashboard shows in the video. If it stays healthy, the video's rescue beat has to come from the rehearsal vault's transaction, and we narrate the demo vault as the untouched position a judge can verify. Both work, but the shot list differs and we should not discover that while recording.
