// Agent entry point — async while loop with explicit inFlight overlap guard.
//
// Responsibility boundary: process lifecycle and poll scheduling only.
// All decision logic is in guard.ts. All I/O is in the ledger implementation.
//
// Jebakan 1 (from plan.md §2) is prevented here:
//   setInterval without an inFlight flag fires a new tick before the previous
//   one finishes. One guardRepay via KeeperHub takes 10-60 seconds — by tick
//   30 the same rescue has been submitted 29 extra times.
//
//   Fix: async while + explicit inFlight boolean. New tick only starts after
//   the previous one resolves.
//
// OVERLAP_GUARD=off re-enables the bug on camera for the demo video.
// Never use it in production.

import 'dotenv/config';
import { createGuardState, runGuardCycle } from './guard.js';
import { MockLedger } from './ledger.js';
import { buildKeeperHubLedger } from './keeperhub-ledger.js';
import type { Ledger } from './ledger.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildLedger(): Ledger {
  const backend = process.env['LEDGER'] ?? 'keeperhub';
  if (backend === 'mock') {
    // Seed a demo scenario so the mock agent has something to guard.
    const ledger = new MockLedger();
    ledger.seedPriceFeed({
      oracle: '0xMOCK',
      instrumentId: 'dUST',
      price: 1.0,
    });
    ledger.seedLoan({
      borrower: '0xBORROWER',
      poolOperator: '0xPOOL',
      guardAgent: '0xAGENT',
      loanId: 'loan-1',
      principal: 6_000,
      outstanding: 6_000,
      rateBps: 0,
      collateralInstrumentId: 'dUST',
      collateralAmount: 10_000,
    });
    ledger.seedPolicy({
      borrower: '0xBORROWER',
      guardAgent: '0xAGENT',
      triggerRatioBps: 13_000,
      targetRatioBps: 14_500,
      maxRepayPerEvent: 2_000,
      couponSweep: true,
    });
    ledger.seedVault({
      borrower: '0xBORROWER',
      guardAgent: '0xAGENT',
      balance: 1_500,
    });
    return ledger;
  }
  return buildKeeperHubLedger();
}

async function main(): Promise<void> {
  const ledger = buildLedger();
  const state = createGuardState();

  // 300_000 = 5 minutes — safe for free-tier 5000/month quota.
  // Set POLL_MS=60000 only when recording demo video.
  const pollMs = Number(process.env['POLL_MS'] ?? '300000');

  // Escape hatch for demo video: turn off overlap guard to demonstrate
  // the bug, then show lastActedRound on-chain catching duplicate submits.
  const guardOn = (process.env['OVERLAP_GUARD'] ?? 'on') !== 'off';

  let running = true;
  let inFlight = false;

  process.on('SIGINT', () => {
    console.log('Shutting down agent...');
    running = false;
  });

  console.log(
    `Agent starting. ledger=${process.env['LEDGER'] ?? 'keeperhub'} ` +
      `pollMs=${pollMs} overlapGuard=${guardOn ? 'on' : 'OFF'}`,
  );

  while (running) {
    if (!guardOn || !inFlight) {
      inFlight = true;
      runGuardCycle(ledger, state, console.log)
        .catch((e) => console.log(`cycle error: ${e}`))
        .finally(() => {
          inFlight = false;
        });
    }
    await sleep(pollMs);
  }
}

// Always run main — this file is only ever an entrypoint, never imported.
main().catch((e) => {
  console.error('Fatal agent error:', e);
  process.exit(1);
});
