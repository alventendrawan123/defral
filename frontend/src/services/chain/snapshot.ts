import committedSnapshot from '@/../docs/evidence/chain-snapshot.json';
import { chainSnapshotSchema } from '@/services/schemas';
import type { VaultSnapshot } from '@/types';

export function readCommittedSnapshot(): VaultSnapshot {
  const parsed = chainSnapshotSchema.parse(committedSnapshot);
  const observedAtSeconds = parsed.oracle.updatedAtSeconds;

  return {
    vault: parsed.vault,
    position: {
      borrower: parsed.position.borrower,
      outstanding: BigInt(parsed.position.outstanding),
      collateralAmount: BigInt(parsed.position.collateralAmount),
      triggerBps: parsed.position.triggerBps,
      targetBps: parsed.position.targetBps,
      maxRepayPerEvent: BigInt(parsed.position.maxRepayPerEvent),
      isCouponSweepEnabled: parsed.position.isCouponSweepEnabled,
      reserve: BigInt(parsed.position.reserve),
      lastActedRound: BigInt(parsed.position.lastActedRound),
      isAgentRevoked: parsed.position.isAgentRevoked,
    },
    guardRepayQuote: BigInt(parsed.guardRepayQuote),
    couponDue: BigInt(parsed.couponDue),
    healthRatioBps: parsed.healthRatioBps,
    liquidationBps: parsed.liquidationBps,
    maxStaleSeconds: parsed.maxStaleSeconds,
    tokens: parsed.tokens,
    oracle: {
      roundId: BigInt(parsed.oracle.roundId),
      price: BigInt(parsed.oracle.price),
      decimals: parsed.oracle.decimals,
      updatedAtSeconds: parsed.oracle.updatedAtSeconds,
      ageSeconds: 0,
    },
    observedAtSeconds,
    blockNumber: BigInt(parsed.blockNumber),
    source: 'committed-snapshot',
  };
}
