import { ReceiptChip } from '@/components/ui/ReceiptChip';
import { CAPABILITY_COPY, SPONSORED_TX_NOTICE } from '@/constants/copy';
import type { CapabilityEvidence, CapabilityRow } from '@/types';

const ANSWER_CLASS: Record<CapabilityRow['answer'], string> = {
  yes: 'text-safe',
  never: 'text-critical',
};

const ANSWER_LABEL: Record<CapabilityRow['answer'], string> = {
  yes: CAPABILITY_COPY.yes,
  never: CAPABILITY_COPY.never,
};

function EvidenceCell({ evidence }: { evidence: CapabilityEvidence }) {
  if (evidence.kind === 'transaction') {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <a
          href={evidence.transactionLink}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs underline underline-offset-2"
        >
          transaction
        </a>
        <ReceiptChip status={evidence.receiptStatus} isSponsored />
      </span>
    );
  }

  if (evidence.kind === 'absent-from-abi') {
    return (
      <span className="flex flex-col gap-1">
        <span className="font-mono text-xs font-semibold uppercase text-ink">
          {CAPABILITY_COPY.absentLabel}
        </span>
        <span className="text-xs text-ink-muted">{evidence.statement}</span>
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-1">
      <span className="inline-flex w-fit items-center rounded-full border border-defending bg-defending-soft px-2.5 py-0.5 font-mono text-xs text-defending">
        {CAPABILITY_COPY.pendingLabel}
      </span>
      <span className="text-xs text-ink-muted">{evidence.expectedProof}</span>
    </span>
  );
}

function MatrixRow({ row }: { row: CapabilityRow }) {
  return (
    <tr className="border-t border-line-soft align-top">
      <th scope="row" className="px-4 py-4 text-left text-sm font-normal">
        {row.question}
      </th>
      <td className={`whitespace-nowrap px-4 py-4 text-sm font-bold ${ANSWER_CLASS[row.answer]}`}>
        {ANSWER_LABEL[row.answer]}
      </td>
      <td className="px-4 py-4">
        <EvidenceCell evidence={row.evidence} />
      </td>
    </tr>
  );
}

function MatrixCard({ row }: { row: CapabilityRow }) {
  return (
    <li className="rounded-md border border-line-soft bg-surface p-4">
      <p className="text-sm">{row.question}</p>
      <p className={`mt-2 text-sm font-bold ${ANSWER_CLASS[row.answer]}`}>
        {ANSWER_LABEL[row.answer]}
      </p>
      <div className="mt-2">
        <EvidenceCell evidence={row.evidence} />
      </div>
    </li>
  );
}

interface CapabilityMatrixProps {
  rows: CapabilityRow[];
}

export function CapabilityMatrix({ rows }: CapabilityMatrixProps) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">{CAPABILITY_COPY.title}</h2>
        <p className="max-w-prose text-sm text-ink-muted">{CAPABILITY_COPY.body}</p>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border-2 border-line bg-surface shadow-card md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{CAPABILITY_COPY.title}</caption>
          <thead>
            <tr className="bg-surface-sunken">
              <th scope="col" className="px-4 py-3 text-xs uppercase tracking-wide text-ink-muted">
                {CAPABILITY_COPY.questionHeader}
              </th>
              <th scope="col" className="px-4 py-3 text-xs uppercase tracking-wide text-ink-muted">
                {CAPABILITY_COPY.answerHeader}
              </th>
              <th scope="col" className="px-4 py-3 text-xs uppercase tracking-wide text-ink-muted">
                {CAPABILITY_COPY.evidenceHeader}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <MatrixRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <MatrixCard key={row.id} row={row} />
        ))}
      </ul>

      <p className="max-w-prose text-xs text-ink-muted">{SPONSORED_TX_NOTICE}</p>
    </section>
  );
}
