# Provenance

We are saying this before anyone asks.

Defral has a predecessor. In July 2026 this team shipped an RWA-mirror lending
product on Canton for a different hackathon. Parts of that work are reused here.
The DoraHacks rules permit reuse, and we checked: there is no originality clause
in the ToS or in the KeeperHub rules. We are documenting the boundary anyway,
because the boundary is the honest part.

## What came from the Canton build

- The health-ratio math and the shape of its derived values.
- The decision loop: observe a price, check the ratio, act only below the trigger.
- The product voice and the general UI direction.

## What was written for this hackathon

- Every Solidity contract in `sc/`, deployed and verified on Base Sepolia.
- The KeeperHub integration and the reliability layer around it.
- The entire frontend in `frontend/`, rebuilt on Next.js with a new architecture.
- The Capability Matrix, the proof archive, and the pair of mined transactions where one defence lands and the system deployer is refused.
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
| Contracts on Base Sepolia | **Deployed and verified.** Demo vault `0x4f634d7173eFf255973E762c3Fe04DF4887FfB35` |
| Dashboard, vault, connect, onboarding | **Live chain reads.** One multicall per render, `revalidate = 30` |
| Health ratio and repay quote | **Read from the contract**, never recomputed here. `healthRatioBps()` and `quoteGuardRepay()` |
| Token decimals | **Read from the contracts.** dUSD is 6 and dUST is 18, and the UI does not assume it |
| `/proof` archive | Reads committed JSON in `frontend/docs/evidence/`, derived from the prove runs in `docs/evidence/`. Never a live API |
| Agent refusals | **Execution records, not transactions.** KeeperHub declines to broadcast a call it predicts will revert, so no hash exists and none is offered |
| Owner side refusal | **A mined, reverted transaction.** The system deployer called the demo vault and got `NotAgent` |
| Protection floor and runway | Derived in the frontend, in `bigint`, from chain inputs. These two have no on-chain equivalent |
| Offline fallback | A snapshot read from the chain and committed, labelled with its block when it is used |
| Wallet signing | **Not wired.** The frontend never writes to the contracts, and no control implies otherwise |
| Second collateral (mXAU) | **Cut.** Only dUST is deployed, so only dUST is shown |

Nothing on the site claims a transaction that does not exist. An agent refusal
shows the decoded custom error the contract returned with its `executionId`,
and says plainly that no transaction was broadcast.

Two disclosures we make before anyone asks. Some evidence ran on an identical
rehearsal vault, and every entry is labelled with which vault it used. And the
demo position has since been defended for real, so its debt is permanently
lower than the opening figure and its reserve has been spent down.
