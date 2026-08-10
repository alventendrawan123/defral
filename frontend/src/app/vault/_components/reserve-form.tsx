'use client';

import { useState } from 'react';

import { formatUsd } from '@/utils/format';

interface ReserveFormProps {
  reserve: number;
  onApprove: (amount: number) => void;
}

export function ReserveForm({ reserve, onApprove }: ReserveFormProps) {
  const [draft, setDraft] = useState(String(reserve));

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = Number(draft);
        if (Number.isFinite(parsed)) onApprove(parsed);
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="reserve-amount" className="text-sm font-medium">
          Reserve allowance
        </label>
        <input
          id="reserve-amount"
          type="number"
          min={0}
          step="0.01"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="w-48 rounded-md border-2 border-line-soft bg-surface px-3 py-2 text-sm tabular-nums"
        />
      </div>
      <button
        type="submit"
        className="rounded-md border-2 border-line bg-surface px-4 py-2 text-sm font-medium transition-shadow duration-200 ease-out hover:shadow-card"
      >
        Approve
      </button>
      <p className="text-xs text-ink-muted">Currently {formatUsd(reserve)}</p>
    </form>
  );
}
