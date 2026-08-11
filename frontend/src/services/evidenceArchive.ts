import proofArchive from '@/../docs/evidence/proof-archive.json';
import { proofArchiveSchema } from '@/services/schemas';
import { isBackendMode, PUBLIC_ENV } from '@/constants/env';
import type { ProofEntry, RescueKind, ReceiptStatus } from '@/types';

// ─── Static archive (committed snapshot) ─────────────────────────────────────

/**
 * Synchronous — always reads the committed proof-archive.json.
 * Used by landing page, tests, and as fallback everywhere.
 */
export function readProofArchive(): ProofEntry[] {
  const parsed = proofArchiveSchema.parse(proofArchive);
  return [...parsed.entries].sort((a, b) => a.rank - b.rank);
}

export function readArchiveSourceFiles(): string[] {
  return proofArchiveSchema.parse(proofArchive).sourceFiles;
}

// ─── Backend mode: fetch live Rescued events ─────────────────────────────────

interface RescueEventView {
  id: string;
  timestamp: number;
  kind: RescueKind;
  note: string;
  amount: number | null;
  ratioBeforeBps: number | null;
  ratioAfterBps: number | null;
  price: number | null;
  transactionLink: string | null;
}

/**
 * Map a backend RescueEventView to the ProofEntry shape the frontend uses.
 */
function mapRescueEventToProofEntry(event: RescueEventView, rank: number): ProofEntry {
  const VAULT = '0x4f634d7173eFf255973E762c3Fe04DF4887FfB35' as `0x${string}`;
  const AGENT = '0x5515844B92dD96C3298Fd7d62Fb87cEE279F18D3' as `0x${string}`;

  const kindLabel = event.kind === 'guard-repay' ? 'Guard Repay' : 'Coupon Sweep';
  const receiptStatus: ReceiptStatus = 'verified';

  const reading = [
    event.amount !== null ? `Repaid ${event.amount.toFixed(6)} dUSD` : null,
    event.ratioBeforeBps !== null && event.ratioAfterBps !== null
      ? `Health: ${event.ratioBeforeBps} → ${event.ratioAfterBps} bps`
      : null,
    event.price !== null ? `NAV price: $${event.price.toFixed(8)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    id: event.id,
    rank,
    title: kindLabel,
    claim: event.note,
    caller: AGENT,
    callerRole: 'agentExecutor',
    target: VAULT,
    targetLabel: 'demo vault',
    kind: 'transaction',
    contractError: null,
    executionId: null,
    transactionLink: event.transactionLink,
    receiptStatus,
    blockNumber: null,
    gasUsed: null,
    isSponsored: true,
    reading: reading || kindLabel,
  };
}

async function fetchLiveProofEntries(): Promise<ProofEntry[]> {
  const url = `${PUBLIC_ENV.NEXT_PUBLIC_API_URL}/api/events`;
  const res = await fetch(url, { next: { revalidate: 30 } } as RequestInit);
  if (!res.ok) throw new Error(`Backend /api/events returned ${res.status}`);

  const events = (await res.json()) as RescueEventView[];
  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);
  return sorted.map((e, i) => mapRescueEventToProofEntry(e, i + 1));
}

/**
 * Async — fetches live Rescued events from backend in backend mode.
 * Falls back to the committed static archive if backend is unreachable.
 * Use this in async Server Components (proof page).
 */
export async function readProofArchiveLive(): Promise<ProofEntry[]> {
  if (isBackendMode()) {
    try {
      return await fetchLiveProofEntries();
    } catch {
      // Backend unreachable — fall back to committed archive
    }
  }
  return readProofArchive();
}


