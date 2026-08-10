import type { DashboardDerivedView } from '@/hooks/useDefralDashboard';
import type { PositionView } from '@/types';
import { formatUsd } from '@/utils/format';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-line-soft bg-surface p-4">
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

interface PositionStatsProps {
  position: PositionView;
  derived: DashboardDerivedView;
}

export function PositionStats({ position, derived }: PositionStatsProps) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Debt" value={formatUsd(position.debt)} />
      <Stat label="Reserve" value={formatUsd(position.reserve)} />
      <Stat label="Defence price" value={formatUsd(derived.defensePrice)} />
      <Stat label="Protection runway" value={`${derived.protectionRunwayPct.toFixed(1)}%`} />
    </dl>
  );
}
