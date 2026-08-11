import { describe, expect, it } from 'vitest';

import {
  formatBpsAsPercent,
  formatMoney,
  formatOraclePrice,
  formatSecondsAsAge,
  formatTokenAmount,
} from '@/utils/decimals';

describe('token amounts', () => {
  it('reads six decimal dUSD as thousands, not billions', () => {
    expect(formatMoney(6_000_000_000n, 6, 'dUSD')).toBe('6,000.00 dUSD');
  });

  it('formats the canonical repayment to the cent', () => {
    expect(formatMoney(758_620_690n, 6, 'dUSD')).toBe('758.62 dUSD');
  });

  it('formats the accrued coupon exactly', () => {
    expect(formatMoney(112_500_000n, 6, 'dUSD')).toBe('112.50 dUSD');
  });

  it('reads eighteen decimal collateral without losing scale', () => {
    expect(formatTokenAmount(10_000_000_000_000_000_000_000n, 18, 0)).toBe('10,000');
  });

  it('renders zero as zero rather than as empty', () => {
    expect(formatMoney(0n, 6, 'dUSD')).toBe('0.00 dUSD');
  });
});

describe('oracle price at eight decimals', () => {
  it('renders par as one dollar', () => {
    expect(formatOraclePrice(100_000_000n, 8)).toBe('$1.00');
  });

  it('renders the stress price', () => {
    expect(formatOraclePrice(76_000_000n, 8)).toBe('$0.76');
  });

  it('renders the protection floor', () => {
    expect(formatOraclePrice(39_000_000n, 8)).toBe('$0.39');
  });
});

describe('basis points', () => {
  it('renders health as a percentage, not as raw points', () => {
    expect(formatBpsAsPercent(16_667)).toBe('166.67%');
  });

  it('renders the trigger and the liquidation line', () => {
    expect(formatBpsAsPercent(13_000)).toBe('130.00%');
    expect(formatBpsAsPercent(11_000)).toBe('110.00%');
  });
});

describe('oracle age', () => {
  it('reads seconds, minutes and hours', () => {
    expect(formatSecondsAsAge(45)).toBe('45s');
    expect(formatSecondsAsAge(3_600)).toBe('1h 0m');
    expect(formatSecondsAsAge(28_740)).toBe('7h 59m');
  });
});
