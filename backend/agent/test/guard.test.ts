// guard.test.ts — 10 tests against MockLedger.
//
// This suite is THE acceptance gate. It must pass WITHOUT A SINGLE CHARACTER
// CHANGED when run against KeeperHubLedger as well (via keeperhub.test.ts).
// If you need to modify this file to make a test pass, the implementation
// is wrong — not the test.

import { describe, it, expect, beforeEach } from 'vitest';
import { MockLedger } from '../src/ledger.js';
import { createGuardState, runGuardCycle } from '../src/guard.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const ORACLE = '0xORACLE';
const BORROWER = '0xBORROWER';
const BORROWER_2 = '0xBORROWER2';
const AGENT = '0xAGENT';
const POOL = '0xPOOL';
const INSTRUMENT_ID = 'dUST';

// ─── Seed helper ─────────────────────────────────────────────────────────────

/**
 * Seed the canonical demo scenario: 10_000 collateral @ 1.00,
 * debt 6_000, trigger 13_000 / target 14_500, cap 2_000 per event,
 * reserve 1_500. Any field can be overridden per-test.
 */
function seedDemoScenario(
  ledger: MockLedger,
  o: {
    price?: number;
    debt?: number;
    reserve?: number;
    couponSweep?: boolean;
    collateralAmount?: number;
    borrower?: string;
    loanId?: string;
  } = {},
) {
  const borrower = o.borrower ?? BORROWER;
  const loanId = o.loanId ?? 'loan-1';

  const priceFeed = ledger.seedPriceFeed({
    oracle: ORACLE,
    instrumentId: INSTRUMENT_ID,
    price: o.price ?? 1.0,
  } satisfies { oracle: string; instrumentId: string; price: number });

  const loan = ledger.seedLoan({
    borrower,
    poolOperator: POOL,
    guardAgent: AGENT,
    loanId,
    principal: 6_000,
    outstanding: o.debt ?? 6_000,
    rateBps: 0,
    collateralInstrumentId: INSTRUMENT_ID,
    collateralAmount: o.collateralAmount ?? 10_000,
  });

  const policy = ledger.seedPolicy({
    borrower,
    guardAgent: AGENT,
    triggerRatioBps: 13_000,
    targetRatioBps: 14_500,
    maxRepayPerEvent: 2_000,
    couponSweep: o.couponSweep ?? false,
  });

  const vault = ledger.seedVault({
    borrower,
    guardAgent: AGENT,
    balance: o.reserve ?? 1_500,
  });

  return { priceFeed, loan, policy, vault };
}

