import { BPS_SCALE } from '@/constants/protocol';
import type { EvmAddress } from '@/types';

const ADDRESS_HEAD_LENGTH = 6;
const ADDRESS_TAIL_LENGTH = 4;

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function shortenAddress(address: EvmAddress): string {
  if (address.length <= ADDRESS_HEAD_LENGTH + ADDRESS_TAIL_LENGTH) return address;
  return `${address.slice(0, ADDRESS_HEAD_LENGTH)}...${address.slice(-ADDRESS_TAIL_LENGTH)}`;
}

export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return 'n/a';
  return usdFormatter.format(amount);
}

export function formatRatioBps(ratioBps: number): string {
  if (!Number.isFinite(ratioBps)) return 'no debt';
  return `${percentFormatter.format((ratioBps / BPS_SCALE) * 100)}%`;
}

export function formatBps(ratioBps: number): string {
  if (!Number.isFinite(ratioBps)) return 'n/a';
  return `${ratioBps.toLocaleString('en-US')} bps`;
}

export function formatTokenAmount(amount: number, decimals: number): string {
  if (!Number.isFinite(amount)) return 'n/a';
  return amount.toLocaleString('en-US', { maximumFractionDigits: Math.min(decimals, 6) });
}
