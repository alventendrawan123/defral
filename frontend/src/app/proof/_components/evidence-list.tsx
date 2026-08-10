import { ReceiptChip } from '@/components/ui/ReceiptChip';
import { EMPTY_STATE_COPY, PROOF_COPY } from '@/constants/copy';
import type { ExecutionView } from '@/types';

function SimulateCell({ execution }: { execution: ExecutionView }) {
  if (!execution.wouldRevert) {
    return <span className="font-mono text-xs text-ink-muted">wouldRevert: false</span>;
  }

  return (
    <span className="flex flex-col gap-1">
      <span className="font-mono text-xs text-ink-muted">wouldRevert: true</span>
      <span className="font-mono text-xs font-semibold text-critical">
        {execution.revertReason}
      </span>
      <span className="text-xs text-ink-muted">{PROOF_COPY.refusedLabel}</span>
    </span>
  );
}

function EvidenceRow({ execution }: { execution: ExecutionView }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border-2 border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{execution.attackName}</h3>
        <ReceiptChip status={execution.receiptStatus} isSponsored={execution.isSponsored} />
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-muted">executionId</dt>
          <dd className="break-all font-mono text-xs">{execution.executionId}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-muted">Idempotency-Key</dt>
          <dd className="break-all font-mono text-xs">{execution.idempotencyKey}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-muted">
            {PROOF_COPY.simulateHeader}
          </dt>
          <dd>
            <SimulateCell execution={execution} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-muted">
            {PROOF_COPY.broadcastHeader}
          </dt>
          <dd className="flex flex-col gap-1">
            <span className="font-mono text-xs tabular-nums text-ink-muted">
              gasUsed: {execution.gasUsed ?? 'n/a'}
            </span>
            {execution.transactionLink ? (
              <a
                href={execution.transactionLink}
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
          </dd>
        </div>
      </dl>
    </li>
  );
}

interface EvidenceListProps {
  executions: ExecutionView[];
}

export function EvidenceList({ executions }: EvidenceListProps) {
  if (executions.length === 0) {
    return (
      <div className="rounded-md border border-line-soft bg-surface p-4">
        <h3 className="text-sm font-semibold">{EMPTY_STATE_COPY.executions.title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{EMPTY_STATE_COPY.executions.body}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {executions.map((execution) => (
        <EvidenceRow key={execution.executionId} execution={execution} />
      ))}
    </ul>
  );
}
