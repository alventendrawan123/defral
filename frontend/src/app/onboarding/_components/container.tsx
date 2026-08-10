'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { StepBorrow } from './step-borrow';
import { StepCollateral } from './step-collateral';
import { StepPolicy } from './step-policy';
import { StepReserve } from './step-reserve';

import { OnboardingStepper } from '@/components/ui/OnboardingStepper';
import { ONBOARDING_STEPS } from '@/constants/onboarding';
import { DEFAULT_GUARD_TRIGGER_BPS } from '@/constants/protocol';
import { ROUTES } from '@/constants/routes';
import { MOCK_POSITIONS } from '@/services/mockData';
import { useDefralStore } from '@/stores/useDefralStore';
import { computeHealthRatioBps, maxOutstandingForRatioBps } from '@/utils/health';

const COLLATERAL_SYMBOLS = Object.keys(MOCK_POSITIONS);
const LAST_STEP_INDEX = ONBOARDING_STEPS.length - 1;

export default function Container() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [symbol, setSymbol] = useState(COLLATERAL_SYMBOLS[0]);
  const [debt, setDebt] = useState(0);
  const [reserve, setReserve] = useState(0);
  const [triggerRatioBps, setTriggerRatioBps] = useState(DEFAULT_GUARD_TRIGGER_BPS);
  const [isCouponSweepEnabled, setIsCouponSweepEnabled] = useState(true);

  const template = MOCK_POSITIONS[symbol];
  const collateralValue = template.collateral.quantity * template.collateral.price;
  const maxDebt = maxOutstandingForRatioBps(collateralValue, triggerRatioBps);
  const policy = {
    triggerRatioBps,
    targetRatioBps: template.policy.targetRatioBps,
    maxRepayPerEvent: template.policy.maxRepayPerEvent,
    isCouponSweepEnabled,
  };

  function confirm() {
    useDefralStore.setState({
      status: 'ready',
      position: {
        ...template,
        debt,
        reserve,
        policy: {
          ...policy,
          isCouponSweepEnabled: template.collateral.paysYield && isCouponSweepEnabled,
        },
      },
    });
    router.push(ROUTES.dashboard);
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">Open a guarded position</h1>
      <OnboardingStepper steps={ONBOARDING_STEPS} activeIndex={stepIndex} />

      {stepIndex === 0 ? (
        <StepCollateral
          symbols={COLLATERAL_SYMBOLS}
          activeSymbol={symbol}
          onSelect={setSymbol}
        />
      ) : null}

      {stepIndex === 1 ? (
        <StepBorrow
          debt={debt}
          maxDebt={maxDebt}
          ratioBps={computeHealthRatioBps(
            template.collateral.quantity,
            template.collateral.price,
            debt,
          )}
          triggerRatioBps={triggerRatioBps}
          onChange={setDebt}
        />
      ) : null}

      {stepIndex === 2 ? <StepReserve reserve={reserve} onChange={setReserve} /> : null}

      {stepIndex === LAST_STEP_INDEX ? (
        <StepPolicy
          collateral={template.collateral}
          policy={policy}
          onTriggerChange={setTriggerRatioBps}
          onSweepChange={setIsCouponSweepEnabled}
          onRestart={() => setStepIndex(0)}
        />
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((current) => current - 1)}
          className="rounded-md border-2 border-line-soft bg-surface px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Back
        </button>
        {stepIndex === LAST_STEP_INDEX ? (
          <button
            type="button"
            onClick={confirm}
            className="rounded-md border-2 border-line bg-ink px-5 py-2 text-sm font-medium text-paper"
          >
            Confirm and open the dashboard
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStepIndex((current) => current + 1)}
            className="rounded-md border-2 border-line bg-ink px-5 py-2 text-sm font-medium text-paper"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
