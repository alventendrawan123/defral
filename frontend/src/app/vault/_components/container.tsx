'use client';

import { CollateralSwitch } from './collateral-switch';
import { PolicyControls } from './policy-controls';
import { ReserveForm } from './reserve-form';

import { Card } from '@/components/ui/Card';
import { ERROR_STATE_COPY, VAULT_COPY } from '@/constants/copy';
import { useDefralDashboard } from '@/hooks/useDefralDashboard';
import { MOCK_POSITIONS } from '@/services/mockData';
import { useDefralStore } from '@/stores/useDefralStore';

const COLLATERAL_SYMBOLS = Object.keys(MOCK_POSITIONS);

export default function Container() {
  const { status, position, reload } = useDefralDashboard();
  const selectCollateral = useDefralStore((state) => state.selectCollateral);
  const setGuardTrigger = useDefralStore((state) => state.setGuardTrigger);
  const setCouponSweep = useDefralStore((state) => state.setCouponSweep);
  const setReserve = useDefralStore((state) => state.setReserve);
  const revokeAgent = useDefralStore((state) => state.revokeAgent);

  if (status === 'idle' || status === 'loading') {
    return <div aria-busy="true" className="h-64 animate-pulse rounded-lg bg-surface-sunken" />;
  }

  if (!position) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-sm text-ink-muted">{ERROR_STATE_COPY.body}</p>
        <button
          type="button"
          onClick={reload}
          className="rounded-md border-2 border-line bg-surface px-4 py-2 text-sm font-medium"
        >
          {ERROR_STATE_COPY.retryLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">Reserve and policy</h1>

      <CollateralSwitch
        symbols={COLLATERAL_SYMBOLS}
        activeSymbol={position.collateral.symbol}
        onSelect={selectCollateral}
      />

      <Card title={VAULT_COPY.title} description={VAULT_COPY.body}>
        <ReserveForm reserve={position.reserve} onApprove={setReserve} />
      </Card>

      <Card title="Defence policy">
        <PolicyControls
          collateral={position.collateral}
          policy={position.policy}
          isAgentRevoked={position.isAgentRevoked}
          onTriggerChange={setGuardTrigger}
          onSweepChange={setCouponSweep}
          onRevoke={revokeAgent}
        />
      </Card>
    </div>
  );
}
