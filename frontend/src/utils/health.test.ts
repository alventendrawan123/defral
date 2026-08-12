import { describe, expect, it } from 'vitest';

import type { VaultSnapshot } from '@/types';
import {
  computeProtectionFloorPrice,
  computeProtectionRunwayBps,
  resolveHealthStatus,
} from '@/utils/health';

const snapshot: VaultSnapshot = {
  vault: '0x4f634d7173eFf255973E762c3Fe04DF4887FfB35',
  position: {
    borrower: '0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2',
    outstanding: 6_000_000_000n,
    collateralAmount: 10_000_000_000_000_000_000_000n,
    triggerBps: 13_000,
    targetBps: 14_500,
    maxRepayPerEvent: 2_000_000_000n,
    isCouponSweepEnabled: true,
    reserve: 3_000_000_000n,
    lastActedRound: 0n,
    isAgentRevoked: false,
  },
  guardRepayQuote: 0n,
  couponDue: 112_500_000n,
  healthRatioBps: 16_667,
  liquidationBps: 11_000,
  maxStaleSeconds: 3_600,
  oracle: {
    roundId: 3n,
    price: 100_000_000n,
    decimals: 8,
    updatedAtSeconds: 1_786_384_066,
    ageSeconds: 0,
  },
  tokens: { debtDecimals: 6, collateralDecimals: 18 },
  observedAtSeconds: 1_786_384_066,
  source: 'committed-snapshot',
};

function withPosition(overrides: Partial<VaultSnapshot['position']>): VaultSnapshot {
  return { ...snapshot, position: { ...snapshot.position, ...overrides } };
}

describe('computeProtectionFloorPrice', () => {
  it('derives the price at which the reserve is exhausted', () => {
    expect(computeProtectionFloorPrice(snapshot)).toBe(39_000_000n);
  });

  it('is zero when the reserve fully covers the debt', () => {
    expect(computeProtectionFloorPrice(withPosition({ reserve: 10_000_000_000n }))).toBe(0n);
  });

  it('rises as the reserve shrinks, because less of the fall can be absorbed', () => {
    const thin = computeProtectionFloorPrice(withPosition({ reserve: 1_000_000_000n }));
    expect(thin).toBeGreaterThan(computeProtectionFloorPrice(snapshot));
  });

  it('refuses to divide by a collateral balance of zero', () => {
    expect(computeProtectionFloorPrice(withPosition({ collateralAmount: 0n }))).toBe(0n);
  });

  it('scales from the decimals in the snapshot rather than from a hardcoded six and eighteen', () => {
    const eightDecimalDebt: VaultSnapshot = {
      ...snapshot,
      tokens: { debtDecimals: 8, collateralDecimals: 18 },
      position: { ...snapshot.position, outstanding: 600_000_000_000n, reserve: 300_000_000_000n },
    };
    expect(computeProtectionFloorPrice(eightDecimalDebt)).toBe(
      computeProtectionFloorPrice(snapshot),
    );
  });
});

describe('computeProtectionRunwayBps', () => {
  it('reports how far the price may fall before the floor', () => {
    const floor = computeProtectionFloorPrice(snapshot);
    expect(computeProtectionRunwayBps(snapshot.oracle.price, floor)).toBe(6_100);
  });

  it('clamps at zero once the price is at or below the floor', () => {
    expect(computeProtectionRunwayBps(39_000_000n, 39_000_000n)).toBe(0);
    expect(computeProtectionRunwayBps(30_000_000n, 39_000_000n)).toBe(0);
  });

  it('refuses to divide by a price of zero', () => {
    expect(computeProtectionRunwayBps(0n, 39_000_000n)).toBe(0);
  });
});

describe('resolveHealthStatus', () => {
  it('is safe at or above the trigger', () => {
    expect(resolveHealthStatus(16_667, 13_000)).toBe('safe');
    expect(resolveHealthStatus(13_000, 13_000)).toBe('safe');
  });

  it('is defending inside the defence window', () => {
    expect(resolveHealthStatus(12_667, 13_000)).toBe('defending');
    expect(resolveHealthStatus(11_000, 13_000)).toBe('defending');
  });

  it('is critical once liquidation is permissionless', () => {
    expect(resolveHealthStatus(10_999, 13_000)).toBe('critical');
  });
});