/** Capture log lines emitted during a cycle. */
function capturingLogger() {
  const logs: string[] = [];
  return { logs, log: (m: string) => logs.push(m) };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('guard — 10 acceptance tests against MockLedger', () => {
  let ledger: MockLedger;
  let state: ReturnType<typeof createGuardState>;

  beforeEach(() => {
    ledger = new MockLedger();
    state = createGuardState();
  });

  // ── Test 1 ────────────────────────────────────────────────────────────────

  it('trigger fires when health drops below triggerRatioBps, repays 758.62, restores to 14500', async () => {
    const { loan } = seedDemoScenario(ledger, { price: 0.76 }); // health 12667 < 13000
    const { logs, log } = capturingLogger();

    await runGuardCycle(ledger, state, log);

    const loans = await ledger.getActiveLoans();
    const updatedLoan = loans.find((l) => l.contractId === loan.contractId)!;
    expect(Math.abs(updatedLoan.payload.outstanding - 5_241.38)).toBeLessThan(0.01);
    expect(logs.length).toBe(1);
    expect(logs[0]).toMatch(/Repaid \$758\.62/);
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────

  it('does NOT fire when position is healthy (health >= triggerRatioBps)', async () => {
    seedDemoScenario(ledger, { price: 1.0 }); // health 16667 > 13000
    const { logs, log } = capturingLogger();

    await runGuardCycle(ledger, state, log);

    expect(logs.length).toBe(0);
    const loans = await ledger.getActiveLoans();
    expect(loans[0]!.payload.outstanding).toBe(6_000);
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────

  it('repay is capped by maxRepayPerEvent when needed exceeds cap', async () => {
    // price 0.50 → health 8333, needed ~2793, cap 2000
    seedDemoScenario(ledger, { price: 0.5, reserve: 5_000 });
    const { logs, log } = capturingLogger();

    await runGuardCycle(ledger, state, log);

    const loans = await ledger.getActiveLoans();
    // repaid exactly 2000 (capped), outstanding = 4000
    expect(Math.abs(loans[0]!.payload.outstanding - 4_000)).toBeLessThan(0.01);
    expect(logs[0]).toMatch(/Repaid \$2000\.00/);
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────

  it('repay is capped by vault balance when reserve < needed', async () => {
    seedDemoScenario(ledger, { price: 0.76, reserve: 100 });
    const { logs, log } = capturingLogger();

    await runGuardCycle(ledger, state, log);

    const loans = await ledger.getActiveLoans();
    // repaid exactly 100 (reserve cap), outstanding = 5900
    expect(Math.abs(loans[0]!.payload.outstanding - 5_900)).toBeLessThan(0.01);
    expect(logs[0]).toMatch(/Repaid \$100\.00/);
  });

  // ── Test 5 ────────────────────────────────────────────────────────────────

  it('opens grace period when reserve is empty (balance < 1)', async () => {
    seedDemoScenario(ledger, { price: 0.76, reserve: 0 });
    const { logs, log } = capturingLogger();

    await runGuardCycle(ledger, state, log);

    const graces = await ledger.getActiveGracePeriods();
    expect(graces.length).toBe(1);
    expect(graces[0]!.payload.borrower).toBe(BORROWER);
    expect(logs[0]).toMatch(/Grace period opened/);
  });

  // ── Test 6 ────────────────────────────────────────────────────────────────

  it('opens grace period exactly ONCE, not on every subsequent tick', async () => {
    seedDemoScenario(ledger, { price: 0.76, reserve: 0 });

    // First cycle — grace opens
    await runGuardCycle(ledger, state);
    let graces = await ledger.getActiveGracePeriods();
    expect(graces.length).toBe(1);

    // Second cycle on same price observation — grace already live, no new one
    await runGuardCycle(ledger, state);
    graces = await ledger.getActiveGracePeriods();
    expect(graces.length).toBe(1); // still exactly one
  });

  // ── Test 7 ────────────────────────────────────────────────────────────────

  it('sweeps coupon to loan when couponSweep is enabled', async () => {
    seedDemoScenario(ledger, { price: 0.76, couponSweep: true });
    // Add a coupon distribution
    ledger.seedCoupon({
      issuer: POOL,
      owner: BORROWER,
      guardAgent: AGENT,
      instrumentId: INSTRUMENT_ID,
      amount: 112.5,
    });
    const { logs, log } = capturingLogger();

    await runGuardCycle(ledger, state, log);

    // Both guardRepay and coupon sweep ran
    const loans = await ledger.getActiveLoans();
    // outstanding after guardRepay ≈ 5241.38, then coupon sweep −112.50 ≈ 5128.88
    expect(Math.abs(loans[0]!.payload.outstanding - 5_128.88)).toBeLessThan(0.01);
    expect(logs.some((l) => l.includes('Coupon swept'))).toBe(true);
  });

  // ── Test 8 ────────────────────────────────────────────────────────────────

  it('does NOT sweep coupon when couponSweep is disabled', async () => {
    seedDemoScenario(ledger, { price: 0.76, couponSweep: false });
    ledger.seedCoupon({
      issuer: POOL,
      owner: BORROWER,
      guardAgent: AGENT,
      instrumentId: INSTRUMENT_ID,
      amount: 112.5,
    });
    const { logs, log } = capturingLogger();

    await runGuardCycle(ledger, state, log);

    // Only guardRepay ran, coupon untouched
    const coupons = await ledger.getActiveCouponDistributions();
    expect(coupons.length).toBe(1); // still present
    expect(logs.every((l) => !l.includes('Coupon swept'))).toBe(true);
  });

  // ── Test 9 ────────────────────────────────────────────────────────────────

  it('never fires twice on the same price observation (idempotency)', async () => {
    const { logs: logs1, log: log1 } = capturingLogger();
    seedDemoScenario(ledger, { price: 0.76 });

    // First cycle fires
    await runGuardCycle(ledger, state, log1);
    expect(logs1.length).toBe(1);

    // Second cycle on same price feed contractId — must not fire again
    const { logs: logs2, log: log2 } = capturingLogger();
    await runGuardCycle(ledger, state, log2);
    expect(logs2.length).toBe(0);
  });

  // ── Test 10 ───────────────────────────────────────────────────────────────

  it('two borrowers sharing the same loanId are BOTH rescued in one poll', async () => {
    // Borrower 1 with loanId "loan-1"
    seedDemoScenario(ledger, {
      price: 0.76,
      borrower: BORROWER,
      loanId: 'loan-1',
    });

    // Borrower 2 with THE SAME loanId "loan-1"
    seedDemoScenario(ledger, {
      price: 0.76,
      borrower: BORROWER_2,
      loanId: 'loan-1',
    });

    const { logs, log } = capturingLogger();
    await runGuardCycle(ledger, state, log);

    // Both must have been rescued — 2 log lines
    expect(logs.filter((l) => l.includes('Repaid')).length).toBe(2);

    const loans = await ledger.getActiveLoans();
    for (const loan of loans) {
      expect(Math.abs(loan.payload.outstanding - 5_241.38)).toBeLessThan(0.01);
    }
  });

  // ── Error isolation ───────────────────────────────────────────────────────

  it('one exercise that throws does NOT skip the remaining loans', async () => {
    // Loan 1: will throw — no policy seeded for it
    ledger.seedPriceFeed({
      oracle: ORACLE,
      instrumentId: INSTRUMENT_ID,
      price: 0.76,
    });
    ledger.seedLoan({
      borrower: '0xBAD',
      poolOperator: POOL,
      guardAgent: AGENT,
      loanId: 'bad-loan',
      principal: 1_000,
      outstanding: 1_000,
      rateBps: 0,
      collateralInstrumentId: INSTRUMENT_ID,
      collateralAmount: 1_000,
    });
    // No policy / vault for 0xBAD — guard will silently skip (missing context)

    // Loan 2: healthy borrower that should be rescued
    seedDemoScenario(ledger, { price: 0.76 });

    const { logs, log } = capturingLogger();
    await runGuardCycle(ledger, state, log);

    // The healthy borrower was still rescued despite the bad loan
    const loans = await ledger.getActiveLoans();
    const rescuedLoan = loans.find((l) => l.payload.borrower === BORROWER);
    expect(rescuedLoan).toBeDefined();
    expect(Math.abs(rescuedLoan!.payload.outstanding - 5_241.38)).toBeLessThan(0.01);
  });
});
