// Ledger interface — THE SEAM. Its shape must never change after first write.
//
// Responsibility boundary: defines the only contract guard.ts knows about.
// MockLedger (in-memory, deterministic) and KeeperHubLedger (blockchain via
// KeeperHub) both implement this interface, so the SAME test suite runs
// against both backends without a single character changed.
//
// If you are tempted to add a parameter or rename a method — don't.
// That claim is our headline submission proof, and judges run it themselves.

import { healthRatioBps, repayAmountToTarget, roundMoney } from './health.js';
import type {
  Contract,
  CouponDistribution,
  GracePeriod,
  GuardPolicy,
  Loan,
  PriceFeed,
  RescueEvent,
  ShadowVault,
} from './types.js';

// ─── Write argument / result shapes ─────────────────────────────────────────

export interface GuardRepayArgs {
  priceFeedCid: string;
  loanCid: string;
  guardPolicyCid: string;
}

export interface SweepToLoanArgs {
  guardPolicyCid: string;
  loanCid: string;
}

export interface GuardRepayResult {
  vault: Contract<ShadowVault>;
  loan: Contract<Loan>;
  rescueEvent: Contract<RescueEvent>;
  amountRepaid: number;
  healthBefore: number;
  healthAfter: number;
}

export interface SweepToLoanResult {
  amount: number;
  loan: Contract<Loan>;
}

// ─── The interface ───────────────────────────────────────────────────────────

/** The only thing guard.ts knows about. It never knows which backend is used. */
export interface Ledger {
  getActivePriceFeeds(): Promise<Contract<PriceFeed>[]>;
  getActiveLoans(): Promise<Contract<Loan>[]>;
  getActiveGuardPolicies(): Promise<Contract<GuardPolicy>[]>;
  getActiveShadowVaults(): Promise<Contract<ShadowVault>[]>;
  getActiveGracePeriods(): Promise<Contract<GracePeriod>[]>;
  getActiveCouponDistributions(): Promise<Contract<CouponDistribution>[]>;

  exerciseGuardRepay(
    vaultCid: string,
    args: GuardRepayArgs,
  ): Promise<GuardRepayResult>;

  exerciseStartGracePeriod(loanCid: string): Promise<Contract<GracePeriod>>;

  exerciseSweepToLoan(
    couponCid: string,
    args: SweepToLoanArgs,
  ): Promise<SweepToLoanResult>;
}

// ─── MockLedger ─────────────────────────────────────────────────────────────

/**
 * In-memory deterministic ledger. Zero network. Used by:
 *   1. All guard.test.ts tests (primary suite)
 *   2. Chaos suite (wrapped with failure injectors)
 *
 * Seed helpers accept partial overrides so each test declares only the field
 * it cares about, keeping tests readable and resistant to unrelated changes.
 */
export class MockLedger implements Ledger {
  private priceFeeds: Contract<PriceFeed>[] = [];
  private loans: Contract<Loan>[] = [];
  private policies: Contract<GuardPolicy>[] = [];
  private vaults: Contract<ShadowVault>[] = [];
  private graces: Contract<GracePeriod>[] = [];
  private coupons: Contract<CouponDistribution>[] = [];
  private nextId = 1;

  private id(): string {
    return `mock-${this.nextId++}`;
  }

  // ── Seed helpers ──────────────────────────────────────────────────────────

  seedPriceFeed(payload: PriceFeed): Contract<PriceFeed> {
    const c: Contract<PriceFeed> = { contractId: this.id(), payload };
    this.priceFeeds.push(c);
    return c;
  }

  seedLoan(payload: Loan): Contract<Loan> {
    const c: Contract<Loan> = { contractId: this.id(), payload };
    this.loans.push(c);
    return c;
  }

  seedPolicy(payload: GuardPolicy): Contract<GuardPolicy> {
    const c: Contract<GuardPolicy> = { contractId: this.id(), payload };
    this.policies.push(c);
    return c;
  }

  seedVault(payload: ShadowVault): Contract<ShadowVault> {
    const c: Contract<ShadowVault> = { contractId: this.id(), payload };
    this.vaults.push(c);
    return c;
  }

  seedCoupon(payload: CouponDistribution): Contract<CouponDistribution> {
    const c: Contract<CouponDistribution> = { contractId: this.id(), payload };
    this.coupons.push(c);
    return c;
  }

  /**
   * Simulate a new price observation by replacing the existing feed entry
   * with a fresh contractId. This mirrors the Canton consuming-choice
   * behaviour that guard.ts relies on for idempotency keying.
   */
  updatePrice(oracle: string, newPrice: number): Contract<PriceFeed> {
    const idx = this.priceFeeds.findIndex((f) => f.payload.oracle === oracle);
    if (idx === -1) throw new Error(`No price feed for oracle ${oracle}`);
    const updated: Contract<PriceFeed> = {
      contractId: this.id(), // fresh id — new observation
      payload: { ...this.priceFeeds[idx]!.payload, price: newPrice },
    };
    this.priceFeeds[idx] = updated;
    return updated;
  }

