export type HealthStatus = 'safe' | 'defending' | 'critical';

export type ReceiptStatus = 'verified' | 'reverted' | 'unconfirmed';

export type RescueKind = 'guard-repay' | 'coupon-sweep' | 'no-op' | 'liquidation';

export type DataMode = 'mock' | 'live';

export type EvmAddress = `0x${string}`;

export interface CollateralView {
  symbol: string;
  address: EvmAddress;
  decimals: number;
  quantity: number;
  price: number;
  paysYield: boolean;
}

export interface GuardPolicy {
  triggerRatioBps: number;
  targetRatioBps: number;
  maxRepayPerEvent: number;
  isCouponSweepEnabled: boolean;
}

export interface PositionView {
  owner: EvmAddress;
  collateral: CollateralView;
  debt: number;
  reserve: number;
  policy: GuardPolicy;
  isAgentRevoked: boolean;
  lastActedRound: number;
}

export interface RescueEventView {
  id: string;
  timestamp: number;
  kind: RescueKind;
  note: string;
  amount: number | null;
  ratioBeforeBps: number | null;
  ratioAfterBps: number | null;
  price: number | null;
  transactionLink: string | null;
}

export interface ExecutionView {
  executionId: string;
  attackName: string;
  idempotencyKey: string;
  wouldRevert: boolean;
  revertReason: string | null;
  receiptStatus: ReceiptStatus;
  gasUsed: number | null;
  transactionLink: string | null;
  isSponsored: boolean;
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface VaultPosition {
  borrower: EvmAddress;
  outstanding: bigint;
  collateralAmount: bigint;
  triggerBps: number;
  targetBps: number;
  maxRepayPerEvent: bigint;
  isCouponSweepEnabled: boolean;
  reserve: bigint;
  lastActedRound: bigint;
  isAgentRevoked: boolean;
}

export interface OraclePoint {
  roundId: bigint;
  price: bigint;
  decimals: number;
  updatedAtSeconds: number;
  ageSeconds: number;
}

export type SnapshotSource = 'chain' | 'committed-snapshot';

export interface TokenDecimals {
  debtDecimals: number;
  collateralDecimals: number;
}

export interface VaultSnapshot {
  vault: EvmAddress;
  position: VaultPosition;
  guardRepayQuote: bigint;
  couponDue: bigint;
  healthRatioBps: number;
  liquidationBps: number;
  maxStaleSeconds: number;
  oracle: OraclePoint;
  tokens: TokenDecimals;
  observedAtSeconds: number;
  blockNumber?: bigint;
  source: SnapshotSource;
}

export type AgentPosture = 'idle-healthy' | 'would-defend' | 'oracle-stale' | 'revoked';

export type CapabilityEvidence =
  | {
      kind: 'transaction';
      transactionLink: string;
      receiptStatus: ReceiptStatus;
      onRehearsalVault: boolean;
    }
  | { kind: 'execution-record'; executionId: string; contractError: string }
  | { kind: 'absent-from-abi'; statement: string };

export interface CapabilityRow {
  id: string;
  question: string;
  answer: 'yes' | 'never';
  evidence: CapabilityEvidence;
}

export type ProofEntryKind = 'transaction' | 'execution-record';

export interface ProofEntry {
  id: string;
  rank: number;
  title: string;
  claim: string;
  caller: EvmAddress;
  callerRole: string;
  target: EvmAddress;
  targetLabel: string;
  kind: ProofEntryKind;
  contractError: string | null;
  executionId: string | null;
  transactionLink: string | null;
  receiptStatus: ReceiptStatus;
  blockNumber: number | null;
  gasUsed: number | null;
  isSponsored: boolean;
  reading: string;
}

export type PositionOutcome = 'rescued' | 'liquidated';

export interface OutcomeComparisonRow {
  id: string;
  label: string;
  isGuarded: boolean;
  outcome: PositionOutcome;
  openingRatioBps: number;
  stressPrice: number;
  collateralSeized: number | null;
  amountRepaid: number | null;
  note: string;
  transactionLink: string | null;
}

export interface GuardRepayInput {
  collateralQty: number;
  price: number;
  debt: number;
  targetBps: number;
  maxRepayPerEvent: number;
  reserve: number;
}

export interface ProtectionFloorInput {
  collateralQty: number;
  debt: number;
  reserve: number;
  triggerBps: number;
}
