// Domain types shared across agent, ledger implementations, and backend.
//
// Responsibility boundary: pure data shapes only. No I/O, no imports except
// built-in types. Every other module imports FROM here — nothing flows the
// other way.

export type Party = string; // EVM address: 0x...

export interface Contract<T> {
  contractId: string;
  payload: T;
}

export interface PriceFeed {
  oracle: Party;
  instrumentId: string;
  price: number;
}

export interface Loan {
  borrower: Party;
  poolOperator: Party;
  guardAgent: Party;
  loanId: string;
  principal: number;
  outstanding: number;
  rateBps: number;
  collateralInstrumentId: string;
  collateralAmount: number;
}

export interface GuardPolicy {
  borrower: Party;
  guardAgent: Party;
  triggerRatioBps: number;
  targetRatioBps: number;
  maxRepayPerEvent: number;
  couponSweep: boolean;
}

export interface ShadowVault {
  borrower: Party;
  guardAgent: Party;
  balance: number;
}

export interface GracePeriod {
  borrower: Party;
  guardAgent: Party;
  poolOperator: Party;
  loanId: string;
  startedAt: string;
  expiresAt: string;
}

export interface CouponDistribution {
  issuer: Party;
  owner: Party;
  guardAgent: Party;
  instrumentId: string;
  amount: number;
}

export interface RescueEvent {
  guardAgent: Party;
  borrower: Party;
  loanId: string;
  description: string;
  amount: number;
  healthBefore: number;
  healthAfter: number;
  at: string;
}
