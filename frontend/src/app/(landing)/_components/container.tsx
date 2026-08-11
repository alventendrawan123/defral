import { CapabilityMatrix } from './capability-matrix';
import { DefenceWindow } from './defence-window';
import { Hero } from './hero';
import { OutcomeComparison } from './outcome-comparison';

import { CAPABILITY_ROWS } from '@/constants/capabilities';
import { AGENT_KEY_FRAMING } from '@/constants/copy';
import { readCommittedSnapshot } from '@/services/chain/snapshot';
import { readProofArchive } from '@/services/evidenceArchive';

const MINED_TRANSACTION_IDS = ['guard-repay-success', 'not-agent'];

export default function Container() {
  const snapshot = readCommittedSnapshot();
  const minedPair = readProofArchive().filter((entry) =>
    MINED_TRANSACTION_IDS.includes(entry.id),
  );

  return (
    <div className="flex flex-col gap-16">
      <Hero />

      <CapabilityMatrix rows={CAPABILITY_ROWS} />

      <DefenceWindow
        currentRatioBps={snapshot.healthRatioBps}
        triggerRatioBps={snapshot.position.triggerBps}
        liquidationBps={snapshot.liquidationBps}
      />

      <OutcomeComparison entries={minedPair} />

      <p className="max-w-prose text-sm text-ink-muted">{AGENT_KEY_FRAMING}</p>
    </div>
  );
}