  // ── Ledger reads ──────────────────────────────────────────────────────────

  async getActivePriceFeeds(): Promise<Contract<PriceFeed>[]> {
    return [...this.priceFeeds];
  }

  async getActiveLoans(): Promise<Contract<Loan>[]> {
    return [...this.loans];
  }

  async getActiveGuardPolicies(): Promise<Contract<GuardPolicy>[]> {
    return [...this.policies];
  }

  async getActiveShadowVaults(): Promise<Contract<ShadowVault>[]> {
    return [...this.vaults];
  }

  async getActiveGracePeriods(): Promise<Contract<GracePeriod>[]> {
    return [...this.graces];
  }

  async getActiveCouponDistributions(): Promise<Contract<CouponDistribution>[]> {
    return [...this.coupons];
  }

  // ── Ledger writes ─────────────────────────────────────────────────────────

  async exerciseGuardRepay(
    vaultCid: string,
    args: GuardRepayArgs,
  ): Promise<GuardRepayResult> {
    const vaultC = this.vaults.find((v) => v.contractId === vaultCid);
    if (!vaultC) throw new Error(`Vault not found: ${vaultCid}`);

    const loanC = this.loans.find((l) => l.contractId === args.loanCid);
    if (!loanC) throw new Error(`Loan not found: ${args.loanCid}`);

    const priceC = this.priceFeeds.find(
      (f) => f.contractId === args.priceFeedCid,
    );
    if (!priceC) throw new Error(`Price feed not found: ${args.priceFeedCid}`);

    const policyC = this.policies.find(
      (p) => p.contractId === args.guardPolicyCid,
    );
    if (!policyC) throw new Error(`Policy not found: ${args.guardPolicyCid}`);

    const { outstanding, collateralAmount } = loanC.payload;
    const { price } = priceC.payload;
    const { targetRatioBps, maxRepayPerEvent } = policyC.payload;
    const { balance } = vaultC.payload;

    const healthBefore = healthRatioBps(collateralAmount, price, outstanding);

    if (healthBefore >= policyC.payload.triggerRatioBps) {
      throw new Error(
        `Refused_Healthy(${healthBefore}, ${policyC.payload.triggerRatioBps})`,
      );
    }

    const amountRepaid = repayAmountToTarget(
      collateralAmount,
      price,
      outstanding,
      targetRatioBps,
      maxRepayPerEvent,
      balance,
    );

    if (amountRepaid <= 0) throw new Error('Refused_NothingToRepay');

    // Mutate in-memory state
    loanC.payload = {
      ...loanC.payload,
      outstanding: roundMoney(outstanding - amountRepaid),
    };
    vaultC.payload = {
      ...vaultC.payload,
      balance: roundMoney(balance - amountRepaid),
    };

    const healthAfter = healthRatioBps(
      collateralAmount,
      price,
      loanC.payload.outstanding,
    );

    const rescueEvent: Contract<RescueEvent> = {
      contractId: this.id(),
      payload: {
        guardAgent: policyC.payload.guardAgent,
        borrower: loanC.payload.borrower,
        loanId: loanC.payload.loanId,
        description: `guardRepay: repaid ${amountRepaid}`,
        amount: amountRepaid,
        healthBefore,
        healthAfter,
        at: new Date().toISOString(),
      },
    };

    return {
      vault: { ...vaultC },
      loan: { ...loanC },
      rescueEvent,
      amountRepaid,
      healthBefore,
      healthAfter,
    };
  }

  async exerciseStartGracePeriod(loanCid: string): Promise<Contract<GracePeriod>> {
    const loanC = this.loans.find((l) => l.contractId === loanCid);
    if (!loanC) throw new Error(`Loan not found: ${loanCid}`);

    const now = new Date();
    const expires = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    const grace: Contract<GracePeriod> = {
      contractId: this.id(),
      payload: {
        borrower: loanC.payload.borrower,
        guardAgent: loanC.payload.guardAgent,
        poolOperator: loanC.payload.poolOperator,
        loanId: loanC.payload.loanId,
        startedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
      },
    };
    this.graces.push(grace);
    return grace;
  }

  async exerciseSweepToLoan(
    couponCid: string,
    args: SweepToLoanArgs,
  ): Promise<SweepToLoanResult> {
    const couponC = this.coupons.find((c) => c.contractId === couponCid);
    if (!couponC) throw new Error(`Coupon not found: ${couponCid}`);

    const loanC = this.loans.find((l) => l.contractId === args.loanCid);
    if (!loanC) throw new Error(`Loan not found: ${args.loanCid}`);

    const amount = Math.min(couponC.payload.amount, loanC.payload.outstanding);
    loanC.payload = {
      ...loanC.payload,
      outstanding: roundMoney(loanC.payload.outstanding - amount),
    };

    // Remove swept coupon from active list
    this.coupons = this.coupons.filter((c) => c.contractId !== couponCid);

    return { amount, loan: { ...loanC } };
  }
}
