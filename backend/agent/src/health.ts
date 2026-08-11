// Pure health-ratio mathematics. No I/O, no imports, no side effects.
//
// Responsibility boundary: every numeric formula lives here and NOWHERE else.
// The same functions are called by MockLedger, KeeperHubLedger, and tests —
// so a single wrong constant is caught at every layer simultaneously.

/** Round to cents, half-away-from-zero. */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Health ratio in basis points. 13000 = 130%.
 * outstanding === 0 means no debt to protect — maximally healthy.
 */
export function healthRatioBps(
  collateralAmount: number,
  price: number,
  outstanding: number,
): number {
  if (outstanding <= 0) return Number.POSITIVE_INFINITY;
  return Math.round((collateralAmount * price / outstanding) * 10_000);
}

/**
 * How much to repay so health returns to targetRatioBps.
 *   needed = outstanding − collateralValue / (targetBps / 10000)
 *   repay  = min(needed, maxRepayPerEvent, vaultBalance), floor at 0
 */
export function repayAmountToTarget(
  collateralAmount: number,
  price: number,
  outstanding: number,
  targetRatioBps: number,
  maxRepayPerEvent: number,
  vaultBalance: number,
): number {
  const collateralValue = collateralAmount * price;
  const targetOutstanding = collateralValue / (targetRatioBps / 10_000);
  const needed = Math.max(0, outstanding - targetOutstanding);
  return roundMoney(Math.max(0, Math.min(needed, maxRepayPerEvent, vaultBalance)));
}

/**
 * Percentage price drop from par (1.00), for human-readable log lines.
 * e.g. price 0.76 → 24.00
 */
export function priceDipPct(price: number, parPrice = 1.0): number {
  return roundMoney((1 - price / parPrice) * 100);
}
