// backend/src/index.ts — Express HTTP server.
//
// Thin bridge between the frontend and the chain. ALL chain I/O is isolated
// in ./evm-ledger.ts — this file only wires HTTP routes to that interface
// and NEVER talks to the chain directly.
//
// Routes:
//   GET /api/position    → VaultSnapshot (multicall, atomic one block)
//   GET /api/events      → Rescued event log
//   GET /api/executions/:id → proxy KeeperHub execution status
//
// Security: KEEPERHUB_API_KEY never leaves this process — the browser never
// sees it. Rate limiting prevents quota exhaustion from frontend polling.

import 'dotenv/config';
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import rateLimit from 'express-rate-limit';
import { apiReference } from '@scalar/express-api-reference';

import {
  evmLedgerConfigFromEnv,
  fetchPositionView,
  fetchRescueEvents,
} from './evm-ledger.js';
import { openApiSpec } from './openapi.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

// ─── App factory ─────────────────────────────────────────────────────────────

export function createApp() {
  const app = express();

  // PaaS terminates TLS at reverse proxy: without this, req.ip points to the
  // proxy address for EVERY visitor, so the rate limiter counts all traffic
  // as one IP instead of one per visitor.
  app.set('trust proxy', true);

  app.use(express.json());

  // CORS — allow the Next.js frontend origin.
  app.use((_req, res, next) => {
    const origin = process.env['ALLOWED_ORIGIN'] ?? 'http://localhost:3000';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // Rate limiter — 60 req/min per IP matches KeeperHub's own rate limit.
  // Guards against the frontend poll accidentally exhausting the quota.
  const limiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate limit exceeded — slow down frontend polling' },
  });
  app.use('/api', limiter);

  // ── Route helpers ─────────────────────────────────────────────────────────

  /** Wraps an async handler so unhandled rejections reach the error handler. */
  const asyncRoute =
    (fn: AsyncHandler) =>
    (req: Request, res: Response, next: NextFunction): void => {
      fn(req, res).catch(next);
    };

  const cfg = evmLedgerConfigFromEnv();

  // ── GET /openapi.json ────────────────────────────────────────────────────

  app.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  // ── GET /docs — Scalar API reference UI ──────────────────────────────────

  app.use(
    '/docs',
    apiReference({
      spec: { url: '/openapi.json' },
      theme: 'default',
      layout: 'modern',
      defaultHttpClient: { targetKey: 'js', clientKey: 'fetch' },
    }),
  );

  // ── GET /api/position ─────────────────────────────────────────────────────

  app.get(
    '/api/position',
    asyncRoute(async (_req, res) => {
      const position = await fetchPositionView(cfg);
      res.json(position);
    }),
  );

  // ── GET /api/events ───────────────────────────────────────────────────────

  app.get(
    '/api/events',
    asyncRoute(async (req, res) => {
      const fromBlock = req.query['fromBlock']
        ? BigInt(String(req.query['fromBlock']))
        : undefined;
      const events = await fetchRescueEvents(cfg, fromBlock);
      res.json(events);
    }),
  );

  // ── GET /api/executions/:id ───────────────────────────────────────────────
  // Proxy KeeperHub execution status so the frontend can render
  // verified/receiptStatus/transactionLink without ever seeing the API key.

  app.get(
    '/api/executions/:id',
    asyncRoute(async (req, res) => {
      const { id } = req.params;
      const apiKey = process.env['KEEPERHUB_API_KEY'];
      if (!apiKey) {
        res.status(503).json({ error: 'KEEPERHUB_API_KEY not configured' });
        return;
      }

      const khRes = await fetch(
        `https://app.keeperhub.com/api/execute/contract-call/${id}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );

      if (!khRes.ok) {
        res.status(khRes.status).json({ error: `KeeperHub returned ${khRes.status}` });
        return;
      }

      const data = await khRes.json();
      res.json(data);
    }),
  );

  // ── Health check ──────────────────────────────────────────────────────────

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // ── Centralised error handler ─────────────────────────────────────────────
  // All route-level errors are caught by asyncRoute and forwarded here.
  // One place to map error classes to HTTP status — never scattered inline.

  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ): void => {
      if (err instanceof Error) {
        console.error(`[error] ${err.message}`);

        // Validation errors → 400
        if (err.name === 'LedgerValidationError') {
          res.status(400).json({ error: err.message });
          return;
        }

        // Conflict errors → 409
        if (err.name === 'LedgerConflictError') {
          res.status(409).json({ error: err.message });
          return;
        }
      } else {
        console.error('[error] unknown', err);
      }

      res.status(500).json({ error: 'internal server error' });
    },
  );

  return app;
}

// Always run server — this file is only ever an entrypoint, never imported.
const app = createApp();
const port = Number(process.env['PORT'] ?? '3001');
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
