'use client';

interface CollateralSwitchProps {
  symbols: string[];
  activeSymbol: string;
  onSelect: (symbol: string) => void;
}

export function CollateralSwitch({ symbols, activeSymbol, onSelect }: CollateralSwitchProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Collateral">
      {symbols.map((symbol) => (
        <button
          key={symbol}
          type="button"
          aria-pressed={symbol === activeSymbol}
          onClick={() => onSelect(symbol)}
          className={`rounded-md border-2 px-4 py-2 text-sm font-medium transition-shadow duration-200 ease-out ${
            symbol === activeSymbol
              ? 'border-line bg-ink text-paper'
              : 'border-line-soft bg-surface hover:shadow-card'
          }`}
        >
          {symbol}
        </button>
      ))}
    </div>
  );
}
