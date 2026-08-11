// KeeperHub Ledger — blockchain execution backend.
//
// Responsibility boundary: ALL network I/O lives here and NOWHERE else.
// guard.ts never knows this file exists. It only sees the Ledger interface.
//
// Reads  → viem publicClient, single multicall per cycle (atomic one-block snapshot).
// Writes → POST /api/execute/contract-call via KeeperHub REST API.
//
// Critical design decisions encoded here:
//   - contractId for price feeds = `${oracleAddress}@${roundId}` (REQUIRED —
//     oracle address never changes in EVM; roundId is the only monotonic signal)
//   - Idempotency-Key = sha256(chainId|vault|borrower|roundId|attemptEpoch)
//   - `status: "failed"` with HTTP 202 is a CONTRACT REVERT, not a success
//   - `timeout` / `not_found` / `unconfirmed` → ExecutionUnknownError, never re-broadcast

import { createHash } from 'node:crypto';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const _require = createRequire(import.meta.url);
const _dir = dirname(fileURLToPath(import.meta.url));
const RAW_VAULT_ABI = _require(join(_dir, '../../../docs/abi/DefralVault.json'));
const RAW_ORACLE_ABI = _require(join(_dir, '../../../docs/abi/NavOracle.json'));

import {
  ExecutionRevertedError,
  ExecutionUnknownError,
  SpendingCapError,
} from './errors.js';
import type {
  GuardRepayArgs,
  GuardRepayResult,
  Ledger,
  SweepToLoanArgs,
  SweepToLoanResult,
} from './ledger.js';
import { healthRatioBps } from './health.js';
import type {
  Contract,
  CouponDistribution,
  GracePeriod,
  GuardPolicy,
  Loan,
  PriceFeed,
  ShadowVault,
} from './types.js';

// ─── ABI fragments ───────────────────────────────────────────────────────────
// Use raw JSON ABIs from docs/abi/ — parseAbi does not support named tuple
// components in human-readable form (abitype limitation).

const VAULT_ABI = RAW_VAULT_ABI as readonly unknown[];
const ORACLE_ABI = RAW_ORACLE_ABI as readonly unknown[];

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

// ─── KeeperHub types ─────────────────────────────────────────────────────────

