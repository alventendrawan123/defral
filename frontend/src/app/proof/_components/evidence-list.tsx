import { AddressPill } from '@/components/ui/AddressPill';
import { ReceiptChip } from '@/components/ui/ReceiptChip';
import { CAPABILITY_COPY } from '@/constants/copy';
import type { ProofEntry } from '@/types';

function EvidenceLink({ entry }: { entry: ProofEntry }) {
  if (entry.transactionLink) {
    return (
      <a
        href={entry.transactionLink}
        target="_blank"
        rel="noopener noreferrer"
        className="w-fit font-mono text-xs underline underline-offset-2"
      >
        open the transaction on BaseScan
      </a>
    );
  }

  return (
    <span className="text-xs text-ink-muted">{CAPABILITY_COPY.noTransactionNote}</span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="break-all font-mono text-xs">{value}</dd>
    </div>
  );
}

function EvidenceCard({ entry }: { entry: ProofEntry }) {
  return (
    <li className="flex flex-col gap-4 rounded-lg border-2 border-line bg-surface p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{entry.title}</h2>
          <p className="max-w-prose text-sm text-ink-muted">{entry.claim}</p>
        </div>
        <ReceiptChip status={entry.receiptStatus} isSponsored={entry.isSponsored} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AddressPill address={entry.caller} label="called by" />
        <AddressPill address={entry.target} label={entry.targetLabel} />
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {entry.contractError ? (
          <Field label="Contract error" value={entry.contractError} />
        ) : null}
        {entry.executionId ? <Field label="executionId" value={entry.executionId} /> : null}
        {entry.blockNumber ? <Field label="Block" value={entry.blockNumber.toString()} /> : null}
        {entry.gasUsed ? <Field label="Gas used" value={entry.gasUsed.toLocaleString('en-US')} /> : null}
      </dl>

      <p className="max-w-prose text-sm">{entry.reading}</p>
      <p className="text-xs text-ink-muted">{entry.callerRole}</p>

      <EvidenceLink entry={entry} />
    </li>
  );
}

export function EvidenceList({ entries }: { entries: ProofEntry[] }) {
  return (
    <ol className="flex flex-col gap-5">
      {entries.map((entry) => (
        <EvidenceCard key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}
