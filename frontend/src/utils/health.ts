import { BPS_SCALE, CENTS_PER_UNIT, LIQUIDATION_BPS } from '@/constants/protocol';
import type { GuardRepayInput, HealthStatus, ProtectionFloorInput } from '@/types';

export function roundDownToCents(amount: number): number {
  return Math.floor(amount * CENTS_PER_UNIT) / CENTS_PER_UNIT;
}

export function computeHealthRatioBps(
  collateralQty: number,
  price: number,
  debt: number,
): number {
  if (debt <= 0) return Number.POSITIVE_INFINITY;
  return Math.round(((collateralQty * price) / debt) * BPS_SCALE);
}

export function computeDefensePrice(
  collateralQty: number,
  debt: number,
  triggerBps: number,
): number {
  if (collateralQty <= 0) return Number.POSITIVE_INFINITY;
  return ((debt * triggerBps) / BPS_SCALE) / collateralQty;
}

export function computeProtectionFloorPrice({
  collateralQty,
  debt,
  reserve,
  triggerBps,
}: ProtectionFloorInput): number {
  if (collateralQty <= 0) return Number.POSITIVE_INFINITY;
  const maxRepayable = Math.min(reserve, debt);
  return (((debt - maxRepayable) * triggerBps) / BPS_SCALE) / collateralQty;
}

export function computeProtectionRunwayPct(currentPrice: number, floorPrice: number): number {
  if (currentPrice <= 0) return 0;
  return Math.max(0, (1 - floorPrice / currentPrice) * 100);
}

export function computeGuardRepay({
  collateralQty,
  price,
  debt,
  targetBps,
  maxRepayPerEvent,
  reserve,
}: GuardRepayInput): number {
  const debtAtTarget = (collateralQty * price * BPS_SCALE) / targetBps;
  const needed = Math.max(0, debt - debtAtTarget);
  return roundDownToCents(Math.min(needed, maxRepayPerEvent, reserve));
}

export function maxOutstandingForRatioBps(collateralValue: number, ratioBps: number): number {
  if (ratioBps <= 0) return 0;
  return roundDownToCents((collateralValue * BPS_SCALE) / ratioBps);
}

export function resolveHealthStatus(ratioBps: number, triggerBps: number): HealthStatus {
  if (ratioBps >= triggerBps) return 'safe';
  if (ratioBps >= LIQUIDATION_BPS) return 'defending';
  return 'critical';
}
