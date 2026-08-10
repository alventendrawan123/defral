'use client';

import { useId } from 'react';

import { Toggle } from '@/components/ui/Toggle';
import { VAULT_COPY } from '@/constants/copy';
import { MAX_GUARD_TRIGGER_BPS, MIN_GUARD_TRIGGER_BPS } from '@/constants/protocol';
import type { CollateralView, GuardPolicy } from '@/types';
import { formatBps } from '@/utils/format';

interface PolicyControlsProps {
  collateral: CollateralView;
  policy: GuardPolicy;
  isAgentRevoked: boolean;
  onTriggerChange: (triggerRatioBps: number) => void;
  onSweepChange: (isEnabled: boolean) => void;
  onRevoke: () => void;
}

export function PolicyControls({
  collateral,
  policy,
  isAgentRevoked,
  onTriggerChange,
  onSweepChange,
  onRevoke,
}: PolicyControlsProps) {
  const triggerId = useId();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor={triggerId} className="text-sm font-medium">
          {VAULT_COPY.triggerLabel}
        </label>
        <input
          id={triggerId}
          type="range"
          min={MIN_GUARD_TRIGGER_BPS}
          max={MAX_GUARD_TRIGGER_BPS}
          step={100}
          value={policy.triggerRatioBps}
          disabled={isAgentRevoked}
          onChange={(event) => onTriggerChange(Number(event.target.value))}
          className="w-full max-w-md accent-accent disabled:cursor-not-allowed disabled:opacity-40"
        />
        <p className="font-mono text-sm tabular-nums">{formatBps(policy.triggerRatioBps)}</p>
        <p className="text-xs text-ink-muted">{VAULT_COPY.triggerHint}</p>
      </div>

      <Toggle
        label={VAULT_COPY.sweepLabel}
        isChecked={policy.isCouponSweepEnabled}
        isDisabled={!collateral.paysYield || isAgentRevoked}
        hint={collateral.paysYield ? undefined : VAULT_COPY.sweepUnavailable}
        onChange={onSweepChange}
      />

      {isAgentRevoked ? (
        <p role="status" className="text-sm font-medium text-critical">
          {VAULT_COPY.revokedNotice}
        </p>
      ) : (
        <button
          type="button"
          onClick={onRevoke}
          className="w-fit rounded-md border-2 border-critical bg-surface px-4 py-2 text-sm font-medium text-critical transition-shadow duration-200 ease-out hover:shadow-card"
        >
          {VAULT_COPY.revokeLabel}
        </button>
      )}
    </div>
  );
}
