import vaultAbi from '@/../docs/abi/DefralVault.json';
import navOracleAbi from '@/../docs/abi/NavOracle.json';
import lendingPoolAbi from '@/../docs/abi/MockLendingPool.json';
import {
  DEMO_VAULT_ADDRESS,
  DUSD_ADDRESS,
  DUST_ADDRESS,
  LENDING_POOL_ADDRESS,
  NAV_ORACLE_ADDRESS,
} from '@/constants/contracts';
import { publicClient } from '@/services/chain/client';
import { erc20DecimalsAbi } from '@/services/chain/erc20Abi';
import type { EvmAddress, OraclePoint, VaultPosition, VaultSnapshot } from '@/types';

const VAULT_ABI = vaultAbi as readonly unknown[];
const ORACLE_ABI = navOracleAbi as readonly unknown[];
const POOL_ABI = lendingPoolAbi as readonly unknown[];

export interface RawPosition {
  borrower: EvmAddress;
  outstanding: bigint;
  collateralAmount: bigint;
  triggerBps: number;
  targetBps: number;
  maxRepayPerEvent: bigint;
  couponSweep: boolean;
  reserve: bigint;
  lastActedRound: bigint;
  revoked: boolean;
}

type RoundDataTuple = readonly [bigint, bigint, bigint, bigint, bigint];

export function toVaultPosition(raw: RawPosition): VaultPosition {
  return {
    borrower: raw.borrower,
    outstanding: raw.outstanding,
    collateralAmount: raw.collateralAmount,
    triggerBps: raw.triggerBps,
    targetBps: raw.targetBps,
    maxRepayPerEvent: raw.maxRepayPerEvent,
    isCouponSweepEnabled: raw.couponSweep,
    reserve: raw.reserve,
    lastActedRound: raw.lastActedRound,
    isAgentRevoked: raw.revoked,
  };
}

export function toOraclePoint(
  tuple: RoundDataTuple,
  decimals: number,
  observedAtSeconds: number,
): OraclePoint {
  const updatedAtSeconds = Number(tuple[3]);
  return {
    roundId: tuple[0],
    price: tuple[1],
    decimals,
    updatedAtSeconds,
    ageSeconds: Math.max(0, observedAtSeconds - updatedAtSeconds),
  };
}

function vaultCall(functionName: string) {
  return { address: DEMO_VAULT_ADDRESS, abi: VAULT_ABI, functionName } as const;
}

export async function readVaultSnapshot(): Promise<VaultSnapshot> {
  const [
    position,
    quote,
    couponDue,
    healthRatioBps,
    maxStale,
    roundData,
    oracleDecimals,
    liquidationBps,
    debtDecimals,
    collateralDecimals,
  ] = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      vaultCall('getPosition'),
      vaultCall('quoteGuardRepay'),
      vaultCall('couponDue'),
      vaultCall('healthRatioBps'),
      vaultCall('MAX_STALE'),
      { address: NAV_ORACLE_ADDRESS, abi: ORACLE_ABI, functionName: 'latestRoundData' },
      { address: NAV_ORACLE_ADDRESS, abi: ORACLE_ABI, functionName: 'decimals' },
      { address: LENDING_POOL_ADDRESS, abi: POOL_ABI, functionName: 'LIQUIDATION_BPS' },
      { address: DUSD_ADDRESS, abi: erc20DecimalsAbi, functionName: 'decimals' },
      { address: DUST_ADDRESS, abi: erc20DecimalsAbi, functionName: 'decimals' },
    ],
  });

  const observedAtSeconds = Math.floor(Date.now() / 1000);

  return {
    vault: DEMO_VAULT_ADDRESS,
    position: toVaultPosition(position as RawPosition),
    guardRepayQuote: quote as bigint,
    couponDue: couponDue as bigint,
    healthRatioBps: Number(healthRatioBps),
    liquidationBps: Number(liquidationBps),
    maxStaleSeconds: Number(maxStale as bigint),
    oracle: toOraclePoint(roundData as RoundDataTuple, Number(oracleDecimals), observedAtSeconds),
    tokens: {
      debtDecimals: Number(debtDecimals),
      collateralDecimals: Number(collateralDecimals),
    },
    observedAtSeconds,
    source: 'chain',
  };
}
