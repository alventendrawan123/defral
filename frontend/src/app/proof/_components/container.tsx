import { EvidenceList } from './evidence-list';

import {
  PROOF_COPY,
  REFUSAL_DISCLOSURE,
  REHEARSAL_DISCLOSURE,
  SPONSORED_TX_NOTICE,
} from '@/constants/copy';
import { readArchiveSourceFiles, readProofArchiveLive } from '@/services/evidenceArchive';

export default async function Container() {
  const entries = await readProofArchiveLive();
  const sourceFiles = readArchiveSourceFiles();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{PROOF_COPY.title}</h1>
        <p className="max-w-prose text-ink-muted">{PROOF_COPY.body}</p>
      </header>

      <EvidenceList entries={entries} />

      <section className="flex flex-col gap-2 border-t border-line-soft pt-6">
        <p className="max-w-prose text-xs text-ink-muted">{REFUSAL_DISCLOSURE}</p>
        <p className="max-w-prose text-xs text-ink-muted">{REHEARSAL_DISCLOSURE}</p>
        <p className="max-w-prose text-xs text-ink-muted">{SPONSORED_TX_NOTICE}</p>
        <p className="max-w-prose text-xs text-ink-muted">
          Every entry above is derived from files committed to this repository:{' '}
          {sourceFiles.join(', ')}.
        </p>
      </section>
    </div>
  );
}
