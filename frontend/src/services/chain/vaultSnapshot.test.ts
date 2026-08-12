import { describe, expect, it } from 'vitest';

import { resolveAgentPosture } from '@/services/chain/vaultSnapshot';
import type { VaultSnapshot } from '@/types';

const base: VaultSnapshot = {
  vault: '0x4f634d7173eFf255973E762c3Fe04DF4887FfB35',
  position: {
    borrower: '0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2',
    outstanding: 2_887_500_000n,
    collateralAmount: 10_000_000_000_000_000_000_000n,
    triggerBps: 13_000,
    targetBps: 14_500,
    maxRepayPerEvent: 2_000_000_000n,
    isCouponSweepEnabled: true,
    reserve: 3_000_000_000n,
    lastActedRound: 16n,
    isAgentRevoked: false,
  },
  guardRepayQuote: 0n,
  couponDue: 0n,
  healthRatioBps: 16_667,
  liquidationBps: 11_000,
  maxStaleSeconds: 3_600,
  oracle: {
    roundId: 16n,
    price: 37_100_519n,
    decimals: 8,
    updatedAtSeconds: 1_786_463_936,
    ageSeconds: 60,
  },
  tokens: { debtDecimals: 6, collateralDecimals: 18 },
  observedAtSeconds: 1_786_463_996,
  source: 'chain',
};

function snapshotWith(overrides: Partial<VaultSnapshot>): VaultSnapshot {
  return { ...base, ...overrides };
}

describe('resolveAgentPosture', () => {
  it('is idle when the position is above its trigger and nothing is owed', () => {
    expect(resolveAgentPosture(base)).toBe('idle-healthy');
  });

  it('would defend when the contract quotes a repayment', () => {
    expect(
      resolveAgentPosture(snapshotWith({ guardRepayQuote: 758_620_690n, healthRatioBps: 12_667 })),
    ).toBe('would-defend');
  });

  it('reports an exhausted reserve rather than calling a sub trigger position healthy', () => {
    const spent = snapshotWith({
      healthRatioBps: 12_849,
      guardRepayQuote: 0n,
      position: { ...base.position, reserve: 0n },
    });
    expect(resolveAgentPosture(spent)).toBe('reserve-exhausted');
  });

  it('flags a stale oracle ahead of everything except a revoked agent', () => {
    const stale = snapshotWith({
      healthRatioBps: 12_849,
      oracle: { ...base.oracle, ageSeconds: 28_740 },
      position: { ...base.position, reserve: 0n },
    });
    expect(resolveAgentPosture(stale)).toBe('oracle-stale');
  });

  it('reports a revoked agent above all other states', () => {
    const revoked = snapshotWith({
      oracle: { ...base.oracle, ageSeconds: 28_740 },
      position: { ...base.position, isAgentRevoked: true },
    });
    expect(resolveAgentPosture(revoked)).toBe('revoked');
  });
});
