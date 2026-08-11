// evm-ledger.ts — viem multicall reads for the HTTP API server.
//
// Responsibility boundary: ALL chain I/O for the backend HTTP layer lives here.
// backend/src/index.ts only calls functions from this file and never touches
// viem, publicClient, or contract addresses directly.
//
// Reads are batched into a single multicall for an atomic one-block snapshot.
// Rescured event logs are fetched in 2000-block chunks (Web3 query limit).

import { createPublicClient, http, decodeEventLog, type Log } from 'viem';
import { baseSepolia } from 'viem/chains';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { PositionView, RescueEventView, VaultSnapshot } from './types.js';

// ─── JSON ABIs from docs/abi/ ─────────────────────────────────────────────────
// parseAbi does not support named tuple components (abitype limitation).

const _require = createRequire(import.meta.url);
const _dir = dirname(fileURLToPath(import.meta.url));
const _docsAbi = join(_dir, '..', '..', 'docs', 'abi');

const VAULT_ABI = _require(join(_docsAbi, 'DefralVault.json')) as readonly unknown[];
const ORACLE_ABI = _require(join(_docsAbi, 'NavOracle.json')) as readonly unknown[];
const POOL_ABI = _require(join(_docsAbi, 'MockLendingPool.json')) as readonly unknown[];
const ERC20_ABI = _require(join(_docsAbi, 'MockUSD.json')) as readonly unknown[];

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

// ─── Config ───────────────────────────────────────────────────────────────────

export interface EvmLedgerConfig {
  rpcUrl: string;
  vaultAddress: `0x${string}`;
  oracleAddress: `0x${string}`;
  poolAddress: `0x${string}`;
  dusdAddress: `0x${string}`;
  dustAddress: `0x${string}`;
}

// ─── Client factory ───────────────────────────────────────────────────────────

function makeClient(rpcUrl: string) {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl, { timeout: 8_000, retryCount: 1 }),
  });
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

/**
 * Fetch a single atomic snapshot of the vault from chain.
 * One multicall = one block = no cross-block race conditions.
 */
