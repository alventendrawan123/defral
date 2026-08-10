'use client';

import { Card } from '@/components/ui/Card';
import { formatBps, formatUsd } from '@/utils/format';

interface StepBorrowProps {
  debt: number;
  maxDebt: number;
  ratioBps: number;
  triggerRatioBps: number;
  onChange: (debt: number) => void;
}

export function StepBorrow({
  debt,
  maxDebt,
  ratioBps,
  triggerRatioBps,
  onChange,
}: StepBorrowProps) {
  return (
    <Card
      title="Borrow"
      description={`Capped so the opening ratio stays at or above ${formatBps(triggerRatioBps)}.`}
    >
      <label htmlFor="borrow-amount" className="text-sm font-medium">
        Amount
      </label>
      <input
        id="borrow-amount"
        type="range"
        min={0}
        max={maxDebt}
        step={10}
        value={debt}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full max-w-md accent-accent"
      />
      <p className="mt-2 font-mono text-sm tabular-nums">
        {formatUsd(debt)} of {formatUsd(maxDebt)} available
      </p>
      <p className="text-xs text-ink-muted">Opening ratio {formatBps(ratioBps)}</p>
    </Card>
  );
}
