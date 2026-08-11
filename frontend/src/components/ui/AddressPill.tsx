import { EXPLORER_ADDRESS_URL } from '@/constants/chain';
import type { EvmAddress } from '@/types';
import { shortenAddress } from '@/utils/decimals';

interface AddressPillProps {
  address: EvmAddress;
  label?: string;
}

export function AddressPill({ address, label }: AddressPillProps) {
  return (
    <a
      href={`${EXPLORER_ADDRESS_URL}/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface px-3 py-1 font-mono text-xs text-ink transition-colors duration-200 ease-out hover:border-line"
    >
      {label ? <span className="font-sans text-ink-muted">{label}</span> : null}
      <span className="tabular-nums">{shortenAddress(address)}</span>
    </a>
  );
}
