import { AddressPill } from '@/components/ui/AddressPill';
import { Card } from '@/components/ui/Card';
import {
  AGENT_EXECUTOR_ADDRESS,
  DEMO_VAULT_ADDRESS,
  SYSTEM_DEPLOYER_ADDRESS,
} from '@/constants/contracts';
import { AGENT_KEY_FRAMING } from '@/constants/copy';
import { loadVaultSnapshot } from '@/services/chain/vaultSnapshot';

export default async function Container() {
  const snapshot = await loadVaultSnapshot();

  const keys = [
    {
      title: 'The borrower',
      address: snapshot.position.borrower,
      power: 'Sets the reserve, sets the policy, and can revoke the agent at any time.',
    },
    {
      title: 'The agent',
      address: AGENT_EXECUTOR_ADDRESS,
      power:
        'Two zero argument calls on this one vault. Cannot move the reserve anywhere but the pool, and cannot change its own permissions.',
    },
    {
      title: 'The system deployer',
      address: SYSTEM_DEPLOYER_ADDRESS,
      power:
        'Deployed every contract and owns the pool, and still cannot make this vault act. There is a mined transaction proving it.',
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Who can do what</h1>
        <p className="max-w-prose text-ink-muted">
          Three separate keys. None of them can do another one&apos;s job, and the split is enforced
          by the contract rather than by policy.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {keys.map((key) => (
          <Card key={key.title} title={key.title}>
            <div className="flex flex-col gap-3">
              <AddressPill address={key.address} />
              <p className="text-sm text-ink-muted">{key.power}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card title="The vault they all point at">
        <AddressPill address={DEMO_VAULT_ADDRESS} label="DefralVault" />
        <p className="mt-3 max-w-prose text-sm text-ink-muted">{AGENT_KEY_FRAMING}</p>
      </Card>
    </div>
  );
}
