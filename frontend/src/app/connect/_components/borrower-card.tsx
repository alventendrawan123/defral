import Link from 'next/link';

import { AddressPill } from '@/components/ui/AddressPill';
import { ROUTES } from '@/constants/routes';
import type { EvmAddress } from '@/types';

interface BorrowerCardProps {
  name: string;
  address: EvmAddress;
  summary: string;
}

export function BorrowerCard({ name, address, summary }: BorrowerCardProps) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border-2 border-line bg-surface p-6 shadow-card">
      <h2 className="text-lg font-semibold">{name}</h2>
      <p className="text-sm text-ink-muted">{summary}</p>
      <AddressPill address={address} />
      <Link
        href={ROUTES.onboarding}
        className="w-fit rounded-md border-2 border-line bg-ink px-4 py-2 text-sm font-medium text-paper transition-shadow duration-200 ease-out hover:shadow-card"
      >
        Continue as {name}
      </Link>
    </li>
  );
}
