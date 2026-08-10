'use client';

import { ActivityFeed } from './activity-feed';
import { PositionStats } from './position-stats';
import { PriceChart } from './price-chart';
import { SummaryError, SummarySkeleton } from './states';

import { AddressPill } from '@/components/ui/AddressPill';
import { AuthorityBadge } from '@/components/ui/AuthorityBadge';
import { Card } from '@/components/ui/Card';
import { HealthRing } from '@/components/ui/HealthRing';
import {
  SAMPLE_DATA_DEFAULT_REASON,
  SAMPLE_DATA_NOTICE,
  STATUS_CAPTION,
} from '@/constants/copy';
import { useDefralDashboard } from '@/hooks/useDefralDashboard';

export default function Container() {
  const { status, mode, degradedReason, position, events, priceHistory, derived, reload } =
    useDefralDashboard();

  if (status === 'idle' || status === 'loading') return <SummarySkeleton />;
  if (status === 'error' || !position || !derived) return <SummaryError onRetry={reload} />;

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-3xl font-semibold tracking-tight">Your position</h1>

      {mode === 'mock' ? (
        <p className="rounded-md border border-line-soft bg-surface-sunken px-4 py-2 text-sm text-ink-muted">
          {SAMPLE_DATA_NOTICE} {degradedReason ?? SAMPLE_DATA_DEFAULT_REASON}
        </p>
      ) : null}

      <div className="flex flex-col items-center gap-4">
        <HealthRing
          healthRatioBps={derived.healthRatioBps}
          triggerRatioBps={derived.triggerRatioBps}
          status={derived.status}
        />
        <p className="max-w-prose text-center text-sm text-ink-muted">
          {STATUS_CAPTION[derived.status]}
        </p>
      </div>

      <PositionStats position={position} derived={derived} />

      <PriceChart
        points={priceHistory}
        defensePrice={derived.defensePrice}
        protectionFloorPrice={derived.protectionFloorPrice}
      />

      <div className="flex flex-wrap items-center gap-3">
        <AddressPill address={position.owner} label="Borrower" />
        <AddressPill address={position.collateral.address} label={position.collateral.symbol} />
        <AuthorityBadge isRevoked={position.isAgentRevoked} />
      </div>

      <Card title="Defral notes">
        <ActivityFeed events={events} />
      </Card>
    </div>
  );
}
