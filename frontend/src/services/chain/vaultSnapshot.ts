import { readCommittedSnapshot } from '@/services/chain/snapshot';
import { readVaultSnapshot } from '@/services/chain/vaultReads';
import type { AgentPosture, VaultSnapshot } from '@/types';

export async function loadVaultSnapshot(): Promise<VaultSnapshot> {
  try {
    return await readVaultSnapshot();
  } catch {
    return readCommittedSnapshot();
  }
}

export function resolveAgentPosture(snapshot: VaultSnapshot): AgentPosture {
  if (snapshot.position.isAgentRevoked) return 'revoked';
  if (snapshot.oracle.ageSeconds > snapshot.maxStaleSeconds) return 'oracle-stale';
  if (snapshot.guardRepayQuote > 0n) return 'would-defend';
  return 'idle-healthy';
}

export function isInsideDefenceWindow(snapshot: VaultSnapshot): boolean {
  return (
    snapshot.healthRatioBps < snapshot.position.triggerBps &&
    snapshot.healthRatioBps >= snapshot.liquidationBps
  );
}
