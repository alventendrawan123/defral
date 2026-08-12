# Frontend context handoff

**Written 2026-08-12 · deadline 2026-08-13 17:00 WIB**

Read this before touching frontend code. It records what is true right now, what
is deliberately the way it is, and the traps that already cost time once.

Reading order for a new agent:
1. this file
2. `../rules/rules.template.md` (binding, governs how every line is written)
3. `infoFromContracttoFE.md` (what the contracts expose)
4. `plan.md` (v2, the conflict resolutions in §2 are still binding)
5. `plan-v3.md` (the fix list this session was working through)

---

## 1. State right now

Everything below is committed and pushed to `main`. Working tree clean.

| Item | Status |
|---|---|
| FIX-2 regenerate `chain-snapshot.json` | done |
| FIX-4 demo vault entries in `proof-archive.json` | done |
| Posture bug (`quoteGuardRepay` zero was read as healthy) | fixed |
| `REHEARSAL_DISCLOSURE` copy corrected | done |
| FIX-CORS | **closed as not needed**, see §5 |
| Provenance real versus mock table | corrected |
| `protocol.ts` dead constants | pruned, liquidation line now from the pool |
| `lint` / `type-check` / `test` | green, 60 tests |
| `next build` | **not run locally**, see §4 |

---

## 2. The chain moved, and it matters

The demo vault is no longer the untouched position the earlier docs describe.
Read live on 2026-08-12:

| Field | Value | Meaning |
|---|---|---|
| `outstanding` | `2887500000` | 2,887.50 dUSD, down from the 6,000.00 opening |
| `reserve` | `0` | **spent, the agent has nothing left to defend with** |
| `lastActedRound` | `16` | it has been defended for real |
| `healthRatioBps` | `12849` | **below the 13000 trigger** |
| `quoteGuardRepay()` | `0` | zero because the reserve is empty, not because it is healthy |
| `couponDue()` | `0` | correct, nothing accrued. Never render this red |
| oracle | round 16, price `37100519` (8dp, $0.371) | ~10h old against `MAX_STALE` 3600 |

Two consequences that are easy to get wrong:

**`quoteGuardRepay()` returning zero is ambiguous.** It means "healthy, nothing
needed" *or* "reserve empty, nothing possible". Those are opposite stories. The
posture resolver now distinguishes them by comparing health against the trigger
(`resolveAgentPosture` in `services/chain/vaultSnapshot.ts`, posture
`reserve-exhausted`). If you touch that logic, keep the distinction. Claiming a
position is healthy while it sits under its own trigger is the single most
damaging thing this UI could say in front of a judge.

**The rehearsal disclosure changed.** The old copy said the demo position was
left untouched. That is now false. `REHEARSAL_DISCLOSURE` was rewritten and
`proof-archive.json` gained two demo vault entries so the claim is backed.

---

## 3. Traps that already cost time

| Trap | What happens | Do this instead |
|---|---|---|
| `rm -rf .next` while `next dev` runs | Dev server 404s on every route until restarted | Never delete `.next`. If the build must be verified, stop dev first |
| `next build` sharing `.next` with a running dev server | Same 404 breakage | Let CI verify the build, or stop dev first |
| `getPosition()` decoded as an array | viem returns a **named object**, not a tuple. Positional indexing gives `undefined` and the build fails during prerender | `toVaultPosition` takes the object. Its test fixture must use the object shape, or the test encodes the wrong contract |
| ABI files in `docs/abi/*.json` | They carry a UTF-8 BOM and `JSON.parse` rejects it | The copies in `frontend/docs/abi/` are BOM stripped. Regenerate the same way |
| Tests pinned to `chain-snapshot.json` | Regenerating the snapshot broke 4 tests | `health.test.ts` now uses a frozen inline fixture. Keep it that way |
| Every execution record treated as a refusal | A successful sponsored execution also has an `executionId` and no transaction link | Assert `contractError` only on `receiptStatus === 'reverted'` |
| husky hooks | Run with `sh -e`, and git gives them a minimal PATH with no `bun` | Hooks call `node_modules/.bin/*` directly. A bare `grep` that matches nothing returns 1 and kills the hook, so append `|| true` |
| Pushing workflow files | Needs the `workflow` scope, and `osxkeychain` answers before an inline helper | `git -c credential.helper= -c credential.helper='!f(){...}' push` |

