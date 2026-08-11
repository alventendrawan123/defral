import { describe, expect, it } from 'vitest';

import { readArchiveSourceFiles, readProofArchive } from '@/services/evidenceArchive';

const entries = readProofArchive();

describe('committed proof archive', () => {
  it('parses and is not empty', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('leads with the deployer being refused, the strongest authority claim', () => {
    expect(entries[0].id).toBe('not-agent');
    expect(entries[0].contractError).toContain('NotAgent');
    expect(entries[0].transactionLink).not.toBeNull();
  });

  it('never offers a transaction link for an agent refusal', () => {
    const linkedRecords = entries.filter(
      (entry) => entry.kind === 'execution-record' && entry.transactionLink !== null,
    );
    expect(linkedRecords).toEqual([]);
  });

  it('gives every execution record its executionId and decoded error', () => {
    entries
      .filter((entry) => entry.kind === 'execution-record')
      .forEach((entry) => {
        expect(entry.executionId).toBeTruthy();
        expect(entry.contractError).toBeTruthy();
      });
  });

  it('gives every mined transaction a block number', () => {
    entries
      .filter((entry) => entry.kind === 'transaction')
      .forEach((entry) => {
        expect(entry.blockNumber).toBeGreaterThan(0);
      });
  });

  it('discloses which vault each entry ran against', () => {
    entries.forEach((entry) => {
      expect(entry.targetLabel).toMatch(/demo vault|rehearsal vault/);
    });
  });

  it('names the committed files every entry was derived from', () => {
    expect(readArchiveSourceFiles().every((file) => file.startsWith('docs/evidence/'))).toBe(true);
  });
});
