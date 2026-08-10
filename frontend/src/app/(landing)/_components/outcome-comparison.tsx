import { OUTCOME_COPY } from '@/constants/copy';
import type { OutcomeComparisonRow, PositionOutcome } from '@/types';
import { formatBps, formatUsd } from '@/utils/format';

const OUTCOME_CLASS: Record<PositionOutcome, string> = {
  rescued: 'border-safe bg-safe-soft text-safe',
  liquidated: 'border-critical bg-critical-soft text-critical',
};

const OUTCOME_LABEL: Record<PositionOutcome, string> = {
  rescued: OUTCOME_COPY.rescued,
  liquidated: OUTCOME_COPY.liquidated,
};

function OutcomeCard({ row }: { row: OutcomeComparisonRow }) {
  const amount = row.outcome === 'rescued' ? row.amountRepaid : row.collateralSeized;
  const amountLabel = row.outcome === 'rescued' ? 'Repaid from reserve' : 'Collateral seized';

  return (
    <article className="flex flex-col gap-4 rounded-lg border-2 border-line bg-surface p-6 shadow-card">
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-ink-muted">
          {row.isGuarded ? OUTCOME_COPY.guardedLabel : OUTCOME_COPY.unguardedLabel}
        </span>
        <span
          className={`w-fit rounded-full border px-3 py-1 font-mono text-sm font-semibold ${OUTCOME_CLASS[row.outcome]}`}
        >
          {OUTCOME_LABEL[row.outcome]}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-ink-muted">Opening ratio</dt>
          <dd className="font-semibold tabular-nums">{formatBps(row.openingRatioBps)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Stress price</dt>
          <dd className="font-semibold tabular-nums">{formatUsd(row.stressPrice)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-ink-muted">{amountLabel}</dt>
          <dd className="font-semibold tabular-nums">
            {amount === null ? 'none' : formatUsd(amount)}
          </dd>
        </div>
      </dl>

      <p className="text-sm text-ink-muted">{row.note}</p>

      {row.transactionLink ? (
        <a
          href={row.transactionLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit font-mono text-xs underline underline-offset-2"
        >
          open the transaction
        </a>
      ) : (
        <span className="w-fit rounded-full border border-defending bg-defending-soft px-2.5 py-0.5 font-mono text-xs text-defending">
          awaiting deployment
        </span>
      )}
    </article>
  );
}

interface OutcomeComparisonProps {
  rows: OutcomeComparisonRow[];
}

export function OutcomeComparison({ rows }: OutcomeComparisonProps) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">{OUTCOME_COPY.title}</h2>
        <p className="max-w-prose text-sm text-ink-muted">{OUTCOME_COPY.body}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <OutcomeCard key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}
