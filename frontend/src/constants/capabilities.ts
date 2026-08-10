import { NON_CUSTODY_STATEMENT } from '@/constants/copy';
import type { CapabilityRow } from '@/types';

export const CAPABILITY_ROWS: CapabilityRow[] = [
  {
    id: 'read-health',
    question: 'Read your health ratio',
    answer: 'yes',
    evidence: { kind: 'pending', expectedProof: 'health read transaction' },
  },
  {
    id: 'repay-unhealthy',
    question: 'Repay your debt from your reserve while the position is UNHEALTHY',
    answer: 'yes',
    evidence: { kind: 'pending', expectedProof: 'guardRepay success transaction' },
  },
  {
    id: 'repay-healthy',
    question: 'Repay while the position is HEALTHY',
    answer: 'never',
    evidence: { kind: 'pending', expectedProof: 'reverted transaction, Refused_Healthy' },
  },
  {
    id: 'stale-oracle',
    question: 'Act on a stale oracle round',
    answer: 'never',
    evidence: { kind: 'pending', expectedProof: 'reverted transaction, Refused_StaleOracle' },
  },
  {
    id: 'double-fire',
    question: 'Act twice inside the same price round',
    answer: 'never',
    evidence: { kind: 'pending', expectedProof: 'reverted transaction, Refused_AlreadyActed' },
  },
  {
    id: 'after-revoke',
    question: 'Act after you revoke it',
    answer: 'never',
    evidence: { kind: 'pending', expectedProof: 'reverted transaction, Refused_AgentRevoked' },
  },
  {
    id: 'redirect-reserve',
    question: 'Send your reserve to any other address',
    answer: 'never',
    evidence: {
      kind: 'absent-from-abi',
      statement: 'No such function. The ABI exposes two zero argument calls and neither takes a recipient.',
    },
  },
  {
    id: 'withdraw-reserve',
    question: 'Withdraw your reserve',
    answer: 'never',
    evidence: { kind: 'absent-from-abi', statement: NON_CUSTODY_STATEMENT },
  },
];