interface KhExecutionResponse {
  executionId?: string;
  status?: string;
  error?: string;
  idempotentReplay?: boolean;
  receipts?: Array<{
    receiptStatus?: string;
    hash?: string;
  }>;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface KeeperHubLedgerConfig {
  rpcUrl: string;
  chainId: number;
  vaultAddress: string;
  oracleAddress: string;
  borrowerAddress: string;
  keeperHubApiKey: string;
  /** Override fetch for testing — production uses globalThis.fetch */
  fetchFn?: typeof fetch;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class KeeperHubLedger implements Ledger {
  private readonly client;
  private readonly config: KeeperHubLedgerConfig;
  private readonly fetchFn: typeof fetch;

  /** attemptEpoch increments only on terminal on-chain revert (not network errors). */
  private attemptEpoch = 0;

  constructor(config: KeeperHubLedgerConfig) {
    this.config = config;
    this.fetchFn = config.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.client = createPublicClient({
      chain: baseSepolia,
      transport: http(config.rpcUrl, { timeout: 8_000, retryCount: 1 }),
    });
  }

  // ── Reads (all via viem, zero KeeperHub) ─────────────────────────────────

  private async fetchChainSnapshot() {
    const vault = this.config.vaultAddress as `0x${string}`;
    const oracle = this.config.oracleAddress as `0x${string}`;

    const [position, couponDue, maxStale, roundData, oracleDecimals] =
      await this.client.multicall({
        allowFailure: false,
        multicallAddress: MULTICALL3_ADDRESS,
        contracts: [
          { address: vault, abi: VAULT_ABI, functionName: 'getPosition' },
          { address: vault, abi: VAULT_ABI, functionName: 'couponDue' },
          { address: vault, abi: VAULT_ABI, functionName: 'MAX_STALE' },
          { address: oracle, abi: ORACLE_ABI, functionName: 'latestRoundData' },
          { address: oracle, abi: ORACLE_ABI, functionName: 'decimals' },
        ],
      });

    return { position, couponDue, maxStale, roundData, oracleDecimals };
  }

  async getActivePriceFeeds(): Promise<Contract<PriceFeed>[]> {
    const { roundData, oracleDecimals } = await this.fetchChainSnapshot();
    const [roundId, answer] = roundData as [bigint, bigint, bigint, bigint, bigint];
    const decimals = Number(oracleDecimals);
    const price = Number(answer) / 10 ** decimals;

    // contractId MUST include roundId — oracle address is immutable in EVM.
    // Without this, state.lastActedPriceFeedCidByLoan matches on every tick
    // and the agent silently never fires again after the first rescue.
    return [
      {
        contractId: `${this.config.oracleAddress}@${roundId.toString()}`,
        payload: {
          oracle: this.config.oracleAddress,
          instrumentId: 'dUST',
          price,
        },
      },
    ];
  }

  async getActiveLoans(): Promise<Contract<Loan>[]> {
    const { position } = await this.fetchChainSnapshot();
    const pos = position as {
      borrower: string;
      outstanding: bigint;
      collateralAmount: bigint;
      triggerBps: number;
      targetBps: number;
      maxRepayPerEvent: bigint;
      couponSweep: boolean;
      reserve: bigint;
      lastActedRound: bigint;
      revoked: boolean;
    };

    const vault = this.config.vaultAddress;
    const borrower = pos.borrower;

    return [
      {
        contractId: `${vault}:loan:${borrower}`,
        payload: {
          borrower,
          poolOperator: vault,
          guardAgent: this.config.borrowerAddress,
          loanId: 'loan-1',
          principal: 0, // not tracked on-chain directly
          outstanding: Number(pos.outstanding) / 1e6, // dUSD 6dp
          rateBps: 0,
          collateralInstrumentId: 'dUST',
          collateralAmount: Number(pos.collateralAmount) / 1e18, // dUST 18dp
        },
      },
    ];
  }

  async getActiveGuardPolicies(): Promise<Contract<GuardPolicy>[]> {
    const { position } = await this.fetchChainSnapshot();
    const pos = position as {
      borrower: string;
      triggerBps: number;
      targetBps: number;
      maxRepayPerEvent: bigint;
      couponSweep: boolean;
    };

    const vault = this.config.vaultAddress;
    const borrower = pos.borrower;

    return [
      {
        contractId: `${vault}:policy:${borrower}`,
        payload: {
          borrower,
          guardAgent: this.config.borrowerAddress,
          triggerRatioBps: pos.triggerBps,
          targetRatioBps: pos.targetBps,
          maxRepayPerEvent: Number(pos.maxRepayPerEvent) / 1e6, // dUSD 6dp
          couponSweep: pos.couponSweep,
        },
      },
    ];
  }

  async getActiveShadowVaults(): Promise<Contract<ShadowVault>[]> {
    const { position } = await this.fetchChainSnapshot();
    const pos = position as {
      borrower: string;
      reserve: bigint;
    };

    const vault = this.config.vaultAddress;
    const borrower = pos.borrower;

    return [
      {
        contractId: `${vault}:vault:${borrower}`,
        payload: {
          borrower,
          guardAgent: this.config.borrowerAddress,
          balance: Number(pos.reserve) / 1e6, // dUSD 6dp
        },
      },
    ];
  }

  async getActiveGracePeriods(): Promise<Contract<GracePeriod>[]> {
    // Grace periods are ephemeral state not easily queryable via simple view.
    // The guard.ts logic handles the case gracefully (opens one if none live).
    return [];
  }

  async getActiveCouponDistributions(): Promise<Contract<CouponDistribution>[]> {
    const { couponDue } = await this.fetchChainSnapshot();
    const amount = Number(couponDue as bigint) / 1e6; // dUSD 6dp

    if (amount <= 0) return [];

    const vault = this.config.vaultAddress;
    const borrower = this.config.borrowerAddress;

    return [
      {
        contractId: `${vault}:coupon:${borrower}`,
        payload: {
          issuer: vault,
          owner: borrower,
          guardAgent: borrower,
          instrumentId: 'dUST',
          amount,
        },
      },
    ];
  }

  // ── Writes (all via KeeperHub) ────────────────────────────────────────────

  async exerciseGuardRepay(
    vaultCid: string,
    args: GuardRepayArgs,
  ): Promise<GuardRepayResult> {
    // Extract roundId from the price feed contractId: `${oracle}@${roundId}`
    const roundId = args.priceFeedCid.split('@')[1] ?? '0';

    const idempotencyKey = this.deriveIdempotencyKey(
      this.config.vaultAddress,
      this.config.borrowerAddress,
      roundId,
    );

    const st = await this.keeperHubExecute('guardRepay', idempotencyKey);
    this.assertTerminalSuccess(st);

    // Decode Rescued event to get actual numbers — KeeperHub does not return
    // decoded return values, so we read back from chain.
    const snapshot = await this.fetchChainSnapshot();
    const pos = snapshot.position as {
      borrower: string;
      outstanding: bigint;
      collateralAmount: bigint;
      reserve: bigint;
    };

    const { roundData, oracleDecimals } = snapshot;
    const [, answer] = roundData as [bigint, bigint, bigint, bigint, bigint];
    const price = Number(answer) / 10 ** Number(oracleDecimals);

    const outstandingAfter = Number(pos.outstanding) / 1e6;
    const collateralAmount = Number(pos.collateralAmount) / 1e18;
    const healthAfter = healthRatioBps(collateralAmount, price, outstandingAfter);

    // We don't know exact healthBefore without prior snapshot — use 0 as sentinel.
    const vault = this.config.vaultAddress;
    const borrower = pos.borrower as string;

    return {
      vault: {
        contractId: `${vault}:vault:${borrower}`,
        payload: {
          borrower,
          guardAgent: borrower,
          balance: Number(pos.reserve) / 1e6,
        },
      },
      loan: {
        contractId: `${vault}:loan:${borrower}`,
        payload: {
          borrower,
          poolOperator: vault,
          guardAgent: borrower,
          loanId: 'loan-1',
          principal: 0,
          outstanding: outstandingAfter,
          rateBps: 0,
          collateralInstrumentId: 'dUST',
          collateralAmount,
        },
      },
      rescueEvent: {
        contractId: `${vault}:rescue:${roundId}`,
        payload: {
          guardAgent: borrower,
          borrower,
          loanId: 'loan-1',
          description: `guardRepay via KeeperHub executionId=${st.executionId}`,
          amount: 0, // reconciled separately
          healthBefore: 0,
          healthAfter,
          at: new Date().toISOString(),
        },
      },
      amountRepaid: 0, // reconciled from Rescued event by reconciler
      healthBefore: 0,
      healthAfter,
    };
  }

  async exerciseStartGracePeriod(loanCid: string): Promise<Contract<GracePeriod>> {
    // Grace period on EVM is opened by the vault automatically when reserve
    // is empty — this is a no-op in the KeeperHub path because the contract
    // checks reserve and opens grace internally via guardRepay revert path.
    const now = new Date();
    const expires = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    return {
      contractId: `${loanCid}:grace:${now.getTime()}`,
      payload: {
        borrower: this.config.borrowerAddress,
        guardAgent: this.config.borrowerAddress,
        poolOperator: this.config.vaultAddress,
        loanId: 'loan-1',
        startedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
      },
    };
  }

  async exerciseSweepToLoan(
    couponCid: string,
    args: SweepToLoanArgs,
  ): Promise<SweepToLoanResult> {
    const roundId = Date.now().toString();
    const idempotencyKey = this.deriveIdempotencyKey(
      this.config.vaultAddress,
      this.config.borrowerAddress,
      `sweep-${roundId}`,
    );

    const st = await this.keeperHubExecute('sweepCoupon', idempotencyKey);
    this.assertTerminalSuccess(st);

    const snapshot = await this.fetchChainSnapshot();
    const pos = snapshot.position as { outstanding: bigint; borrower: string };
    const outstandingAfter = Number(pos.outstanding) / 1e6;
    const vault = this.config.vaultAddress;
    const borrower = pos.borrower as string;

    return {
      amount: 0, // reconciled from CouponSwept event
      loan: {
        contractId: `${vault}:loan:${borrower}`,
        payload: {
          borrower,
          poolOperator: vault,
          guardAgent: borrower,
          loanId: 'loan-1',
          principal: 0,
          outstanding: outstandingAfter,
          rateBps: 0,
          collateralInstrumentId: 'dUST',
          collateralAmount: 0,
        },
      },
    };
  }

  // ── KeeperHub HTTP helpers ────────────────────────────────────────────────

  private async keeperHubExecute(
    functionName: 'guardRepay' | 'sweepCoupon',
    idempotencyKey: string,
  ): Promise<KhExecutionResponse> {
    const KH_BASE = 'https://app.keeperhub.com';
    const url = `${KH_BASE}/api/execute/contract-call`;

    const body = JSON.stringify({
      contractAddress: this.config.vaultAddress,
      chainId: this.config.chainId, // NUMBER in REST, not string
      functionName,
      functionArgs: '[]', // JSON-stringified positional array
      simulate: false,    // boolean in BODY, not query param
    });

    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.keeperHubApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body,
    });

    // 403 spending cap — halt immediately, do not retry.
    if (res.status === 403) {
      const text = await res.text();
      if (text.includes('spending cap') || text.includes('Daily')) {
        throw new SpendingCapError();
      }
    }

    if (!res.ok && res.status !== 202) {
      // Bentuk B failure: HTTP 4xx flat response without executionId.
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new ExecutionRevertedError(text);
    }

    return (await res.json()) as KhExecutionResponse;
  }