export async function fetchVaultSnapshot(cfg: EvmLedgerConfig): Promise<VaultSnapshot> {
  const client = makeClient(cfg.rpcUrl);

  const [
    position,
    quote,
    couponDue,
    healthBps,
    maxStale,
    roundData,
    oracleDecimals,
    liquidationBps,
    debtDecimals,
    collateralDecimals,
  ] = await client.multicall({
    allowFailure: false,
    multicallAddress: MULTICALL3_ADDRESS,
    contracts: [
      { address: cfg.vaultAddress, abi: VAULT_ABI, functionName: 'getPosition' },
      { address: cfg.vaultAddress, abi: VAULT_ABI, functionName: 'quoteGuardRepay' },
      { address: cfg.vaultAddress, abi: VAULT_ABI, functionName: 'couponDue' },
      { address: cfg.vaultAddress, abi: VAULT_ABI, functionName: 'healthRatioBps' },
      { address: cfg.vaultAddress, abi: VAULT_ABI, functionName: 'MAX_STALE' },
      { address: cfg.oracleAddress, abi: ORACLE_ABI, functionName: 'latestRoundData' },
      { address: cfg.oracleAddress, abi: ORACLE_ABI, functionName: 'decimals' },
      { address: cfg.poolAddress, abi: POOL_ABI, functionName: 'LIQUIDATION_BPS' },
      { address: cfg.dusdAddress, abi: ERC20_ABI, functionName: 'decimals' },
      { address: cfg.dustAddress, abi: ERC20_ABI, functionName: 'decimals' },
    ],
  });

  const pos = position as {
    borrower: `0x${string}`;
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

  const [roundId, answer, , updatedAt] = roundData as [bigint, bigint, bigint, bigint, bigint];
  const decimals = Number(oracleDecimals as bigint);
  const dDebt = Number(debtDecimals as bigint);
  const dColl = Number(collateralDecimals as bigint);
  const price = Number(answer as bigint) / 10 ** decimals;

  const observedAtSeconds = Math.floor(Date.now() / 1000);

  return {
    vault: cfg.vaultAddress,
    position: {
      borrower: pos.borrower,
      outstanding: pos.outstanding,
      collateralAmount: pos.collateralAmount,
      triggerBps: pos.triggerBps,
      targetBps: pos.targetBps,
      maxRepayPerEvent: pos.maxRepayPerEvent,
      isCouponSweepEnabled: pos.couponSweep,
      reserve: pos.reserve,
      lastActedRound: pos.lastActedRound,
      isAgentRevoked: pos.revoked,
    },
    guardRepayQuote: quote as bigint,
    couponDue: couponDue as bigint,
    healthRatioBps: Number(healthBps as bigint),
    liquidationBps: Number(liquidationBps as bigint),
    maxStaleSeconds: Number(maxStale as bigint),
    oracle: {
      roundId: roundId as bigint,
      price: answer as bigint,
      decimals,
      updatedAtSeconds: Number(updatedAt as bigint),
      ageSeconds: Math.max(0, observedAtSeconds - Number(updatedAt as bigint)),
    },
    tokens: {
      debtDecimals: dDebt,
      collateralDecimals: dColl,
    },
    observedAtSeconds,
    source: 'chain',
  };
}

// ─── Position view (for /api/position) ───────────────────────────────────────

/**
 * Human-readable position with decimal-converted numbers.
 * Matches the PositionView shape the frontend types expect.
 */
export async function fetchPositionView(cfg: EvmLedgerConfig): Promise<PositionView> {
  const snap = await fetchVaultSnapshot(cfg);
  const dDebt = snap.tokens.debtDecimals;
  const dColl = snap.tokens.collateralDecimals;
  const price = Number(snap.oracle.price) / 10 ** snap.oracle.decimals;

  return {
    vault: snap.vault,
    blockNumber: snap.blockNumber?.toString() ?? null,
    position: {
      borrower: snap.position.borrower,
      outstanding: snap.position.outstanding.toString(),
      collateralAmount: snap.position.collateralAmount.toString(),
      triggerBps: snap.position.triggerBps,
      targetBps: snap.position.targetBps,
      maxRepayPerEvent: snap.position.maxRepayPerEvent.toString(),
      isCouponSweepEnabled: snap.position.isCouponSweepEnabled,
      reserve: snap.position.reserve.toString(),
      lastActedRound: snap.position.lastActedRound.toString(),
      isAgentRevoked: snap.position.isAgentRevoked,
    },
    guardRepayQuote: snap.guardRepayQuote.toString(),
    couponDue: snap.couponDue.toString(),
    healthRatioBps: snap.healthRatioBps,
    liquidationBps: snap.liquidationBps,
    maxStaleSeconds: snap.maxStaleSeconds,
    oracle: {
      roundId: snap.oracle.roundId.toString(),
      price: snap.oracle.price.toString(),
      decimals: snap.oracle.decimals,
      updatedAtSeconds: snap.oracle.updatedAtSeconds,
      ageSeconds: snap.oracle.ageSeconds,
    },
    tokens: snap.tokens,
    observedAtSeconds: snap.observedAtSeconds,
  };
}

// ─── Rescued event logs (for /api/events) ────────────────────────────────────

/** kind values from the contract: 1 = guardRepay, 2 = couponSweep */
const KIND_LABELS: Record<number, string> = {
  1: 'guard-repay',
  2: 'coupon-sweep',
};

/**
 * Fetch Rescued event logs from the vault in 2000-block batches.
 * Uses the uint8 kind field — never substring-matches error messages.
 */
export async function fetchRescueEvents(
  cfg: EvmLedgerConfig,
  fromBlock: bigint = 0n,
): Promise<RescueEventView[]> {
  const client = makeClient(cfg.rpcUrl);

  const latestBlock = await client.getBlockNumber();
  const CHUNK = 2_000n;
  const allLogs: Log[] = [];

  for (let from = fromBlock; from <= latestBlock; from += CHUNK) {
    const to = from + CHUNK - 1n < latestBlock ? from + CHUNK - 1n : latestBlock;
    const logs = await client.getLogs({
      address: cfg.vaultAddress,
      event: VAULT_ABI.find((x) => x.type === 'event' && x.name === 'Rescued') as never,
      fromBlock: from,
      toBlock: to,
    });
    allLogs.push(...logs);
  }

  return allLogs.map((log, idx) => {
    const decoded = decodeEventLog({
      abi: VAULT_ABI,
      data: log.data,
      topics: log.topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
    }) as {
      args: {
        borrower: string;
        kind: number;
        amount: bigint;
        healthBefore: number;
        healthAfter: number;
        price: bigint;
        roundId: bigint;
        at: bigint;
      };
    };

    const { args } = decoded;
    const dDebt = 6; // dUSD always 6dp
    const dOracle = 8; // oracle always 8dp

    return {
      id: `${log.transactionHash ?? 'unknown'}-${idx}`,
      timestamp: Number(args.at),
      kind: (KIND_LABELS[args.kind] ?? 'no-op') as RescueEventView['kind'],
      note: `${KIND_LABELS[args.kind] ?? 'unknown'} roundId=${args.roundId}`,
      amount: Number(args.amount) / 10 ** dDebt,
      ratioBeforeBps: args.healthBefore,
      ratioAfterBps: args.healthAfter,
      price: Number(args.price) / 10 ** dOracle,
      transactionLink: log.transactionHash
        ? `https://sepolia.basescan.org/tx/${log.transactionHash}`
        : null,
    };
  });
}

// ─── Config factory from env ──────────────────────────────────────────────────

export function evmLedgerConfigFromEnv(): EvmLedgerConfig {
  const required = (key: string): `0x${string}` => {
    const v = process.env[key];
    if (!v) throw new Error(`Missing required env var: ${key}`);
    return v as `0x${string}`;
  };

  return {
    rpcUrl: process.env['RPC_URL'] ?? 'https://sepolia.base.org',
    vaultAddress: required('VAULT_ADDRESS'),
    oracleAddress: required('NAV_ORACLE_ADDRESS'),
    poolAddress: required('LENDING_POOL_ADDRESS'),
    dusdAddress: required('DUSD_ADDRESS'),
    dustAddress: required('DUST_ADDRESS'),
  };
}
