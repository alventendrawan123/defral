'use client';

import { useId } from 'react';

interface ToggleProps {
  label: string;
  isChecked: boolean;
  isDisabled?: boolean;
  hint?: string;
  onChange: (isChecked: boolean) => void;
}

export function Toggle({ label, isChecked, isDisabled = false, hint, onChange }: ToggleProps) {
  const hintId = useId();

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={isChecked}
          disabled={isDisabled}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onChange(event.target.checked)}
          className="h-5 w-5 shrink-0 accent-accent disabled:cursor-not-allowed disabled:opacity-40"
        />
        <span className={isDisabled ? 'text-ink-muted' : undefined}>{label}</span>
      </label>
      {hint ? (
        <p id={hintId} className="pl-8 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
