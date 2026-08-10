'use client';

import { Card } from '@/components/ui/Card';

interface StepCollateralProps {
  symbols: string[];
  activeSymbol: string;
  onSelect: (symbol: string) => void;
}

export function StepCollateral({ symbols, activeSymbol, onSelect }: StepCollateralProps) {
  return (
    <Card title="Pick collateral" description="Both instruments are guarded by the same engine.">
      <div className="flex flex-wrap gap-2">
        {symbols.map((symbol) => (
          <button
            key={symbol}
            type="button"
            aria-pressed={symbol === activeSymbol}
            onClick={() => onSelect(symbol)}
            className={`rounded-md border-2 px-4 py-2 text-sm font-medium ${
              symbol === activeSymbol
                ? 'border-line bg-ink text-paper'
                : 'border-line-soft bg-surface'
            }`}
          >
            {symbol}
          </button>
        ))}
      </div>
    </Card>
  );
}
