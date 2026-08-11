// openapi.ts — canonical OpenAPI 3.1 spec for the Defral backend API.
//
// Kept as a plain JS object (not YAML) so TypeScript can type-check it and
// tests can import it without a build step.
//
// Served at GET /openapi.json
// Rendered by Scalar at GET /docs

import type { OpenAPIObject } from 'openapi3-ts/oas31';

export const openApiSpec: OpenAPIObject = {
  openapi: '3.1.0',
  info: {
    title: 'Defral Backend API',
    version: '0.1.0',
    description: `
## Overview

The Defral backend bridges the Next.js frontend with the **DefralVault** and
**MockLendingPool** smart contracts deployed on **Base Sepolia**.

All reads are batched into a **single \`multicall3\`** per request — one block,
zero cross-block inconsistency. Writes (guardRepay / sweepCoupon) are routed
through **KeeperHub** so the agent never holds dUSD and the API key never
reaches the browser.

## Authentication

No authentication is required for read endpoints. The \`KEEPERHUB_API_KEY\`
environment variable is consumed server-side only — it is never forwarded to
the client.

## Rate limiting

60 requests per minute per IP. The \`RateLimit-*\` response headers follow
the IETF draft standard.

## Chain

All contract addresses are on **Base Sepolia** (chainId \`84532\`).
    `.trim(),
    contact: {
      name: 'Defral',
      url: 'https://github.com/defral',
    },
    license: {
      name: 'MIT',
    },
  },

  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local development',
    },
  ],

  tags: [
    {
      name: 'Vault',
      description: 'Live on-chain vault snapshot and position data',
    },
    {
      name: 'Events',
      description: 'Rescued event log from the DefralVault contract',
    },
    {
      name: 'Executions',
      description: 'KeeperHub execution status proxy',
    },
    {
      name: 'System',
      description: 'Health and metadata endpoints',
    },
  ],

  paths: {
    // ── GET /api/position ────────────────────────────────────────────────────
    '/api/position': {
      get: {
        operationId: 'getPosition',
        tags: ['Vault'],
        summary: 'Get live vault snapshot',
        description: `
Fetches a single atomic snapshot of the **DefralVault** by batching all reads
into one \`multicall3\` call. The result reflects a single block — there are no
cross-block race conditions.

Returns the full position, oracle state, guard policy, reserve balance, health
ratio, and token decimals needed to render the dashboard and vault pages.

Falls back to the committed snapshot in \`docs/evidence/chain-snapshot.json\`
when the RPC is unreachable (frontend-only mode).
        `.trim(),
        responses: {
          '200': {
            description: 'Vault snapshot',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PositionView' },
                examples: {
                  healthy: {
                    summary: 'Healthy position at par price',
                    value: {
                      vault: '0x4f634d7173eFf255973E762c3Fe04DF4887FfB35',
                      blockNumber: '20123456',
                      position: {
                        borrower: '0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2',
                        outstanding: '6000000000',
                        collateralAmount: '10000000000000000000000',
                        triggerBps: 13000,
                        targetBps: 14500,
                        maxRepayPerEvent: '2000000000',
                        isCouponSweepEnabled: true,
                        reserve: '1500000000',
                        lastActedRound: '2',
                        isAgentRevoked: false,
                      },
                      guardRepayQuote: '0',
                      couponDue: '0',
                      healthRatioBps: 16667,
                      liquidationBps: 11000,
                      maxStaleSeconds: 3600,
                      oracle: {
                        roundId: '3',
                        price: '100000000',
                        decimals: 8,
                        updatedAtSeconds: 1723380000,
                        ageSeconds: 42,
                      },
                      tokens: {
                        debtDecimals: 6,
                        collateralDecimals: 18,
                      },
                      observedAtSeconds: 1723380042,
                    },
                  },
                  defending: {
                    summary: 'Position after price dip to 0.76 — agent defending',
                    value: {
                      vault: '0x4f634d7173eFf255973E762c3Fe04DF4887FfB35',
                      blockNumber: '20123789',
                      position: {
                        borrower: '0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2',
                        outstanding: '5241380000',
                        collateralAmount: '10000000000000000000000',
                        triggerBps: 13000,
                        targetBps: 14500,
                        maxRepayPerEvent: '2000000000',
                        isCouponSweepEnabled: true,
                        reserve: '741380000',
                        lastActedRound: '3',
                        isAgentRevoked: false,
                      },
                      guardRepayQuote: '0',
                      couponDue: '112500000',
                      healthRatioBps: 14500,
                      liquidationBps: 11000,
                      maxStaleSeconds: 3600,
                      oracle: {
                        roundId: '3',
                        price: '76000000',
                        decimals: 8,
                        updatedAtSeconds: 1723380300,
                        ageSeconds: 12,
                      },
                      tokens: {
                        debtDecimals: 6,
                        collateralDecimals: 18,
                      },
                      observedAtSeconds: 1723380312,
                    },
                  },
                },
              },
            },
          },
          '500': { $ref: '#/components/responses/InternalError' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    // ── GET /api/events ──────────────────────────────────────────────────────
    '/api/events': {
      get: {
        operationId: 'getEvents',
        tags: ['Events'],
        summary: 'Get Rescued event log',
        description: `
Fetches all **Rescued** events emitted by the DefralVault contract, decoded
from on-chain logs in 2 000-block chunks.

Each event records a guard action — either a **guard-repay** (health restored
by repaying from the reserve) or a **coupon-sweep** (yield applied to debt).

The \`kind\` field uses the \`uint8\` from the contract ABI — never inferred
from error message strings.

| kind value | label |
|---|---|
| 1 | \`guard-repay\` |
| 2 | \`coupon-sweep\` |
        `.trim(),
        parameters: [
          {
            name: 'fromBlock',
            in: 'query',
            required: false,
            description:
              'Fetch events from this block number onwards (inclusive). Defaults to block 0.',
            schema: {
              type: 'string',
              pattern: '^[0-9]+$',
              example: '20100000',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Array of rescue events (may be empty)',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/RescueEventView' },
                },
                examples: {
                  guardRepay: {
                    summary: 'Guard repay event',
                    value: [
                      {
                        id: '0xabc123-0',
                        timestamp: 1723380312,
                        kind: 'guard-repay',
                        note: 'guard-repay roundId=3',
                        amount: 758.62,
                        ratioBeforeBps: 12667,
                        ratioAfterBps: 14500,
                        price: 0.76,
                        transactionLink:
                          'https://sepolia.basescan.org/tx/0xabc123',
                      },
                    ],
                  },
                  empty: {
                    summary: 'No events yet',
                    value: [],
                  },
                },
              },
            },
          },
          '500': { $ref: '#/components/responses/InternalError' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    // ── GET /api/executions/:id ──────────────────────────────────────────────
    '/api/executions/{id}': {
      get: {
        operationId: 'getExecution',
        tags: ['Executions'],
        summary: 'Get KeeperHub execution status',
        description: `
Proxies a single KeeperHub execution status lookup.

The \`KEEPERHUB_API_KEY\` is consumed server-side — the browser never sees it.

**Receipt status values:**

| value | meaning |
|---|---|
| \`verified\` | Transaction mined and successful |
| \`reverted\` | Transaction mined but the contract reverted |
| \`unconfirmed\` | Submitted but not yet mined |
| \`timeout\` | KeeperHub gave up waiting — reconcile via event log |
| \`not_found\` | Execution ID unknown to KeeperHub |

> ⚠️ **Do not re-broadcast** on \`timeout\` or \`not_found\`. Use \`GET /api/events\`
> to confirm whether the rescue actually landed on-chain before retrying.
        `.trim(),
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'KeeperHub execution ID returned by the agent',
            schema: {
              type: 'string',
              example: 'yjh4l0m4d9jgy7qtt6g6r',
            },
          },
        ],
        responses: {
          '200': {
            description: 'KeeperHub execution object',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ExecutionView' },
                examples: {
                  success: {
                    summary: 'Successful guardRepay execution',
                    value: {
                      executionId: 'yjh4l0m4d9jgy7qtt6g6r',
                      status: 'completed',
                      error: null,
                      receiptStatus: 'verified',
                      transactionLink:
                        'https://sepolia.basescan.org/tx/0xdef456',
                      gasUsed: 84231,
                      isSponsored: true,
                    },
                  },
                  refusal: {
                    summary: 'Refused_Healthy — agent cannot act on healthy position',
                    value: {
                      executionId: 'abc123xyz',
                      status: 'failed',
                      error: 'Contract call failed: Refused_Healthy(16667, 13000)',
                      receiptStatus: 'reverted',
                      transactionLink:
                        'https://sepolia.basescan.org/tx/0xfailed',
                      gasUsed: 21000,
                      isSponsored: true,
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Execution not found in KeeperHub',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '503': {
            description: 'KEEPERHUB_API_KEY not configured on this server',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    // ── GET /health ──────────────────────────────────────────────────────────
    '/health': {
      get: {
        operationId: 'healthCheck',
        tags: ['System'],
        summary: 'Server health check',
        description: 'Returns `{ status: "ok", ts: "<ISO timestamp>" }`. Used by uptime monitors.',
        responses: {
          '200': {
            description: 'Server is up',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'ts'],
                  properties: {
                    status: { type: 'string', enum: ['ok'] },
                    ts: {
                      type: 'string',
                      format: 'date-time',
                      example: '2026-08-11T15:00:00.000Z',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  components: {
    schemas: {
      // ── PositionView ───────────────────────────────────────────────────────
      PositionView: {
        type: 'object',
        required: [
          'vault',
          'position',
          'guardRepayQuote',
          'couponDue',
          'healthRatioBps',
          'liquidationBps',
          'maxStaleSeconds',
          'oracle',
          'tokens',
          'observedAtSeconds',
        ],
        properties: {
          vault: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            description: 'DefralVault contract address',
            example: '0x4f634d7173eFf255973E762c3Fe04DF4887FfB35',
          },
          blockNumber: {
            type: 'string',
            nullable: true,
            description: 'Block number at time of snapshot (decimal string)',
            example: '20123456',
          },
          position: { $ref: '#/components/schemas/VaultPosition' },
          guardRepayQuote: {
            type: 'string',
            description:
              'Amount (dUSD, 6dp, decimal string) the agent would repay if guardRepay is called now. "0" when position is healthy.',
            example: '758620000',
          },
          couponDue: {
            type: 'string',
            description: 'Accrued coupon balance (dUSD, 6dp, decimal string) pending sweep.',
            example: '112500000',
          },
          healthRatioBps: {
            type: 'integer',
            description:
              'collateralValue / outstanding × 10 000. 16667 = 166.67%. Infinity (MAX_SAFE_INTEGER) when no debt.',
            example: 16667,
          },
          liquidationBps: {
            type: 'integer',
            description: 'Health ratio below which the pool can liquidate. Typically 11000 (110%).',
            example: 11000,
          },
          maxStaleSeconds: {
            type: 'integer',
            description: 'Maximum oracle age in seconds before the agent refuses to act.',
            example: 3600,
          },
          oracle: { $ref: '#/components/schemas/OraclePoint' },
          tokens: { $ref: '#/components/schemas/TokenDecimals' },
          observedAtSeconds: {
            type: 'integer',
            description: 'Unix timestamp (seconds) when this snapshot was taken.',
            example: 1723380042,
          },
        },
      },

      // ── VaultPosition ──────────────────────────────────────────────────────
      VaultPosition: {
        type: 'object',
        required: [
          'borrower',
          'outstanding',
          'collateralAmount',
          'triggerBps',
          'targetBps',
          'maxRepayPerEvent',
          'isCouponSweepEnabled',
          'reserve',
          'lastActedRound',
          'isAgentRevoked',
        ],
        properties: {
          borrower: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            description: 'Borrower wallet address',
            example: '0x0a25a241Ad0c397136dE68ccF2D9fC1EC68Dc7f2',
          },
          outstanding: {
            type: 'string',
            description: 'Outstanding debt (dUSD, 6dp, decimal string)',
            example: '6000000000',
          },
          collateralAmount: {
            type: 'string',
            description: 'Collateral locked in vault (dUST, 18dp, decimal string)',
            example: '10000000000000000000000',
          },
          triggerBps: {
            type: 'integer',
            description: 'Health ratio (bps) at which the agent triggers a guard-repay. Default 13000 (130%).',
            example: 13000,
          },
          targetBps: {
            type: 'integer',
            description: 'Health ratio (bps) the agent repays to. Default 14500 (145%).',
            example: 14500,
          },
          maxRepayPerEvent: {
            type: 'string',
            description: 'Maximum dUSD the agent may repay in a single event (6dp, decimal string)',
            example: '2000000000',
          },
          isCouponSweepEnabled: {
            type: 'boolean',
            description: 'Whether the agent is authorised to sweep accrued coupons to debt.',
            example: true,
          },
          reserve: {
            type: 'string',
            description: 'dUSD balance held in the vault as repayment reserve (6dp, decimal string)',
            example: '1500000000',
          },
          lastActedRound: {
            type: 'string',
            description: 'Oracle roundId on which the agent last fired. Prevents double-acting on the same observation.',
            example: '2',
          },
          isAgentRevoked: {
            type: 'boolean',
            description: 'Whether the borrower has revoked agent authority. When true, agent cannot act.',
            example: false,
          },
        },
      },

      // ── OraclePoint ────────────────────────────────────────────────────────
      OraclePoint: {
        type: 'object',
        required: ['roundId', 'price', 'decimals', 'updatedAtSeconds', 'ageSeconds'],
        properties: {
          roundId: {
            type: 'string',
            description: 'Chainlink-compatible oracle round identifier (decimal string)',
            example: '3',
          },
          price: {
            type: 'string',
            description: 'Raw oracle answer (decimal string). Divide by 10^decimals for human value.',
            example: '100000000',
          },
          decimals: {
            type: 'integer',
            description: 'Number of decimal places in the price answer. Typically 8.',
            example: 8,
          },
          updatedAtSeconds: {
            type: 'integer',
            description: 'Unix timestamp (seconds) when the oracle was last updated.',
            example: 1723380000,
          },
          ageSeconds: {
            type: 'integer',
            description:
              'Seconds elapsed since the oracle was last updated. Compared against maxStaleSeconds to detect stale feeds.',
            example: 42,
          },
        },
      },

      // ── TokenDecimals ──────────────────────────────────────────────────────
      TokenDecimals: {
        type: 'object',
        required: ['debtDecimals', 'collateralDecimals'],
        properties: {
          debtDecimals: {
            type: 'integer',
            description: 'Decimal places of the debt token (dUSD). Always 6.',
            example: 6,
          },
          collateralDecimals: {
            type: 'integer',
            description: 'Decimal places of the collateral token (dUST). Always 18.',
            example: 18,
          },
        },
      },

      // ── RescueEventView ────────────────────────────────────────────────────
      RescueEventView: {
        type: 'object',
        required: ['id', 'timestamp', 'kind', 'note', 'amount', 'ratioBeforeBps', 'ratioAfterBps', 'price', 'transactionLink'],
        properties: {
          id: {
            type: 'string',
            description: 'Composite ID: `{txHash}-{logIndex}`',
            example: '0xabc123-0',
          },
          timestamp: {
            type: 'integer',
            description: 'Unix timestamp (seconds) from the `at` field of the Rescued event.',
            example: 1723380312,
          },
          kind: {
            type: 'string',
            enum: ['guard-repay', 'coupon-sweep', 'no-op', 'liquidation'],
            description: 'Rescue action kind decoded from the `uint8 kind` field in the Rescued event.',
            example: 'guard-repay',
          },
          note: {
            type: 'string',
            description: 'Human-readable description including the oracle roundId.',
            example: 'guard-repay roundId=3',
          },
          amount: {
            type: 'number',
            nullable: true,
            description: 'Amount repaid or swept (dUSD, human decimal). Null for no-op events.',
            example: 758.62,
          },
          ratioBeforeBps: {
            type: 'integer',
            nullable: true,
            description: 'Health ratio (bps) before the rescue.',
            example: 12667,
          },
          ratioAfterBps: {
            type: 'integer',
            nullable: true,
            description: 'Health ratio (bps) after the rescue.',
            example: 14500,
          },
          price: {
            type: 'number',
            nullable: true,
            description: 'Oracle price at time of rescue (human decimal, e.g. 0.76).',
            example: 0.76,
          },
          transactionLink: {
            type: 'string',
            nullable: true,
            description: 'BaseScan transaction URL.',
            example: 'https://sepolia.basescan.org/tx/0xabc123',
          },
        },
      },

      // ── ExecutionView ──────────────────────────────────────────────────────
      ExecutionView: {
        type: 'object',
        required: ['executionId', 'status'],
        properties: {
          executionId: {
            type: 'string',
            description: 'KeeperHub execution identifier',
            example: 'yjh4l0m4d9jgy7qtt6g6r',
          },
          status: {
            type: 'string',
            enum: ['completed', 'failed', 'pending'],
            description: '`completed` = terminal (check receiptStatus). `failed` = contract reverted (Bentuk A). `pending` = still in flight.',
            example: 'completed',
          },
          error: {
            type: 'string',
            nullable: true,
            description: 'Decoded revert reason when status is `failed`.',
            example: 'Contract call failed: Refused_Healthy(16667, 13000)',
          },
          receiptStatus: {
            type: 'string',
            nullable: true,
            enum: ['verified', 'reverted', 'unconfirmed', 'timeout', 'not_found'],
            description: 'On-chain receipt status. `verified` = success. `reverted` = mined but failed. Others = unknown outcome — reconcile via /api/events.',
            example: 'verified',
          },
          transactionLink: {
            type: 'string',
            nullable: true,
            description: 'BaseScan transaction URL.',
            example: 'https://sepolia.basescan.org/tx/0xdef456',
          },
          gasUsed: {
            type: 'integer',
            nullable: true,
            description: 'Gas consumed by the transaction.',
            example: 84231,
          },
          isSponsored: {
            type: 'boolean',
            description: 'Whether KeeperHub sponsored the gas fee.',
            example: true,
          },
        },
      },

      // ── ErrorResponse ──────────────────────────────────────────────────────
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'string',
            description: 'Human-readable error message',
            example: 'internal server error',
          },
        },
      },
    },

    responses: {
      InternalError: {
        description: 'Unexpected server error (chain unreachable, multicall failure, etc.)',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: { error: 'internal server error' },
          },
        },
      },
      RateLimited: {
        description: 'Rate limit exceeded (60 req/min per IP)',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: { error: 'rate limit exceeded — slow down frontend polling' },
          },
        },
      },
    },
  },
};
