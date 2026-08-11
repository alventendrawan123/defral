import { PolicyView } from './policy-view';

import { AddressPill } from '@/components/ui/AddressPill';
import { AuthorityBadge } from '@/components/ui/AuthorityBadge';
import { Card } from '@/components/ui/Card';
import { DUSD_SYMBOL } from '@/constants/contracts';
import { RESERVE_EXPLAINER, SNAPSHOT_NOTICE, VAULT_COPY } from '@/constants/copy';
import { loadVaultSnapshot } from '@/services/chain/vaultSnapshot';
import { formatMoney } from '@/utils/decimals';

export default async function Container() {
  const snapshot = await loadVaultSnapshot();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{VAULT_COPY.title}</h1>
        <p className="max-w-prose text-ink-muted">{VAULT_COPY.body}</p>
      </header>

      {snapshot.source === 'committed-snapshot' ? (
        <p className="rounded-md border border-line-soft bg-surface-sunken px-4 py-2 text-sm text-ink-muted">
          {SNAPSHOT_NOTICE}{snapshot.blockNumber ? ` Block ${snapshot.blockNumber.toString()}.` : ''}
        </p>
      ) : null}

      <Card title="Reserve">
        <p className="text-2xl font-semibold tabular-nums">
          {formatMoney(snapshot.position.reserve, snapshot.tokens.debtDecimals, DUSD_SYMBOL)}
        </p>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">{RESERVE_EXPLAINER}</p>
      </Card>

      <Card title="Defence policy" description="Read live from the vault. This page never writes.">
        <PolicyView snapshot={snapshot} />
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <AddressPill address={snapshot.position.borrower} label="Borrower" />
        <AddressPill address={snapshot.vault} label="Vault" />
        <AuthorityBadge isRevoked={snapshot.position.isAgentRevoked} />
      </div>
    </div>
  );
}
