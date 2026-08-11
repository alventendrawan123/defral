import { DUSD_SYMBOL, DUST_SYMBOL } from '@/constants/contracts';
import { NOTHING_TO_PAY } from '@/constants/copy';
import type { VaultSnapshot } from '@/types';
import {
  formatBpsAsPercent,
  formatMoney,
  formatOraclePrice,
  formatTokenAmount,
} from '@/utils/decimals';
import { computeProtectionFloorPrice, computeProtectionRunwayBps } from '@/utils/health';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-line-soft bg-surface p-4">
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function PositionStats({ snapshot }: { snapshot: VaultSnapshot }) {
  const { position, guardRepayQuote, couponDue, tokens } = snapshot;
  const { debtDecimals, collateralDecimals } = tokens;
  const floorPrice = computeProtectionFloorPrice(snapshot);
  const runwayBps = computeProtectionRunwayBps(snapshot.oracle.price, floorPrice);

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Debt" value={formatMoney(position.outstanding, debtDecimals, DUSD_SYMBOL)} />
      <Stat
        label="Reserve"
        value={formatMoney(position.reserve, debtDecimals, DUSD_SYMBOL)}
        hint="Held in your wallet as an allowance"
      />
      <Stat
        label="Collateral"
        value={`${formatTokenAmount(position.collateralAmount, collateralDecimals, 0)} ${DUST_SYMBOL}`}
        hint="Escrowed by the pool"
      />
      <Stat
        label="Would repay now"
        value={
          guardRepayQuote === 0n
            ? NOTHING_TO_PAY
            : formatMoney(guardRepayQuote, debtDecimals, DUSD_SYMBOL)
        }
        hint="Read from quoteGuardRepay()"
      />
      <Stat label="Guard Trigger" value={formatBpsAsPercent(position.triggerBps)} />
      <Stat label="Restore target" value={formatBpsAsPercent(position.targetBps)} />
      <Stat
        label="Max repay per event"
        value={formatMoney(position.maxRepayPerEvent, debtDecimals, DUSD_SYMBOL)}
      />
      <Stat
        label="Coupon due"
        value={formatMoney(couponDue, debtDecimals, DUSD_SYMBOL)}
        hint={couponDue === 0n ? 'Nothing accrued yet, which is normal' : 'Accrued and unswept'}
      />
      <Stat
        label="Protection floor"
        value={formatOraclePrice(floorPrice, snapshot.oracle.decimals)}
        hint="Below this the reserve can no longer restore the trigger"
      />
      <Stat
        label="Protection runway"
        value={formatBpsAsPercent(runwayBps)}
        hint="How far the price may fall before that floor"
      />
    </dl>
  );
}
