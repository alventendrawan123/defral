'use client';

import { useEffect } from 'react';

import { DEFAULT_GUARD_TRIGGER_BPS } from '@/constants/protocol';
import { useDefralStore } from '@/stores/useDefralStore';
import type { HealthStatus } from '@/types';
import {
  computeDefensePrice,
  computeHealthRatioBps,
  computeProtectionFloorPrice,
  computeProtectionRunwayPct,
  resolveHealthStatus,
} from '@/utils/health';

export interface DashboardDerivedView {
  healthRatioBps: number;
  triggerRatioBps: number;
  status: HealthStatus;
  defensePrice: number;
  protectionFloorPrice: number;
  protectionRunwayPct: number;
}

export function useDefralDashboard() {
  const status = useDefralStore((state) => state.status);
  const mode = useDefralStore((state) => state.mode);
  const degradedReason = useDefralStore((state) => state.degradedReason);
  const position = useDefralStore((state) => state.position);
  const events = useDefralStore((state) => state.events);
  const priceHistory = useDefralStore((state) => state.priceHistory);
  const loadDashboard = useDefralStore((state) => state.loadDashboard);

  useEffect(() => {
    if (status === 'idle') void loadDashboard();
  }, [status, loadDashboard]);

  const derived = position ? deriveDashboard(position) : null;

  return {
    status,
    mode,
    degradedReason,
    position,
    events,
    priceHistory,
    derived,
    reload: loadDashboard,
  };
}

function deriveDashboard(
  position: NonNullable<ReturnType<typeof useDefralStore.getState>['position']>,
): DashboardDerivedView {
  const { collateral, debt, reserve, policy } = position;
  const triggerRatioBps = policy.triggerRatioBps || DEFAULT_GUARD_TRIGGER_BPS;
  const healthRatioBps = computeHealthRatioBps(collateral.quantity, collateral.price, debt);
  const protectionFloorPrice = computeProtectionFloorPrice({
    collateralQty: collateral.quantity,
    debt,
    reserve,
    triggerBps: triggerRatioBps,
  });

  return {
    healthRatioBps,
    triggerRatioBps,
    status: resolveHealthStatus(healthRatioBps, triggerRatioBps),
    defensePrice: computeDefensePrice(collateral.quantity, debt, triggerRatioBps),
    protectionFloorPrice,
    protectionRunwayPct: computeProtectionRunwayPct(collateral.price, protectionFloorPrice),
  };
}
