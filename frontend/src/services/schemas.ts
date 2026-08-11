import { z } from 'zod';

export const evmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .transform((value) => value as `0x${string}`);

export const receiptStatusSchema = z.enum(['verified', 'reverted', 'unconfirmed']);

export const proofEntrySchema = z
  .object({
    id: z.string().min(1),
    rank: z.number().int().positive(),
    title: z.string().min(1),
    claim: z.string().min(1),
    caller: evmAddressSchema,
    callerRole: z.string().min(1),
    target: evmAddressSchema,
    targetLabel: z.string().min(1),
    kind: z.enum(['transaction', 'execution-record']),
    contractError: z.string().nullable(),
    executionId: z.string().min(1).nullable(),
    transactionLink: z.url().nullable(),
    receiptStatus: receiptStatusSchema,
    blockNumber: z.number().int().positive().nullable(),
    gasUsed: z.number().int().positive().nullable(),
    isSponsored: z.boolean(),
    reading: z.string().min(1),
  })
  .refine((entry) => (entry.kind === 'transaction') === (entry.transactionLink !== null), {
    message: 'a transaction entry needs a link, and an execution record must not have one',
    path: ['transactionLink'],
  })
  .refine((entry) => entry.kind === 'transaction' || entry.executionId !== null, {
    message: 'an execution record must carry its executionId',
    path: ['executionId'],
  });

const uintStringSchema = z.string().regex(/^\d+$/);

export const chainSnapshotSchema = z.object({
  vault: evmAddressSchema,
  blockNumber: uintStringSchema,
  position: z.object({
    borrower: evmAddressSchema,
    outstanding: uintStringSchema,
    collateralAmount: uintStringSchema,
    triggerBps: z.number().int().positive(),
    targetBps: z.number().int().positive(),
    maxRepayPerEvent: uintStringSchema,
    isCouponSweepEnabled: z.boolean(),
    reserve: uintStringSchema,
    lastActedRound: uintStringSchema,
    isAgentRevoked: z.boolean(),
  }),
  guardRepayQuote: uintStringSchema,
  couponDue: uintStringSchema,
  healthRatioBps: z.number().int().nonnegative(),
  liquidationBps: z.number().int().positive(),
  maxStaleSeconds: z.number().int().positive(),
  tokens: z.object({
    debtDecimals: z.number().int().nonnegative(),
    collateralDecimals: z.number().int().nonnegative(),
  }),
  oracle: z.object({
    roundId: uintStringSchema,
    price: uintStringSchema,
    decimals: z.number().int().nonnegative(),
    updatedAtSeconds: z.number().int().positive(),
  }),
});

export const proofArchiveSchema = z.object({
  sourceFiles: z.array(z.string().min(1)).min(1),
  readAt: z.string().min(1),
  entries: z.array(proofEntrySchema).min(1),
});
