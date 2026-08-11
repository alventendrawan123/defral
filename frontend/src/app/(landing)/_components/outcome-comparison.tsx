import { AddressPill } from '@/components/ui/AddressPill';
import { OUTCOME_COPY } from '@/constants/copy';
import type { ProofEntry } from '@/types';

function OutcomeCard({ entry }: { entry: ProofEntry }) {
  const isRefusal = entry.receiptStatus === 'reverted';

  return (
    <article className="flex flex-col gap-4 rounded-lg border-2 border-line bg-surface p-6 shadow-card">
      <span
        className={`w-fit rounded-full border px-3 py-1 font-mono text-sm font-semibold ${
          isRefusal
            ? 'border-critical bg-critical-soft text-critical'
            : 'border-safe bg-safe-soft text-safe'
        }`}
      >
        {isRefusal ? OUTCOME_COPY.refused : OUTCOME_COPY.defended}
      </span>

      <h3 className="text-base font-semibold">{entry.title}</h3>
      <p className="text-sm text-ink-muted">{entry.reading}</p>

      {entry.contractError ? (
        <p className="font-mono text-xs font-semibold text-critical">{entry.contractError}</p>
      ) : null}

      <AddressPill address={entry.caller} label="called by" />

      {entry.transactionLink ? (
        <a
          href={entry.transactionLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit font-mono text-xs underline underline-offset-2"
        >
          open the transaction
        </a>
      ) : null}
    </article>
  );
}

export function OutcomeComparison({ entries }: { entries: ProofEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">{OUTCOME_COPY.title}</h2>
        <p className="max-w-prose text-sm text-ink-muted">{OUTCOME_COPY.body}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {entries.map((entry) => (
          <OutcomeCard key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  );
}
