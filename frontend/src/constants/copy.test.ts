import { describe, expect, it } from 'vitest';

import * as copy from '@/constants/copy';
import { BANNED_CLAIM_TERMS } from '@/constants/copy';

function collectStrings(value: unknown, sink: string[]): string[] {
  if (typeof value === 'string') sink.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, sink));
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, sink));
  }
  return sink;
}

const { BANNED_CLAIM_TERMS: _terms, ...userFacingCopy } = copy;
const USER_FACING_STRINGS = collectStrings(userFacingCopy, []);

describe('user facing copy', () => {
  it('exposes strings to check', () => {
    expect(USER_FACING_STRINGS.length).toBeGreaterThan(0);
  });

  it.each(BANNED_CLAIM_TERMS)('never claims "%s"', (term) => {
    const offenders = USER_FACING_STRINGS.filter((text) =>
      text.toLowerCase().includes(term.toLowerCase()),
    );
    expect(offenders).toEqual([]);
  });

  it('never uses an em dash', () => {
    expect(USER_FACING_STRINGS.filter((text) => text.includes('—'))).toEqual([]);
  });

  it('keeps the grace period sentence in first person', () => {
    expect(copy.GRACE_PERIOD_CAPTION).toContain('grace period');
    expect(copy.GRACE_PERIOD_CAPTION).toMatch(/\bI\b/);
  });

  it('states that the ledger is public', () => {
    expect(copy.PUBLIC_LEDGER_NOTICE.toLowerCase()).toContain('public');
  });
});
