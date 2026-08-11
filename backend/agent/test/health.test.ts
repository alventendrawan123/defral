// health.test.ts — pin canonical numbers.
//
// These numbers appear identically in the Solidity contracts and the UI.
// If any of them change here, something broke the "two independent
// implementations, one number" argument that is our headline claim.

import { describe, expect, it } from 'vitest';
import { healthRatioBps, priceDipPct, repayAmountToTarget, roundMoney } from '../src/health.js';

describe('healthRatioBps', () => {
  it('returns 16667 for 10000 collateral @ 1.00 with 6000 outstanding', () => {
    expect(healthRatioBps(10_000, 1.0, 6_000)).toBe(16_667);
  });

  it('returns 12667 for 10000 collateral @ 0.76 with 6000 outstanding', () => {
    expect(healthRatioBps(10_000, 0.76, 6_000)).toBe(12_667);
  });

  it('returns Infinity when outstanding is 0', () => {
    expect(healthRatioBps(10_000, 1.0, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns Infinity when outstanding is negative', () => {
    expect(healthRatioBps(10_000, 1.0, -1)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('repayAmountToTarget', () => {
  it('returns 758.62 for demo scenario: 10000 @ 0.76, debt 6000, target 14500, cap 2000, reserve 1500', () => {
    const result = repayAmountToTarget(10_000, 0.76, 6_000, 14_500, 2_000, 1_500);
    expect(Math.abs(result - 758.62)).toBeLessThan(0.01);
  });

  it('caps at maxRepayPerEvent when needed > cap', () => {
    // 10000 @ 0.50 vs 6000 debt, target 14500 — needed ~2793, cap 2000
    const result = repayAmountToTarget(10_000, 0.5, 6_000, 14_500, 2_000, 5_000);
    expect(result).toBe(2_000);
  });

  it('caps at vaultBalance when reserve < needed', () => {
    const result = repayAmountToTarget(10_000, 0.76, 6_000, 14_500, 2_000, 100);
    expect(result).toBe(100);
  });

  it('returns 0 when position is already healthy enough', () => {
    // health already above target — needed is negative → 0
    const result = repayAmountToTarget(10_000, 1.0, 4_000, 14_500, 2_000, 5_000);
    expect(result).toBe(0);
  });
});

describe('priceDipPct', () => {
  it('returns 24 for price 0.76 vs par 1.00', () => {
    expect(priceDipPct(0.76)).toBe(24);
  });

  it('returns 0 for price at par', () => {
    expect(priceDipPct(1.0)).toBe(0);
  });
});

describe('roundMoney', () => {
  it('rounds half-away-from-zero', () => {
    expect(roundMoney(758.625)).toBe(758.63);
    expect(roundMoney(758.624)).toBe(758.62);
  });

  it('pin coupon sweep amount: 112.50', () => {
    expect(roundMoney(112.5)).toBe(112.5);
  });
});

describe('canonical demo scenario chain', () => {
  it('health after repay of 758.62 reaches 14500 bps', () => {
    const outstandingAfter = roundMoney(6_000 - 758.62);
    expect(Math.abs(outstandingAfter - 5_241.38)).toBeLessThan(0.01);
    const health = healthRatioBps(10_000, 0.76, outstandingAfter);
    expect(health).toBe(14_500);
  });

  it('health after coupon sweep of 112.50 reaches 14818 bps', () => {
    const outstandingAfter = roundMoney(5_241.38 - 112.5);
    expect(Math.abs(outstandingAfter - 5_128.88)).toBeLessThan(0.01);
    const health = healthRatioBps(10_000, 0.76, outstandingAfter);
    expect(health).toBe(14_818);
  });
});
