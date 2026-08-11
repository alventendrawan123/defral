import { NON_CUSTODY_STATEMENT } from '@/constants/copy';
import type { CapabilityRow } from '@/types';

const GUARD_REPAY_TX =
  'https://sepolia.basescan.org/tx/0xb8f47a89115841e5d0176fd6cd3a0d8d9ec1141baaafde37c4ad11afb3a46c9e';
const NOT_AGENT_TX =
  'https://sepolia.basescan.org/tx/0xb6a01688e55ebb71713a01c02b46318b6a71039bc79e155d1fd90e957700139d';

export const CAPABILITY_ROWS: CapabilityRow[] = [
  {
    id: 'read-health',
    question: 'Read your health ratio',
    answer: 'yes',
    evidence: {
      kind: 'absent-from-abi',
      statement:
        'healthRatioBps() is a public view. The number on this page was read from it, and you can read it yourself.',
    },
  },
  {
    id: 'repay-unhealthy',
    question: 'Repay your debt from your reserve while the position is UNHEALTHY',
    answer: 'yes',
    evidence: {
      kind: 'transaction',
      transactionLink: GUARD_REPAY_TX,
      receiptStatus: 'verified',
      onRehearsalVault: true,
    },
  },
  {
    id: 'repay-healthy',
    question: 'Repay while the position is HEALTHY',
    answer: 'never',
    evidence: {
      kind: 'execution-record',
      executionId: 'yjh4l0m4d9jgy7qtt6g6r',
      contractError: 'Refused_Healthy(16667, 13000)',
    },
  },
  {
    id: 'double-fire',
    question: 'Act twice inside the same oracle round',
    answer: 'never',
    evidence: {
      kind: 'execution-record',
      executionId: 'fh8e4y796hirzz6woa0pj',
      contractError: 'Refused_AlreadyActed(2)',
    },
  },
  {
    id: 'sweep-without-coupon',
    question: 'Sweep a coupon that has not accrued',
    answer: 'never',
    evidence: {
      kind: 'execution-record',
      executionId: '1ewhomgsu2j8grqchsule',
      contractError: 'Refused_NoCouponDue',
    },
  },
  {
    id: 'called-by-anyone-else',
    question: 'Be driven by anyone other than the agent, including the system deployer',
    answer: 'never',
    evidence: {
      kind: 'transaction',
      transactionLink: NOT_AGENT_TX,
      receiptStatus: 'reverted',
      onRehearsalVault: false,
    },
  },
  {
    id: 'redirect-reserve',
    question: 'Send your reserve to any other address',
    answer: 'never',
    evidence: {
      kind: 'absent-from-abi',
      statement:
        'No such function. The agent surface is exactly two calls, guardRepay and sweepCoupon, and neither takes an argument, so neither can name a recipient.',
    },
  },
  {
    id: 'withdraw-reserve',
    question: 'Withdraw your reserve',
    answer: 'never',
    evidence: { kind: 'absent-from-abi', statement: NON_CUSTODY_STATEMENT },
  },
];
