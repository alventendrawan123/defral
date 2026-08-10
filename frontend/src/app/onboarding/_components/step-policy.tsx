'use client';

import { PolicyControls } from '@/app/vault/_components/policy-controls';
import { Card } from '@/components/ui/Card';
import type { CollateralView, GuardPolicy } from '@/types';

interface StepPolicyProps {
  collateral: CollateralView;
  policy: GuardPolicy;
  onTriggerChange: (triggerRatioBps: number) => void;
  onSweepChange: (isEnabled: boolean) => void;
  onRestart: () => void;
}

export function StepPolicy({
  collateral,
  policy,
  onTriggerChange,
  onSweepChange,
  onRestart,
}: StepPolicyProps) {
  return (
    <Card title="Set guard trigger">
      <PolicyControls
        collateral={collateral}
        policy={policy}
        isAgentRevoked={false}
        onTriggerChange={onTriggerChange}
        onSweepChange={onSweepChange}
        onRevoke={onRestart}
      />
    </Card>
  );
}