---

## 4. Binding decisions, do not silently reverse

From `plan.md` §2, still in force:

- **Never recompute what the contract exposes.** `healthRatioBps()` and
  `quoteGuardRepay()` are read, never derived. JS floats round differently and
  produce 12666 where the chain says 12667. Requirement D2 demands they match.
- **`bigint` from the RPC to the render boundary.** Float cannot hold `10000e18`.
- **Decimals come from the contracts**, never literals. `dUSD` is 6 and `dUST`
  is 18 today; the UI must not assume it. There is a test that fails if a
  hardcoded scale reappears.
- **The frontend never writes to the contracts.** No wallet integration. Write
  controls were removed rather than disabled, because a greyed out control still
  implies the feature exists.
- **Agent refusals have no transaction.** KeeperHub declines to broadcast a call
  it predicts will revert. Refusal rows render the decoded custom error and its
  `executionId`, and must never offer a BaseScan link. Tests enforce this.
- **Never claim the agent key cannot be exported.** The org owner can. The
  stronger and true framing is in `AGENT_KEY_FRAMING`.
- **No em dash anywhere**, and no banned privacy term in user facing copy. Both
  are enforced by `constants/copy.test.ts`.
- mXAU and the second collateral are cut. Only dUST is deployed.

---

## 5. Still open

**FIX-CORS is closed as not needed.** CORS never applied here. Every backend
fetch runs inside an async Server Component, so it is a Node side fetch with no
browser origin check. The only client components are `error.tsx`,
`global-error.tsx` and `NavBar.tsx`, and none of them fetch.

Two things surfaced while checking it, both still open:

- **`backend/.env` does not exist.** The backend loads `dotenv/config`, which
  reads `.env`, but only `.env.local` and `.env.example` are present, so it runs
  on defaults (`backend/src/index.ts:49`). Putting anything in `.env.local`
  alone silently does nothing.
- **The real deployment risk is reachability, not CORS.** If the frontend goes
  to Vercel while the backend stays on `localhost:3001`, the Vercel server
  cannot reach it. The fetch fails, falls through to direct RPC, then to the
  committed snapshot, silently and with no error. The backend needs a public URL
  before `NEXT_PUBLIC_API_URL` is set in production.

**No deploy target exists yet.** Judges get a repo and a video, no live URL.

**Two things only alven can unblock:** the oracle needs a fresh NAV push right
before recording and again before judging opens, and the question of whether the
demo vault gets a NAV drop during the recording window is still unanswered.

**The video** is the highest value remaining deliverable and depends on the two
items above.

---

## 6. Commit and push

All of the above is committed. To push:

```bash
export GH_TOKEN=$(grep -m1 '^GITHUB_TOKEN=' frontend/.env | cut -d= -f2-)
git -c credential.helper= \
    -c credential.helper='!f(){ echo username=x-access-token; echo "password=$GH_TOKEN"; };f' \
    push origin HEAD:main
```

The empty `credential.helper=` first is required: `osxkeychain` is configured
and answers before an appended helper, with a token that lacks the `workflow`
scope. Commit subjects are capped at 72 characters by commitlint.

CI runs lint, type-check, tests and the production build on every push to
`main`, so the build gets verified there even when it cannot be run locally.

---

## 7. Commands

```bash
cd frontend
bun run dev          # :3000
bun run lint
bun run type-check
bun run test         # 55 tests
node scripts/snapshot-chain.mjs   # regenerate the committed snapshot from chain
```

Reading the chain directly, which is how every number in this file was checked:

```bash
RPC=https://sepolia.base.org
V=0x4f634d7173eFf255973E762c3Fe04DF4887FfB35
cast call $V "getPosition()((address,uint256,uint256,uint16,uint16,uint256,bool,uint256,uint80,bool))" --rpc-url $RPC
cast call $V "healthRatioBps()(uint16)" --rpc-url $RPC
cast call $V "quoteGuardRepay()(uint256)" --rpc-url $RPC
```

If a number in the UI disagrees with `cast`, the UI is wrong. The chain is the
source of truth, and that is the whole argument of this submission.