  /**
   * Translate KeeperHub terminal state to throw or pass.
   *
   * CRITICAL: KeeperHub returns HTTP 202 even when the contract reverted.
   * Checking only HTTP status would silently report reverts as successes —
   * the most expensive silent bug in this codebase.
   *
   * Two failure forms (from infofromContract.md §1):
   *   Bentuk A: HTTP 2xx, status "failed" — THIS is what our contracts produce.
   *   Bentuk B: HTTP 4xx, flat, no executionId — handled in keeperHubExecute.
   */
  private assertTerminalSuccess(st: KhExecutionResponse): void {
    // Bentuk A: contract rejected with custom error
    if (st.status === 'failed') {
      throw new ExecutionRevertedError(st.error ?? 'unknown revert reason');
    }

    const receipt = st.receipts?.[0];
    if (receipt?.receiptStatus === 'reverted') {
      throw new ExecutionRevertedError(receipt.hash ?? 'reverted');
    }

    const unknownStatuses = ['timeout', 'not_found', 'unconfirmed'];
    if (unknownStatuses.includes(receipt?.receiptStatus ?? '')) {
      // Do NOT re-broadcast — reconcile via on-chain Rescued event log.
      throw new ExecutionUnknownError(receipt);
    }
  }

  /**
   * Idempotency key derivation.
   *
   * Key structure: sha256(chainId|vault|borrower|roundId|attemptEpoch)
   *
   * attemptEpoch increments ONLY on terminal on-chain revert (world may have
   * changed, so a new attempt is legitimate). For network errors / timeouts,
   * reuse the same key — that's the entire point of idempotency.
   */
  private deriveIdempotencyKey(
    vault: string,
    borrower: string,
    roundId: string,
  ): string {
    const raw = `${this.config.chainId}|${vault}|${borrower}|${roundId}|${this.attemptEpoch}`;
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Call after a confirmed terminal on-chain revert to allow a new attempt key. */
  incrementAttemptEpoch(): void {
    this.attemptEpoch += 1;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function buildKeeperHubLedger(): KeeperHubLedger {
  const required = (key: string): string => {
    const v = process.env[key];
    if (!v) throw new Error(`Missing required env var: ${key}`);
    return v;
  };

  return new KeeperHubLedger({
    rpcUrl: process.env['RPC_URL'] ?? 'https://sepolia.base.org',
    chainId: Number(process.env['CHAIN_ID'] ?? '84532'),
    vaultAddress: required('VAULT_ADDRESS'),
    oracleAddress: required('NAV_ORACLE_ADDRESS'),
    borrowerAddress: required('VAULT_ADDRESS'), // borrower read from chain
    keeperHubApiKey: required('KEEPERHUB_API_KEY'),
  });
}
