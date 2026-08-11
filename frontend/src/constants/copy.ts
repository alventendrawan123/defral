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

export const REHEARSAL_DISCLOSURE =
  'This defence ran on an identical rehearsal position. Defending the demo position would permanently lower its debt, and a position can only be opened once, so we left it untouched for you to inspect.';

export const REFUSAL_DISCLOSURE =
  'KeeperHub declines to broadcast a call it predicts will revert, so an agent refusal has no transaction hash. What you get instead is the execution record, carrying the decoded custom error the contract itself returned.';

export const AGENT_KEY_FRAMING =
  'Our organisation owner can export the agent key, and it changes nothing. The vault accepts exactly two zero argument calls, both re-read the oracle inside the same transaction, and both refuse while the position is healthy.';

export const POSTURE_COPY = {
  'idle-healthy': {
    label: 'Armed and idle',
    body: 'Nothing to pay. The position is above your trigger, so the contract would refuse the agent right now.',
  },
  'would-defend': {
    label: 'Would defend now',
    body: 'The position is inside the defence window. This is what the contract would repay from your reserve.',
  },
  'oracle-stale': {
    label: 'Price is stale',
    body: 'The freshness gate is closed, so the contract would refuse to act on this price at all. That is the gate working, not a fault.',
  },
  revoked: {
    label: 'Authority revoked',
    body: 'You revoked the agent. Your money can now only move to you.',
  },
} as const;

export const SNAPSHOT_NOTICE =
  'The live node did not answer, so this is the committed snapshot. Every figure below was read from the chain at the block shown.';

export const NOTHING_TO_PAY = 'Nothing to pay';

export const DEFRAL_NOTE =
  'Every figure here was read from the vault contract on Base Sepolia. I do not recompute them, because the contract is the one that decides.';

export const CAPABILITY_COPY = {
  title: 'What the agent can and cannot do',
  body: 'Every row ends in evidence you can check: a mined transaction, an execution record carrying the error the contract returned, or a function that does not exist in the ABI at all.',
  questionHeader: 'Can the agent',
  answerHeader: 'Answer',
  evidenceHeader: 'Evidence',
  yes: 'YES',
  never: 'NEVER',
  absentLabel: 'no such function',
  executionRecordLabel: 'execution record',
  rehearsalLabel: 'rehearsal vault',
  noTransactionNote: 'no transaction exists for this refusal',
} as const;

export const OUTCOME_COPY = {
  title: 'Two mined transactions, opposite outcomes',
  body: 'The agent defended a position and it landed. The address that deployed this entire system asked the same vault to move, and it was refused. Both are on Base Sepolia and both are permanent.',
  defended: 'Defended',
  refused: 'Refused',
} as const;

export const PROOF_COPY = {
  title: 'Proof archive',
  body: 'This page reads a JSON archive committed to the repository, not a live API. It keeps working even if the execution logs expire.',
  simulateHeader: 'Simulate',
  broadcastHeader: 'Broadcast',
  refusedLabel: 'refused as designed',
} as const;

export const RESERVE_EXPLAINER =
  'Your reserve is min(balance, allowance), and it sits in your own wallet. Setting it is an approve, and lowering that approval is how you take it back. The vault has no function that could move it anywhere else.';

export const VAULT_COPY = {
  title: 'Reserve and policy',
  body: 'These values are read from the vault on Base Sepolia. Changing them is a transaction you sign from your own wallet, so this page shows them rather than pretending to set them.',
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

