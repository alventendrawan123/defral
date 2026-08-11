// types.ts — backend HTTP layer shared types.
//
// Responsibility boundary: response shapes for /api/* endpoints.
// Mirrors the VaultSnapshot and related types from the frontend's types/index.ts
// so the frontend can consume them without transformation.

export type EvmAddress = `0x${string}`;

export type ReceiptStatus = 'verified' | 'reverted' | 'unconfirmed';

export type RescueKind = 'guard-repay' | 'coupon-sweep' | 'no-op' | 'liquidation';

export interface PositionView {
  vault: EvmAddress;
  blockNumber: string | null;
  position: {
    borrower: EvmAddress;
    outstanding: string;
    collateralAmount: string;
    triggerBps: number;
    targetBps: number;
    maxRepayPerEvent: string;
    isCouponSweepEnabled: boolean;
    reserve: string;
    lastActedRound: string;
    isAgentRevoked: boolean;
  };
  guardRepayQuote: string;
  couponDue: string;
  healthRatioBps: number;
  liquidationBps: number;
  maxStaleSeconds: number;
  oracle: {
    roundId: string;
    price: string;
    decimals: number;
    updatedAtSeconds: number;
    ageSeconds: number;
  };
  tokens: {
    debtDecimals: number;
    collateralDecimals: number;
  };
  observedAtSeconds: number;
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
  status: string;
  error: string | null;
  receiptStatus: ReceiptStatus | null;
  transactionLink: string | null;
  gasUsed: number | null;
  isSponsored: boolean;
}

export interface VaultSnapshot {
  vault: EvmAddress;
  position: {
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
  };
  guardRepayQuote: bigint;
  couponDue: bigint;
  healthRatioBps: number;
  liquidationBps: number;
  maxStaleSeconds: number;
  oracle: {
    roundId: bigint;
    price: bigint;
    decimals: number;
    updatedAtSeconds: number;
    ageSeconds: number;
  };
  tokens: {
    debtDecimals: number;
    collateralDecimals: number;
  };
  observedAtSeconds: number;
  blockNumber?: bigint;
  source: 'chain' | 'committed-snapshot';
}
