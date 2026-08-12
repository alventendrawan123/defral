import { readCommittedSnapshot } from '@/services/chain/snapshot';
import { readVaultSnapshot } from '@/services/chain/vaultReads';
import { isBackendMode, PUBLIC_ENV } from '@/constants/env';
import type { AgentPosture, VaultSnapshot } from '@/types';

export async function loadVaultSnapshot(): Promise<VaultSnapshot> {
  if (isBackendMode()) {
    try {
      return await fetchSnapshotFromBackend();
    } catch {
      // Backend unreachable — fall through to direct RPC then committed snapshot
    }
  }
  try {
    return await readVaultSnapshot();
  } catch {
    return readCommittedSnapshot();
  }
}

/**
 * Fetch vault snapshot from the backend HTTP API.
 * The backend returns bigints as decimal strings (JSON limitation) —
 * convert them back to BigInt before returning to match VaultSnapshot type.
 */
async function fetchSnapshotFromBackend(): Promise<VaultSnapshot> {
  const url = `${PUBLIC_ENV.NEXT_PUBLIC_API_URL}/api/position`;
  const res = await fetch(url, {
    // Next.js 13 ISR — revalidate every 30 seconds
    next: { revalidate: 30 },
  } as RequestInit);

  if (!res.ok) {
    throw new Error(`Backend /api/position returned ${res.status}`);
  }

  type ApiPositionResponse = {
    vault: string;
    blockNumber: string | null;
    observedAtSeconds: number;
    healthRatioBps: number;
    liquidationBps: number;
    maxStaleSeconds: number;
    guardRepayQuote: string;
    couponDue: string;
    position: {
      borrower: string;
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
    oracle: {
      roundId: string;
      price: string;
      decimals: number;
      updatedAtSeconds: number;
      ageSeconds: number;
    };
    tokens: { debtDecimals: number; collateralDecimals: number };
  };
  const d = (await res.json()) as ApiPositionResponse;
  const observedAtSeconds: number = d.observedAtSeconds ?? Math.floor(Date.now() / 1000);

  return {
    vault: d.vault as `0x${string}`,
    position: {
      borrower: d.position.borrower as `0x${string}`,
      outstanding: BigInt(d.position.outstanding),
      collateralAmount: BigInt(d.position.collateralAmount),
      triggerBps: d.position.triggerBps,
      targetBps: d.position.targetBps,
      maxRepayPerEvent: BigInt(d.position.maxRepayPerEvent),
      isCouponSweepEnabled: d.position.isCouponSweepEnabled,
      reserve: BigInt(d.position.reserve),
      lastActedRound: BigInt(d.position.lastActedRound),
      isAgentRevoked: d.position.isAgentRevoked,
    },
    guardRepayQuote: BigInt(d.guardRepayQuote),
    couponDue: BigInt(d.couponDue),
    healthRatioBps: d.healthRatioBps,
    liquidationBps: d.liquidationBps,
    maxStaleSeconds: d.maxStaleSeconds,
    oracle: {
      roundId: BigInt(d.oracle.roundId),
      price: BigInt(d.oracle.price),
      decimals: d.oracle.decimals,
      updatedAtSeconds: d.oracle.updatedAtSeconds,
      ageSeconds: d.oracle.ageSeconds,
    },
    tokens: {
      debtDecimals: d.tokens.debtDecimals,
      collateralDecimals: d.tokens.collateralDecimals,
    },
    observedAtSeconds,
    blockNumber: d.blockNumber ? BigInt(d.blockNumber) : undefined,
    source: 'chain',
  };
}

export function resolveAgentPosture(snapshot: VaultSnapshot): AgentPosture {
  if (snapshot.position.isAgentRevoked) return 'revoked';
  if (snapshot.oracle.ageSeconds > snapshot.maxStaleSeconds) return 'oracle-stale';
  if (snapshot.guardRepayQuote > 0n) return 'would-defend';
  if (snapshot.healthRatioBps < snapshot.position.triggerBps) return 'reserve-exhausted';
  return 'idle-healthy';
}

export function isInsideDefenceWindow(snapshot: VaultSnapshot): boolean {
  return (
    snapshot.healthRatioBps < snapshot.position.triggerBps &&
    snapshot.healthRatioBps >= snapshot.liquidationBps
  );
}
