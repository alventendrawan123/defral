import type { HealthStatus, ReceiptStatus } from '@/types';

export const STATUS_LABEL: Record<HealthStatus, string> = {
  safe: 'Protected',
  defending: 'Defending',
  critical: 'Needs action',
};

export const STATUS_CAPTION: Record<HealthStatus, string> = {
  safe: 'I check every price observation. Healthy. No action taken.',
  defending: 'Price entered the defence window. I repaid part of your debt from your reserve.',
  critical: 'Anyone can seize this position now. Your reserve no longer covers it.',
};

export const RECEIPT_LABEL: Record<ReceiptStatus, string> = {
  verified: 'verified',
  reverted: 'reverted',
  unconfirmed: 'unconfirmed',
};

export const GRACE_PERIOD_CAPTION =
  'Below the protection floor I open a grace period, not a fire sale. There is no forced liquidation here.';

export const SPONSORED_TX_NOTICE =
  'This transaction is sponsored: the From column on the explorer is the KeeperHub relayer, our action runs as an internal call. Open the Logs tab to see it.';

export const PUBLIC_LEDGER_NOTICE =
  'Base Sepolia is public. Every storage slot and every event log on this page is readable by anyone.';

export const NON_CUSTODY_STATEMENT =
  'No such function. We never hold your reserve.';

export const DEFENCE_WINDOW_LEGEND = {
  position: 'your position right now',
  trigger: 'Guard Trigger. The agent acts below this line.',
  window: 'DEFENCE WINDOW. The reserve has one job: keeping you out of here.',
  liquidation: 'LIQUIDATION. Anyone may seize your collateral.',
} as const;

export const BANNED_CLAIM_TERMS = [
  'private',
  'hidden',
  'invisible',
  'encrypted',
  'confidential',
  'shadow',
  'auto-rebalancing',
] as const;

export const EMPTY_STATE_COPY = {
  events: {
    title: 'No notes yet',
    body: 'I have not needed to act. The moment price reaches the defence window, the note shows up here.',
  },
  executions: {
    title: 'No archived executions yet',
    body: 'The proof page reads the JSON archive committed in this repo, not a live API.',
  },
} as const;

export const ERROR_STATE_COPY = {
  title: 'Position data could not be read',
  body: 'The backend did not answer. You can still walk through the whole story on sample data.',
  retryLabel: 'Try again',
} as const;

export const GLOBAL_ERROR_COPY = {
  title: 'Defral could not render',
  body: 'Something broke below the root layout, so the whole page stopped. Nothing about your position changed: the agent runs onchain, not in this browser.',
  retryLabel: 'Reload the page',
  digestLabel: 'Error reference',
} as const;

export const SAMPLE_DATA_NOTICE = 'Sample data mode is active.';
export const SAMPLE_DATA_DEFAULT_REASON = 'No backend is configured.';

export const HERO_COPY = {
  eyebrow: 'Autonomous deleveraging on Base Sepolia',
  title: 'It never becomes a liquidation.',
  body: 'Your reserve stays in your wallet. The agent has two zero argument calls and the contract refuses both while your position is healthy. You slept through it.',
  primaryAction: 'Open the dashboard',
  secondaryAction: 'Read the proof',
} as const;

export const CAPABILITY_COPY = {
  title: 'What the agent can and cannot do',
  body: 'Every row below ends in a transaction you can open yourself, or in a function that does not exist in the ABI. A reverted transaction is still a transaction: it has a hash, it burned gas, and it is permanent.',
  questionHeader: 'Can the agent',
  answerHeader: 'Answer',
  evidenceHeader: 'Evidence',
  yes: 'YES',
  never: 'NEVER',
  pendingLabel: 'awaiting deployment',
  absentLabel: 'no such function',
} as const;

export const OUTCOME_COPY = {
  title: 'The same price move, two positions',
  body: 'One position is guarded, the other is not. Both watch the same oracle round. Open both transactions and compare what is left.',
  guardedLabel: 'With Defral',
  unguardedLabel: 'Without Defral',
  rescued: 'Rescued',
  liquidated: 'Liquidated',
} as const;

export const PROOF_COPY = {
  title: 'Proof archive',
  body: 'This page reads a JSON archive committed to the repository, not a live API. It keeps working even if the execution logs expire.',
  simulateHeader: 'Simulate',
  broadcastHeader: 'Broadcast',
  refusedLabel: 'refused as designed',
} as const;

export const VAULT_COPY = {
  title: 'Reserve and policy',
  body: 'Setting your reserve is an approve. Lowering it is how you take it back. We never hold it.',
  triggerLabel: 'Guard Trigger',
  triggerHint: 'The agent acts below this ratio.',
  sweepLabel: 'Coupon sweep',
  sweepUnavailable: 'This instrument pays no yield, so the sweep does not apply.',
  revokeLabel: 'Revoke agent authority',
  revokedNotice: 'Authority revoked. Your money can now only move to you.',
} as const;

export const AUTHORITY_COPY = {
  granted: 'GUARD_ROLE only',
  revoked: 'Revoked',
} as const;

