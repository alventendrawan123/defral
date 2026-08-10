import { describe, expect, it } from 'vitest';

import {
  computeDefensePrice,
  computeGuardRepay,
  computeHealthRatioBps,
  computeProtectionFloorPrice,
  computeProtectionRunwayPct,
  maxOutstandingForRatioBps,
  resolveHealthStatus,
} from '@/utils/health';

const DEMO = {
  collateralQty: 10_000,
  debt: 6_000,
  reserve: 1_500,
  triggerBps: 13_000,
  targetBps: 14_500,
  maxRepayPerEvent: 1_500,
  couponAmount: 112.5,
  healthyPrice: 1,
  stressPrice: 0.76,
};

describe('computeHealthRatioBps', () => {
  it('matches the canonical opening position', () => {
    expect(computeHealthRatioBps(DEMO.collateralQty, DEMO.healthyPrice, DEMO.debt)).toBe(16_667);
  });

  it('matches the canonical stress price', () => {
    expect(computeHealthRatioBps(DEMO.collateralQty, DEMO.stressPrice, DEMO.debt)).toBe(12_667);
  });

  it('returns infinity when there is no debt', () => {
    expect(computeHealthRatioBps(DEMO.collateralQty, DEMO.healthyPrice, 0)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('computeGuardRepay', () => {
  const repay = computeGuardRepay({
    collateralQty: DEMO.collateralQty,
    price: DEMO.stressPrice,
    debt: DEMO.debt,
    targetBps: DEMO.targetBps,
    maxRepayPerEvent: DEMO.maxRepayPerEvent,
    reserve: DEMO.reserve,
  });

  it('pays the canonical amount', () => {
    expect(repay).toBe(758.62);
  });

  it('restores the position to the target ratio', () => {
    expect(
      computeHealthRatioBps(DEMO.collateralQty, DEMO.stressPrice, DEMO.debt - repay),
    ).toBe(14_500);
  });

  it('lifts the ratio again once the coupon is swept', () => {
    const debtAfterSweep = DEMO.debt - repay - DEMO.couponAmount;
    expect(debtAfterSweep).toBeCloseTo(5_128.88, 2);
    expect(computeHealthRatioBps(DEMO.collateralQty, DEMO.stressPrice, debtAfterSweep)).toBe(
      14_818,
    );
  });

  it('never spends more than the reserve', () => {
    expect(
      computeGuardRepay({
        collateralQty: DEMO.collateralQty,
        price: 0.4,
        debt: DEMO.debt,
        targetBps: DEMO.targetBps,
        maxRepayPerEvent: DEMO.maxRepayPerEvent,
        reserve: DEMO.reserve,
      }),
    ).toBe(DEMO.reserve);
  });

  it('does nothing while the position is healthy', () => {
    expect(
      computeGuardRepay({
        collateralQty: DEMO.collateralQty,
        price: DEMO.healthyPrice,
        debt: DEMO.debt,
        targetBps: DEMO.targetBps,
        maxRepayPerEvent: DEMO.maxRepayPerEvent,
        reserve: DEMO.reserve,
      }),
    ).toBe(0);
  });
});

describe('price thresholds', () => {
  it('derives the canonical defence price', () => {
    expect(computeDefensePrice(DEMO.collateralQty, DEMO.debt, DEMO.triggerBps)).toBeCloseTo(
      0.78,
      6,
    );
  });

  it('derives the canonical protection floor', () => {
    expect(
      computeProtectionFloorPrice({
        collateralQty: DEMO.collateralQty,
        debt: DEMO.debt,
        reserve: DEMO.reserve,
        triggerBps: DEMO.triggerBps,
      }),
    ).toBeCloseTo(0.585, 6);
  });

  it('reports how far the price may fall before the floor', () => {
    expect(computeProtectionRunwayPct(DEMO.healthyPrice, 0.585)).toBeCloseTo(41.5, 6);
  });

  it('clamps the runway at zero once the price is below the floor', () => {
    expect(computeProtectionRunwayPct(0.5, 0.585)).toBe(0);
  });
});

describe('maxOutstandingForRatioBps', () => {
  it('is the inverse of computeHealthRatioBps', () => {
    const collateralValue = DEMO.collateralQty * DEMO.healthyPrice;
    const maxDebt = maxOutstandingForRatioBps(collateralValue, DEMO.triggerBps);
    expect(
      computeHealthRatioBps(DEMO.collateralQty, DEMO.healthyPrice, maxDebt),
    ).toBeGreaterThanOrEqual(DEMO.triggerBps);
  });

  it('rounds down so the resulting ratio never dips below the limit', () => {
    expect(maxOutstandingForRatioBps(10_000, 13_000)).toBe(7_692.3);
  });

  it('refuses to divide by a non positive ratio', () => {
    expect(maxOutstandingForRatioBps(10_000, 0)).toBe(0);
  });
});

describe('resolveHealthStatus', () => {
  it('is safe at or above the trigger', () => {
    expect(resolveHealthStatus(16_667, DEMO.triggerBps)).toBe('safe');
    expect(resolveHealthStatus(13_000, DEMO.triggerBps)).toBe('safe');
  });

  it('is defending inside the defence window', () => {
    expect(resolveHealthStatus(12_667, DEMO.triggerBps)).toBe('defending');
    expect(resolveHealthStatus(11_000, DEMO.triggerBps)).toBe('defending');
  });

  it('is critical once liquidation is permissionless', () => {
    expect(resolveHealthStatus(10_999, DEMO.triggerBps)).toBe('critical');
  });
});
