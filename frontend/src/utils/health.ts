import { BPS_SCALE } from '@/constants/protocol';
import type { HealthStatus, VaultSnapshot } from '@/types';

export function resolveHealthStatus(ratioBps: number, triggerBps: number): HealthStatus {
  if (ratioBps >= triggerBps) return 'safe';
  return ratioBps >= 11_000 ? 'defending' : 'critical';
}

export function computeProtectionFloorPrice(snapshot: VaultSnapshot): bigint {
  const { position, oracle, tokens } = snapshot;
  if (position.collateralAmount === 0n) return 0n;

  const repayable =
    position.reserve < position.outstanding ? position.reserve : position.outstanding;
  const debtAfterReserve = position.outstanding - repayable;
  const scale =
    10n ** BigInt(tokens.collateralDecimals + oracle.decimals - tokens.debtDecimals);

  return (
    (BigInt(position.triggerBps) * debtAfterReserve * scale) /
    (position.collateralAmount * BigInt(BPS_SCALE))
  );
}

export function computeProtectionRunwayBps(currentPrice: bigint, floorPrice: bigint): number {
  if (currentPrice <= 0n || floorPrice >= currentPrice) return 0;
  return Number(((currentPrice - floorPrice) * BigInt(BPS_SCALE)) / currentPrice);
}
