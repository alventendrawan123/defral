import { Card } from '@/components/ui/Card';
import { DUSD_SYMBOL } from '@/constants/contracts';
import { ONBOARDING_STEPS } from '@/constants/onboarding';
import { loadVaultSnapshot } from '@/services/chain/vaultSnapshot';
import { formatBpsAsPercent, formatMoney } from '@/utils/decimals';

export default async function Container() {
  const snapshot = await loadVaultSnapshot();

  const liveValues: Record<string, string> = {
    'Pick collateral': 'dUST, a tokenised treasury that accrues a quarterly coupon',
    Borrow: formatMoney(snapshot.position.outstanding, snapshot.tokens.debtDecimals, DUSD_SYMBOL),
    'Set reserve': formatMoney(snapshot.position.reserve, snapshot.tokens.debtDecimals, DUSD_SYMBOL),
    'Set guard trigger': formatBpsAsPercent(snapshot.position.triggerBps),
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">How this position was opened</h1>
        <p className="max-w-prose text-ink-muted">
          Four steps, each one a transaction the borrower signs from their own wallet. The values
          below are what the demo borrower actually chose, read back from the vault.
        </p>
      </header>

      <ol className="flex flex-col gap-4">
        {ONBOARDING_STEPS.map((step, index) => (
          <li key={step}>
            <Card title={`${index + 1}. ${step}`}>
              <p className="font-mono text-sm tabular-nums">{liveValues[step]}</p>
            </Card>
          </li>
        ))}
      </ol>

      <p className="max-w-prose text-sm text-ink-muted">
        Once the trigger is set, the borrower is done. Everything after this point is the agent
        watching, and the contract deciding.
      </p>
    </div>
  );
}
