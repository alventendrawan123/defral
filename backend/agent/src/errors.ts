// Typed error classes for every distinct failure mode the agent can encounter.
//
// Responsibility boundary: error taxonomy only. One class per failure category.
// All catch handlers in guard.ts and keeperhub-ledger.ts branch on these
// classes — never on string matching. Adding a new class here forces every
// catch site to handle it explicitly.

/**
 * The contract rejected the call with a deterministic on-chain error.
 * Examples: Refused_Healthy, Refused_AlreadyActed, Refused_NoCouponDue.
 *
 * Action: do NOT retry. Wait for the next oracle round.
 * The error string is the decoded custom-error message from KeeperHub.
 */
export class ExecutionRevertedError extends Error {
  constructor(public readonly revertReason: string) {
    super(`Contract reverted: ${revertReason}`);
    this.name = 'ExecutionRevertedError';
  }
}

/**
 * The outcome of the execution is unknown — it may or may not have landed.
 * KeeperHub returned receiptStatus "timeout" | "not_found" | "unconfirmed".
 *
 * Action: do NOT re-broadcast. Reconcile via on-chain Rescued event log.
 * Re-broadcasting risks a double-spend.
 */
export class ExecutionUnknownError extends Error {
  constructor(public readonly receipt: unknown) {
    super(`Execution outcome unknown — reconcile via event log`);
    this.name = 'ExecutionUnknownError';
  }
}

/**
 * Input to a ledger method was invalid before any network call was made.
 * HTTP equivalent: 400.
 */
export class LedgerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerValidationError';
  }
}

/**
 * The requested action conflicts with current on-chain state.
 * HTTP equivalent: 409.
 */
export class LedgerConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerConflictError';
  }
}

/**
 * KeeperHub returned 403 "Daily spending cap exceeded".
 *
 * Action: STOP submitting immediately. Do not retry — retrying burns
 * remaining quota on a capped account and produces no executions.
 */
export class SpendingCapError extends Error {
  constructor() {
    super('KeeperHub daily spending cap exceeded — halting submissions');
    this.name = 'SpendingCapError';
  }
}

/** Extract a safe string message from an unknown thrown value. */
export function msg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
