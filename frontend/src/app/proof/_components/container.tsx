import { EvidenceList } from './evidence-list';

import { PROOF_COPY, SPONSORED_TX_NOTICE } from '@/constants/copy';
import { readArchivedExecutions } from '@/services/evidenceArchive';

export default function Container() {
  const executions = readArchivedExecutions();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{PROOF_COPY.title}</h1>
        <p className="max-w-prose text-ink-muted">{PROOF_COPY.body}</p>
        <p className="max-w-prose text-xs text-ink-muted">{SPONSORED_TX_NOTICE}</p>
      </header>

      <EvidenceList executions={executions} />
    </div>
  );
}
