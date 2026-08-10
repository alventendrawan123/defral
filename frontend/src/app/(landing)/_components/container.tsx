import { CapabilityMatrix } from './capability-matrix';
import { DefenceWindow } from './defence-window';
import { Hero } from './hero';
import { OutcomeComparison } from './outcome-comparison';

import { CAPABILITY_ROWS } from '@/constants/capabilities';
import { DEFAULT_GUARD_TRIGGER_BPS } from '@/constants/protocol';
import { readArchivedOutcomes } from '@/services/evidenceArchive';
import { MOCK_POSITION } from '@/services/mockData';
import { computeHealthRatioBps } from '@/utils/health';

const OPENING_RATIO_BPS = computeHealthRatioBps(
  MOCK_POSITION.collateral.quantity,
  MOCK_POSITION.collateral.price,
  MOCK_POSITION.debt,
);

export default function Container() {
  const outcomes = readArchivedOutcomes();

  return (
    <div className="flex flex-col gap-16">
      <Hero />
      <CapabilityMatrix rows={CAPABILITY_ROWS} />
      <DefenceWindow
        currentRatioBps={OPENING_RATIO_BPS}
        triggerRatioBps={DEFAULT_GUARD_TRIGGER_BPS}
      />
      <OutcomeComparison rows={outcomes} />
    </div>
  );
}
