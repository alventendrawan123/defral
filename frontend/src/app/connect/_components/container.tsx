import { BorrowerCard } from './borrower-card';

import { DEMO_BORROWERS } from '@/constants/onboarding';

export default function Container() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Pick a borrower</h1>
        <p className="max-w-prose text-ink-muted">
          Wallet signing is not wired yet. Pick one of the demo borrowers to walk the whole path
          without touching a terminal.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {DEMO_BORROWERS.map((borrower) => (
          <BorrowerCard
            key={borrower.id}
            name={borrower.name}
            address={borrower.address}
            summary={borrower.summary}
          />
        ))}
      </ul>
    </div>
  );
}
