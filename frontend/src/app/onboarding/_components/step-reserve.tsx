'use client';

import { Card } from '@/components/ui/Card';

interface StepReserveProps {
  reserve: number;
  onChange: (reserve: number) => void;
}

export function StepReserve({ reserve, onChange }: StepReserveProps) {
  return (
    <Card title="Set reserve" description="This is an approve. The money stays in your wallet.">
      <input
        aria-label="Reserve amount"
        type="number"
        min={0}
        step="0.01"
        value={reserve}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-48 rounded-md border-2 border-line-soft bg-surface px-3 py-2 text-sm tabular-nums"
      />
    </Card>
  );
}
