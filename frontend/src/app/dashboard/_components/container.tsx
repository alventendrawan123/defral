import { OraclePanel } from './oracle-panel';
import { PositionStats } from './position-stats';

import { AddressPill } from '@/components/ui/AddressPill';
import { AuthorityBadge } from '@/components/ui/AuthorityBadge';
import { HealthRing } from '@/components/ui/HealthRing';
import { DEFRAL_NOTE, REHEARSAL_DISCLOSURE, SNAPSHOT_NOTICE } from '@/constants/copy';
import { loadVaultSnapshot, resolveAgentPosture } from '@/services/chain/vaultSnapshot';
import { resolveHealthStatus } from '@/utils/health';

export default async function Container() {
  const snapshot = await loadVaultSnapshot();
  const posture = resolveAgentPosture(snapshot);
  const status = resolveHealthStatus(
    snapshot.healthRatioBps,
    snapshot.position.triggerBps,
    snapshot.liquidationBps,
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Your position</h1>
        <p className="max-w-prose text-sm text-ink-muted">{DEFRAL_NOTE}</p>
      </header>

      {snapshot.source === 'committed-snapshot' ? (
        <p className="rounded-md border border-line-soft bg-surface-sunken px-4 py-2 text-sm text-ink-muted">
          {SNAPSHOT_NOTICE}{snapshot.blockNumber ? ` Block ${snapshot.blockNumber.toString()}.` : ''}
        </p>
      ) : null}

      <div className="flex flex-col items-center gap-4">
        <HealthRing
          healthRatioBps={snapshot.healthRatioBps}
          triggerRatioBps={snapshot.position.triggerBps}
          status={status}
        />
      </div>

      <OraclePanel snapshot={snapshot} posture={posture} />

      <PositionStats snapshot={snapshot} />

      <div className="flex flex-wrap items-center gap-3">
        <AddressPill address={snapshot.position.borrower} label="Borrower" />
        <AddressPill address={snapshot.vault} label="Vault" />
        <AuthorityBadge isRevoked={snapshot.position.isAgentRevoked} />
      </div>

      <p className="max-w-prose text-xs text-ink-muted">{REHEARSAL_DISCLOSURE}</p>
    </div>
  );
}
