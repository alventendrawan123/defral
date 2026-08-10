import { z } from 'zod';

export const evmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .transform((value) => value as `0x${string}`);

export const receiptStatusSchema = z.enum(['verified', 'reverted', 'unconfirmed']);

export const collateralSchema = z.object({
  symbol: z.string().min(1),
  address: evmAddressSchema,
  decimals: z.number().int().min(0).max(36),
  quantity: z.number().nonnegative(),
  price: z.number().nonnegative(),
  paysYield: z.boolean(),
});

export const guardPolicySchema = z.object({
  triggerRatioBps: z.number().int().positive(),
  targetRatioBps: z.number().int().positive(),
  maxRepayPerEvent: z.number().nonnegative(),
  isCouponSweepEnabled: z.boolean(),
});

export const positionSchema = z.object({
  owner: evmAddressSchema,
  collateral: collateralSchema,
  debt: z.number().nonnegative(),
  reserve: z.number().nonnegative(),
  policy: guardPolicySchema,
  isAgentRevoked: z.boolean(),
  lastActedRound: z.number().int().nonnegative(),
});

export const rescueEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  kind: z.enum(['guard-repay', 'coupon-sweep', 'no-op', 'liquidation']),
  note: z.string().min(1),
  amount: z.number().nullable(),
  ratioBeforeBps: z.number().nullable(),
  ratioAfterBps: z.number().nullable(),
  price: z.number().nullable(),
  transactionLink: z.url().nullable(),
});

export const executionSchema = z.object({
  executionId: z.string().min(1),
  attackName: z.string().min(1),
  idempotencyKey: z.string().min(1),
  wouldRevert: z.boolean(),
  revertReason: z.string().nullable(),
  receiptStatus: receiptStatusSchema,
  gasUsed: z.number().nullable(),
  transactionLink: z.url().nullable(),
  isSponsored: z.boolean(),
});

export const pricePointSchema = z.object({
  timestamp: z.number().int().nonnegative(),
  price: z.number().nonnegative(),
});

export const outcomeComparisonSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  isGuarded: z.boolean(),
  outcome: z.enum(['rescued', 'liquidated']),
  openingRatioBps: z.number().int().positive(),
  stressPrice: z.number().positive(),
  collateralSeized: z.number().nullable(),
  amountRepaid: z.number().nullable(),
  note: z.string().min(1),
  transactionLink: z.url().nullable(),
});

export const rescueEventListSchema = z.array(rescueEventSchema);
export const executionListSchema = z.array(executionSchema);
export const pricePointListSchema = z.array(pricePointSchema);
export const outcomeComparisonListSchema = z.array(outcomeComparisonSchema);
