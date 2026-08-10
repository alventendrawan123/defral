import { describe, expect, it } from 'vitest';

import { CAPABILITY_ROWS } from '@/constants/capabilities';

describe('capability matrix', () => {
  it('keeps every question the plan pins', () => {
    expect(CAPABILITY_ROWS).toHaveLength(8);
  });

  it('gives every row a unique id', () => {
    expect(new Set(CAPABILITY_ROWS.map((row) => row.id)).size).toBe(CAPABILITY_ROWS.length);
  });

  it('never leaves a row without evidence', () => {
    const empty = CAPABILITY_ROWS.filter((row) => {
      if (row.evidence.kind === 'transaction') return row.evidence.transactionLink.length === 0;
      if (row.evidence.kind === 'absent-from-abi') return row.evidence.statement.length === 0;
      return row.evidence.expectedProof.length === 0;
    });
    expect(empty).toEqual([]);
  });

  it('states that withdrawing the reserve has no function at all', () => {
    const row = CAPABILITY_ROWS.find((candidate) => candidate.id === 'withdraw-reserve');
    expect(row?.answer).toBe('never');
    expect(row?.evidence.kind).toBe('absent-from-abi');
  });

  it('never answers yes to a refusal row', () => {
    const refusals = ['repay-healthy', 'stale-oracle', 'double-fire', 'after-revoke'];
    refusals.forEach((id) => {
      expect(CAPABILITY_ROWS.find((row) => row.id === id)?.answer).toBe('never');
    });
  });
});
