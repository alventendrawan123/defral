import { describe, expect, it } from 'vitest';

import { readArchivedExecutions, readArchivedOutcomes } from '@/services/evidenceArchive';

describe('committed evidence archive', () => {
  it('parses every archived execution', () => {
    expect(readArchivedExecutions().length).toBeGreaterThan(0);
  });

  it('records a revert reason whenever a simulate would revert', () => {
    const missing = readArchivedExecutions().filter(
      (execution) => execution.wouldRevert && !execution.revertReason,
    );
    expect(missing).toEqual([]);
  });

  it('carries both sides of the liquidation comparison', () => {
    const outcomes = readArchivedOutcomes();
    expect(outcomes.filter((outcome) => outcome.isGuarded)).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome.isGuarded)).toHaveLength(1);
  });

  it('shows a seizure only on the unguarded side', () => {
    const outcomes = readArchivedOutcomes();
    expect(outcomes.find((outcome) => outcome.isGuarded)?.collateralSeized).toBeNull();
    expect(outcomes.find((outcome) => !outcome.isGuarded)?.outcome).toBe('liquidated');
  });
});
