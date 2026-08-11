import { readFileSync, writeFileSync } from 'node:fs';

import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://sepolia.base.org';
const VAULT = '0x4f634d7173eFf255973E762c3Fe04DF4887FfB35';
const ORACLE = '0x44B94bb593F6De51Ad3385264C0168eEc8E56392';
const POOL = '0x35371eD6E29ddE1fDE4DBe8A6048fFb0C860b9eD';
const DUSD = '0x9D9734fBb490b603A27f82ec0e23cDfDD9D6b838';
const DUST = '0x0A72124d5e606aB4264a653B6942738CBAbd2D43';
const erc20DecimalsAbi = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
];
const OUTPUT = 'docs/evidence/chain-snapshot.json';

const abi = (name) => JSON.parse(readFileSync(`docs/abi/${name}.json`, 'utf8'));
const vaultAbi = abi('DefralVault');
const oracleAbi = abi('NavOracle');
const poolAbi = abi('MockLendingPool');

const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
const vaultCall = (functionName) => ({ address: VAULT, abi: vaultAbi, functionName });

const [
  position,
  quote,
  couponDue,
  health,
  maxStale,
  roundData,
  oracleDecimals,
  liquidationBps,
  debtDecimals,
  collateralDecimals,
] =
  await client.multicall({
    allowFailure: false,
    contracts: [
      vaultCall('getPosition'),
      vaultCall('quoteGuardRepay'),
      vaultCall('couponDue'),
      vaultCall('healthRatioBps'),
      vaultCall('MAX_STALE'),
      { address: ORACLE, abi: oracleAbi, functionName: 'latestRoundData' },
      { address: ORACLE, abi: oracleAbi, functionName: 'decimals' },
      { address: POOL, abi: poolAbi, functionName: 'LIQUIDATION_BPS' },
      { address: DUSD, abi: erc20DecimalsAbi, functionName: 'decimals' },
      { address: DUST, abi: erc20DecimalsAbi, functionName: 'decimals' },
    ],
  });

const blockNumber = await client.getBlockNumber();

const snapshot = {
  vault: VAULT,
  blockNumber: blockNumber.toString(),
  position: {
    borrower: position.borrower,
    outstanding: position.outstanding.toString(),
    collateralAmount: position.collateralAmount.toString(),
    triggerBps: position.triggerBps,
    targetBps: position.targetBps,
    maxRepayPerEvent: position.maxRepayPerEvent.toString(),
    isCouponSweepEnabled: position.couponSweep,
    reserve: position.reserve.toString(),
    lastActedRound: position.lastActedRound.toString(),
    isAgentRevoked: position.revoked,
  },
  guardRepayQuote: quote.toString(),
  couponDue: couponDue.toString(),
  healthRatioBps: Number(health),
  liquidationBps: Number(liquidationBps),
  maxStaleSeconds: Number(maxStale),
  tokens: {
    debtDecimals: Number(debtDecimals),
    collateralDecimals: Number(collateralDecimals),
  },
  oracle: {
    roundId: roundData[0].toString(),
    price: roundData[1].toString(),
    decimals: Number(oracleDecimals),
    updatedAtSeconds: Number(roundData[3]),
  },
};

writeFileSync(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
process.stdout.write(`wrote ${OUTPUT} at block ${snapshot.blockNumber}\n`);
