import { DUSD_SYMBOL } from '@/constants/contracts';
import { VAULT_COPY } from '@/constants/copy';
import type { VaultSnapshot } from '@/types';
import { formatBpsAsPercent, formatMoney } from '@/utils/decimals';

function PolicyRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-line-soft py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <dt className="text-sm text-ink-muted">{label}</dt>
        <dd className="font-mono text-sm font-semibold tabular-nums">{value}</dd>
      </div>
      {note ? <p className="text-xs text-ink-muted">{note}</p> : null}
    </div>
  );
}

export function PolicyView({ snapshot }: { snapshot: VaultSnapshot }) {
  const { position, tokens } = snapshot;

  return (
    <dl className="flex flex-col">
      <PolicyRow
        label={VAULT_COPY.triggerLabel}
        value={formatBpsAsPercent(position.triggerBps)}
        note={VAULT_COPY.triggerHint}
      />
      <PolicyRow
        label="Restore target"
        value={formatBpsAsPercent(position.targetBps)}
        note="Where a defence puts the ratio back to, exactly rather than approximately."
      />
      <PolicyRow
        label="Max repay per event"
        value={formatMoney(position.maxRepayPerEvent, tokens.debtDecimals, DUSD_SYMBOL)}
        note="A ceiling on any single defensive action."
      />
      <PolicyRow
        label={VAULT_COPY.sweepLabel}
        value={position.isCouponSweepEnabled ? 'enabled' : 'disabled'}
        note="Directs accrued coupon at the debt instead of the borrower."
      />
      <PolicyRow
        label="Liquidation threshold"
        value={formatBpsAsPercent(snapshot.liquidationBps)}
        note="Set by the pool, not by us. Below this anyone may seize the collateral."
      />
      <PolicyRow
        label="Last acted round"
        value={position.lastActedRound.toString()}
        note={
          position.lastActedRound === 0n
            ? 'This position has never been defended.'
            : 'One defensive action per oracle round.'
        }
      />
    </dl>
  );
}
