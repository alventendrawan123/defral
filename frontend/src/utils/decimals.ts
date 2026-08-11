import { formatUnits } from 'viem';

import { BPS_SCALE } from '@/constants/protocol';
import type { EvmAddress } from '@/types';

const PERCENT_FRACTION_DIGITS = 2;
const ADDRESS_HEAD_LENGTH = 6;
const ADDRESS_TAIL_LENGTH = 4;

export function shortenAddress(address: EvmAddress): string {
  if (address.length <= ADDRESS_HEAD_LENGTH + ADDRESS_TAIL_LENGTH) return address;
  return `${address.slice(0, ADDRESS_HEAD_LENGTH)}...${address.slice(-ADDRESS_TAIL_LENGTH)}`;
}

export function formatTokenAmount(
  raw: bigint,
  decimals: number,
  maximumFractionDigits = 2,
): string {
  const asNumber = Number(formatUnits(raw, decimals));
  return asNumber.toLocaleString('en-US', {
    minimumFractionDigits: Math.min(maximumFractionDigits, 2),
    maximumFractionDigits,
  });
}

export function formatMoney(raw: bigint, decimals: number, symbol: string): string {
  return `${formatTokenAmount(raw, decimals)} ${symbol}`;
}

export function formatOraclePrice(raw: bigint, decimals: number): string {
  return `$${Number(formatUnits(raw, decimals)).toFixed(PERCENT_FRACTION_DIGITS)}`;
}

export function formatBpsAsPercent(bps: number): string {
  return `${(bps / (BPS_SCALE / 100)).toFixed(PERCENT_FRACTION_DIGITS)}%`;
}

export function formatBpsRaw(bps: number): string {
  return `${bps.toLocaleString('en-US')} bps`;
}

export function formatSecondsAsAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
