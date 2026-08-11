// One poll cycle of the autonomous guard agent.
//
// Responsibility boundary: decision logic ONLY. This file never touches
// network, never imports viem, never imports fetch, never reads env vars.
// All I/O is behind the Ledger interface injected at call time.
//
// If you find yourself writing `fetch(` or `publicClient.` here — stop.
// The seam is leaking.

import { healthRatioBps, priceDipPct, repayAmountToTarget } from './health.js';
import type { Ledger } from './ledger.js';
import type { Loan } from './types.js';
import { msg } from './errors.js';

// ─── State ───────────────────────────────────────────────────────────────────

export interface GuardState {
  /** Maps (borrower + loanId) → last priceFeed contractId we acted on. */
  lastActedPriceFeedCidByLoan: Map<string, string>;
}

export const createGuardState = (): GuardState => ({
  lastActedPriceFeedCidByLoan: new Map(),
});

// ─── Key derivation ──────────────────────────────────────────────────────────

/**
 * Key = borrower + loanId, NOT loanId alone.
 *
 * On a shared testnet many borrowers can use loanId "loan-1", all acting on
 * the same global price observation. Keying by loanId alone would mark the
 * observation "already acted" after the first borrower's rescue, silently
 * skipping every other borrower — no error, no log, no exception.
 */
const loanKey = (loan: Loan): string => `${loan.borrower} ${loan.loanId}`;

// ─── Minimum balance ─────────────────────────────────────────────────────────

/** Below this reserve balance we open a grace period instead of attempting repay. */
const MIN_REPAYABLE_BALANCE = 1;

// ─── Main cycle ──────────────────────────────────────────────────────────────

/**
 * Run one guard poll cycle.
 *
 * Per-item error isolation: one exercise that throws MUST NOT skip the
 * remaining loans/coupons in this poll. Log and continue; the next poll
 * retries from fresh chain state.
 */
export async function runGuardCycle(
  ledger: Ledger,
  state: GuardState,
  log: (m: string) => void = console.log,
): Promise<void> {
  const [feeds, loans, policies, vaults, graces, coupons] = await Promise.all([
    ledger.getActivePriceFeeds(),
    ledger.getActiveLoans(),
    ledger.getActiveGuardPolicies(),
    ledger.getActiveShadowVaults(),
    ledger.getActiveGracePeriods(),
    ledger.getActiveCouponDistributions(),
  ]);

  // Guard each loan independently — one failure must not block others.
  for (const loanC of loans) {
    try {
      await guardOneLoan(ledger, state, log, loanC, {
        feeds,
        policies,
        vaults,
        graces,
      });
    } catch (err) {
      log(`guard error on loan ${loanC.payload.loanId}: ${msg(err)}`);
    }
  }

  // Sweep coupons independently — same isolation rule.
  for (const couponC of coupons) {
    try {
      const policyC = policies.find(
        (p) => p.payload.borrower === couponC.payload.owner,
      );
      if (!policyC?.payload.couponSweep) continue;

      const loanC = loans.find(
        (l) => l.payload.borrower === couponC.payload.owner,
      );
      if (!loanC) continue;

      const result = await ledger.exerciseSweepToLoan(couponC.contractId, {
        guardPolicyCid: policyC.contractId,
        loanCid: loanC.contractId,
      });
      log(
        `Coupon swept ${result.amount.toFixed(2)} to loan. Outstanding now ${result.loan.payload.outstanding.toFixed(2)}.`,
      );
    } catch (err) {
      log(`coupon error ${couponC.contractId}: ${msg(err)}`);
    }
  }
}

// ─── Per-loan guard ──────────────────────────────────────────────────────────

async function guardOneLoan(
  ledger: Ledger,
  state: GuardState,
  log: (m: string) => void,
  loanC: ReturnType<Ledger['getActiveLoans']> extends Promise<(infer T)[]>
    ? T
    : never,
  ctx: {
    feeds: Awaited<ReturnType<Ledger['getActivePriceFeeds']>>;
    policies: Awaited<ReturnType<Ledger['getActiveGuardPolicies']>>;
    vaults: Awaited<ReturnType<Ledger['getActiveShadowVaults']>>;
    graces: Awaited<ReturnType<Ledger['getActiveGracePeriods']>>;
  },
): Promise<void> {
  const loan = loanC.payload;

  const policyC = ctx.policies.find((p) => p.payload.borrower === loan.borrower);
  const vaultC = ctx.vaults.find((v) => v.payload.borrower === loan.borrower);
  const priceC = ctx.feeds.find(
    (f) => f.payload.instrumentId === loan.collateralInstrumentId,
  );

  // Not enough context to guard this loan yet — skip silently.
  if (!policyC || !vaultC || !priceC) return;

  const ratio = healthRatioBps(
    loan.collateralAmount,
    priceC.payload.price,
    loan.outstanding,
  );

  // Position is healthy — nothing to do.
  if (ratio >= policyC.payload.triggerRatioBps) return;

  const key = loanKey(loan);

  // Already acted on this price observation — idempotency guard.
  // See plan.md §2 Jebakan 2: oracle address never changes in EVM, so
  // contractId MUST be keyed to `${oracle}@${roundId}` in KeeperHubLedger.
  if (state.lastActedPriceFeedCidByLoan.get(key) === priceC.contractId) return;

  // Reserve empty — open grace period instead of attempting repay.
  if (vaultC.payload.balance < MIN_REPAYABLE_BALANCE) {
    const graceLive = ctx.graces.some(
      (g) =>
        g.payload.loanId === loan.loanId &&
        g.payload.borrower === loan.borrower,
    );
    if (!graceLive) {
      await ledger.exerciseStartGracePeriod(loanC.contractId);
      log(
        `Reserve empty. Grace period opened for borrower ${loan.borrower}.`,
      );
    }
    // Mark acted on this observation even for grace — prevents repeated opens.
    state.lastActedPriceFeedCidByLoan.set(key, priceC.contractId);
    return;
  }

  const amount = repayAmountToTarget(
    loan.collateralAmount,
    priceC.payload.price,
    loan.outstanding,
    policyC.payload.targetRatioBps,
    policyC.payload.maxRepayPerEvent,
    vaultC.payload.balance,
  );

  if (amount <= 0) return;

  const result = await ledger.exerciseGuardRepay(vaultC.contractId, {
    priceFeedCid: priceC.contractId,
    loanCid: loanC.contractId,
    guardPolicyCid: policyC.contractId,
  });

  // Mark acted AFTER successful exercise — idempotency is set here.
  state.lastActedPriceFeedCidByLoan.set(key, priceC.contractId);

  log(
    `Price dipped ${priceDipPct(priceC.payload.price)}%. ` +
      `Repaid $${result.amountRepaid.toFixed(2)} from your reserve. ` +
      `Position safe. — Defral`,
  );
}
