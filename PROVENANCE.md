# Provenance

We are saying this before anyone asks.

Defral has a predecessor. In July 2026 this team shipped an RWA-mirror lending
product on Canton for a different hackathon. Parts of that work are reused here.
The DoraHacks rules permit reuse, and we checked: there is no originality clause
in the ToS or in the KeeperHub rules. We are documenting the boundary anyway,
because the boundary is the honest part.

## What came from the Canton build

- The health-ratio math and the shape of its derived values.
- The decision loop: observe a price, recompute the ratio, act only below the trigger.
- The product voice and the general UI direction.

## What was written for this hackathon

- Every Solidity contract in `SC/`, targeting Base Sepolia.
- The KeeperHub integration and the reliability layer around it.
- The entire frontend in `frontend/`, rebuilt on Next.js with a new architecture.
- The Capability Matrix, the proof archive, and the side-by-side liquidation comparison.
- Every negative control: the transactions that are supposed to fail, and do.

## What did not survive the move, and what replaced it

The Canton product had real party-scoped privacy. A borrower reserve and each
individual rescue were structurally invisible to the lending pool. Its README
said this was impossible to replicate on a public EVM chain.

That sentence was true, and because it was true it did not come with us. On Base
Sepolia every storage slot and every event log is readable by anyone.

We deleted the privacy claim rather than weakening it into something that sounds
similar but is not. What replaced it is **authority limits**: the agent has two
zero-argument functions, the contract re-reads the oracle and refuses while the
position is healthy, and the reserve never leaves the borrower wallet because
there is no function that could move it. That claim is stronger on a public
chain, not weaker, because a third party can verify it without trusting us.

## What is real and what is mock, right now

Stated plainly, and this section is updated as contracts land.

| Area | Status |
|---|---|
| Health math in `frontend/src/utils/health.ts` | Real, pure, and unit tested against the canonical demo numbers |
| Capability Matrix rows | Real questions, evidence slots marked `awaiting deployment` until the contracts are live |
| `/proof` archive | Reads committed JSON in `frontend/docs/evidence/`, never a live API. Transaction links are null until broadcast |
| Liquidation comparison | Both sides modelled, transaction links null until broadcast |
| Dashboard, vault, onboarding | Driven by fixtures in `frontend/src/services/mockData.ts` |
| Wallet signing | Not wired. The borrower path uses demo borrowers |
| Contracts on Base Sepolia | Not deployed at the time of writing |

Nothing on the site claims a transaction that does not exist. A row without a
transaction says `awaiting deployment` instead of showing an empty cell.
