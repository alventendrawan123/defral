import { describe, expect, it } from 'vitest';

import { toOraclePoint, toVaultPosition } from '@/services/chain/vaultReads';

const LIVE_POSITION = {
  borrower: '0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2',
  outstanding: 6_000_000_000n,
  collateralAmount: 10_000_000_000_000_000_000_000n,
  triggerBps: 13_000,
  targetBps: 14_500,
  maxRepayPerEvent: 2_000_000_000n,
  couponSweep: true,
  reserve: 3_000_000_000n,
  lastActedRound: 0n,
  revoked: false,
} as const;

describe('toVaultPosition', () => {
  const position = toVaultPosition(LIVE_POSITION);

  it('maps the named struct viem returns, renaming the two booleans', () => {
    expect(position).toEqual({
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
    });
  });

  it('does not confuse debt with reserve, which sit at different scales', () => {
    expect(position.outstanding).not.toBe(position.reserve);
    expect(position.outstanding).toBe(6_000_000_000n);
  });

  it('keeps collateral at eighteen decimals rather than truncating to six', () => {
    expect(position.collateralAmount).toBeGreaterThan(position.outstanding);
  });
});

describe('toOraclePoint', () => {
  const roundData = [3n, 100_000_000n, 1_786_384_066n, 1_786_384_066n, 3n] as const;

  it('reads updatedAt from the fourth field, not the third', () => {
    const point = toOraclePoint(roundData, 8, 1_786_384_066);
    expect(point.updatedAtSeconds).toBe(1_786_384_066);
    expect(point.ageSeconds).toBe(0);
  });

  it('reports the age against the observation time', () => {
    expect(toOraclePoint(roundData, 8, 1_786_412_806).ageSeconds).toBe(28_740);
  });

  it('never reports a negative age', () => {
    expect(toOraclePoint(roundData, 8, 1_786_000_000).ageSeconds).toBe(0);
  });
});
