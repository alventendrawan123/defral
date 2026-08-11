import { POSTURE_COPY } from '@/constants/copy';
import type { AgentPosture, VaultSnapshot } from '@/types';
import { formatOraclePrice, formatSecondsAsAge } from '@/utils/decimals';

const POSTURE_CLASS: Record<AgentPosture, string> = {
  'idle-healthy': 'border-safe bg-safe-soft text-safe',
  'would-defend': 'border-defending bg-defending-soft text-defending',
  'oracle-stale': 'border-defending bg-defending-soft text-defending',
  revoked: 'border-critical bg-critical-soft text-critical',
};

interface OraclePanelProps {
  snapshot: VaultSnapshot;
  posture: AgentPosture;
}

export function OraclePanel({ snapshot, posture }: OraclePanelProps) {
  const { oracle, maxStaleSeconds } = snapshot;
  const isStale = oracle.ageSeconds > maxStaleSeconds;

  return (
    <section className="flex flex-col gap-4 rounded-lg border-2 border-line bg-surface p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Price and posture</h2>
        <span
          className={`rounded-full border px-3 py-1 font-mono text-xs ${POSTURE_CLASS[posture]}`}
        >
          {POSTURE_COPY[posture].label}
        </span>
      </div>

      <p className="max-w-prose text-sm text-ink-muted">{POSTURE_COPY[posture].body}</p>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-muted">Last price</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {formatOraclePrice(oracle.price, oracle.decimals)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-muted">Oracle round</dt>
          <dd className="text-lg font-semibold tabular-nums">{oracle.roundId.toString()}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-muted">Price age</dt>
          <dd
            className={`text-lg font-semibold tabular-nums ${isStale ? 'text-defending' : undefined}`}
          >
            {formatSecondsAsAge(oracle.ageSeconds)}
          </dd>
          <p className="text-xs text-ink-muted">
            Refused above {formatSecondsAsAge(maxStaleSeconds)}
          </p>
        </div>
      </dl>
    </section>
  );
}
