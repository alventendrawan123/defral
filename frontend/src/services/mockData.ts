import { DEFAULT_GUARD_TRIGGER_BPS, DEFAULT_TARGET_RATIO_BPS } from '@/constants/protocol';
import type { ExecutionView, PositionView, PricePoint, RescueEventView } from '@/types';

const MOCK_EPOCH_MS = 1_754_784_000_000;
const HOUR_MS = 3_600_000;

export const MOCK_POSITION: PositionView = {
  owner: '0x1234567890abcdef1234567890abcdef12345678',
  collateral: {
    symbol: 'dUST',
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    decimals: 6,
    quantity: 10_000,
    price: 0.76,
    paysYield: true,
  },
  debt: 5_241.38,
  reserve: 741.38,
  policy: {
    triggerRatioBps: DEFAULT_GUARD_TRIGGER_BPS,
    targetRatioBps: DEFAULT_TARGET_RATIO_BPS,
    maxRepayPerEvent: 1_500,
    isCouponSweepEnabled: true,
  },
  isAgentRevoked: false,
  lastActedRound: 42,
};

export const MOCK_GOLD_POSITION: PositionView = {
  owner: MOCK_POSITION.owner,
  collateral: {
    symbol: 'mXAU',
    address: '0xfedcba0987654321fedcba0987654321fedcba09',
    decimals: 18,
    quantity: 3.2,
    price: 2_180,
    paysYield: false,
  },
  debt: 4_800,
  reserve: 1_200,
  policy: {
    triggerRatioBps: DEFAULT_GUARD_TRIGGER_BPS,
    targetRatioBps: DEFAULT_TARGET_RATIO_BPS,
    maxRepayPerEvent: 1_200,
    isCouponSweepEnabled: false,
  },
  isAgentRevoked: false,
  lastActedRound: 17,
};

export const MOCK_POSITIONS: Record<string, PositionView> = {
  [MOCK_POSITION.collateral.symbol]: MOCK_POSITION,
  [MOCK_GOLD_POSITION.collateral.symbol]: MOCK_GOLD_POSITION,
};

export const MOCK_PRICE_HISTORY: PricePoint[] =[1, 0.98, 0.95, 0.91, 0.86, 0.81, 0.76].map(
  (price, index) => ({ timestamp: MOCK_EPOCH_MS + index * HOUR_MS, price }),
);

export const MOCK_EVENTS: RescueEventView[] = [
  {
    id: 'evt-003',
    timestamp: MOCK_EPOCH_MS + 6 * HOUR_MS,
    kind: 'guard-repay',
    note: 'Price fell 24%. I repaid $758.62 from your reserve. The position is safe again.',
    amount: 758.62,
    ratioBeforeBps: 12_667,
    ratioAfterBps: 14_500,
    price: 0.76,
    transactionLink: null,
  },
  {
    id: 'evt-002',
    timestamp: MOCK_EPOCH_MS + 3 * HOUR_MS,
    kind: 'no-op',
    note: 'Checked at 03:20. Healthy. No action taken.',
    amount: null,
    ratioBeforeBps: 15_167,
    ratioAfterBps: 15_167,
    price: 0.91,
    transactionLink: null,
  },
  {
    id: 'evt-001',
    timestamp: MOCK_EPOCH_MS,
    kind: 'no-op',
    note: 'Checked at 00:00. Healthy. No action taken.',
    amount: null,
    ratioBeforeBps: 16_667,
    ratioAfterBps: 16_667,
    price: 1,
    transactionLink: null,
  },
];

export const MOCK_EXECUTIONS: ExecutionView[] = [
  {
    executionId: 'exec-guard-healthy',
    attackName: 'Repay while the position is healthy',
    idempotencyKey: '0x00000000000000000000000000000000000000000000000000000000000000a1',
    wouldRevert: true,
    revertReason: 'Refused_Healthy',
    receiptStatus: 'reverted',
    gasUsed: 24_118,
    transactionLink: null,
    isSponsored: true,
  },
  {
    executionId: 'exec-guard-repay',
    attackName: 'Repay while the position is in the defence window',
    idempotencyKey: '0x00000000000000000000000000000000000000000000000000000000000000a2',
    wouldRevert: false,
    revertReason: null,
    receiptStatus: 'verified',
    gasUsed: 118_402,
    transactionLink: null,
    isSponsored: true,
  },
  {
    executionId: 'exec-double-fire',
    attackName: 'Act twice in the same price round',
    idempotencyKey: '0x00000000000000000000000000000000000000000000000000000000000000a3',
    wouldRevert: true,
    revertReason: 'Refused_AlreadyActed',
    receiptStatus: 'reverted',
    gasUsed: 23_774,
    transactionLink: null,
    isSponsored: true,
  },
];
