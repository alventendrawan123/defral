// reconciler.ts — event-log reconciliation for unknown execution outcomes.
//
// Responsibility boundary: answers "did this execution actually land on-chain?"
// for the three ambiguous KeeperHub receipt statuses: timeout, not_found,
// unconfirmed. Never re-broadcasts — only reads.
//
// When the agent receives ExecutionUnknownError, it calls reconcileExecution()
// here. If a matching Rescued event is found in the log, the execution is
// confirmed and its details are returned. If not found, the outcome remains
// unknown and the agent waits for the next oracle round.

import { createPublicClient, http, parseAbi, decodeEventLog, type Log } from 'viem';
import { baseSepolia } from 'viem/chains';

// ─── ABI ─────────────────────────────────────────────────────────────────────

const RESCUED_EVENT_ABI = parseAbi([
  'event Rescued(address indexed borrower, uint8 indexed kind, uint256 amount, uint16 healthBefore, uint16 healthAfter, int256 price, uint80 roundId, uint64 at)',
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReconciledExecution {
  found: true;
  transactionHash: string;
  transactionLink: string;
  amountRepaid: number;
  healthBefore: number;
  healthAfter: number;
  roundId: string;
}

export interface UnreconciledExecution {
  found: false;
}

export type ReconcileResult = ReconciledExecution | UnreconciledExecution;

// ─── Reconciler ───────────────────────────────────────────────────────────────

export interface ReconcilerConfig {
  rpcUrl: string;
  vaultAddress: `0x${string}`;
  /** Search logs from this block onwards (default: last 2000 blocks). */
  fromBlock?: bigint;
}

/**
 * Check whether a Rescued event with the given roundId was emitted by the vault.
 *
 * This is the recovery path for ExecutionUnknownError. If KeeperHub returned
 * timeout/not_found/unconfirmed we query the event log instead of re-broadcasting.
 * Re-broadcasting an unknown execution risks a double-spend.
 */
export async function reconcileByRoundId(
  cfg: ReconcilerConfig,
  borrower: `0x${string}`,
  targetRoundId: bigint,
): Promise<ReconcileResult> {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(cfg.rpcUrl, { timeout: 8_000, retryCount: 1 }),
  });

  const latestBlock = await client.getBlockNumber();
  const CHUNK = 2_000n;
  const fromBlock = cfg.fromBlock ?? (latestBlock > CHUNK ? latestBlock - CHUNK : 0n);

  const allLogs: Log[] = [];

  for (let from = fromBlock; from <= latestBlock; from += CHUNK) {
    const to = from + CHUNK - 1n < latestBlock ? from + CHUNK - 1n : latestBlock;
    const logs = await client.getLogs({
      address: cfg.vaultAddress,
      event: RESCUED_EVENT_ABI[0] as never,
      args: {
        borrower,
      },
      fromBlock: from,
      toBlock: to,
    });
    allLogs.push(...logs);
  }

  for (const log of allLogs) {
    const decoded = decodeEventLog({
      abi: RESCUED_EVENT_ABI,
      data: log.data,
      topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
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

    if (decoded.args.roundId === targetRoundId) {
      const hash = log.transactionHash ?? '';
      return {
        found: true,
        transactionHash: hash,
        transactionLink: hash
          ? `https://sepolia.basescan.org/tx/${hash}`
          : '',
        amountRepaid: Number(decoded.args.amount) / 1e6, // dUSD 6dp
        healthBefore: decoded.args.healthBefore,
        healthAfter: decoded.args.healthAfter,
        roundId: targetRoundId.toString(),
      };
    }
  }

  return { found: false };
}

/**
 * Archive a KeeperHub execution response to the evidence directory.
 * Called after every POST to /api/execute/contract-call regardless of outcome.
 * Archived as JSON so evidence survives KeeperHub log retention limits.
 */
export async function archiveExecution(
  evidenceDir: string,
  executionId: string,
  payload: unknown,
): Promise<void> {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');

  await mkdir(evidenceDir, { recursive: true });

  const filename = `exec-${executionId}-${Date.now()}.json`;
  const filepath = join(evidenceDir, filename);
  await writeFile(filepath, JSON.stringify(payload, null, 2), 'utf8');
}
