import { DEFENCE_WINDOW_LEGEND } from '@/constants/copy';
import { VISUAL_CAP_BPS } from '@/constants/protocol';
import { formatBpsRaw } from '@/utils/decimals';

const LADDER_HEIGHT_PX = 260;

interface DefenceWindowProps {
  currentRatioBps: number;
  triggerRatioBps: number;
  liquidationBps: number;
}

function toOffsetPct(ratioBps: number): number {
  const clamped = Math.max(0, Math.min(VISUAL_CAP_BPS, ratioBps));
  return 100 - (clamped / VISUAL_CAP_BPS) * 100;
}

function Marker({ ratioBps, label, tone }: { ratioBps: number; label: string; tone: string }) {
  return (
    <div
      className="absolute left-0 right-0 flex items-center gap-3"
      style={{ top: `${toOffsetPct(ratioBps)}%` }}
    >
      <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums">
        {formatBpsRaw(ratioBps)}
      </span>
      <span className={`h-0.5 flex-1 ${tone}`} />
      <span className="w-56 shrink-0 text-xs text-ink-muted">{label}</span>
    </div>
  );
}

export function DefenceWindow({
  currentRatioBps,
  triggerRatioBps,
  liquidationBps,
}: DefenceWindowProps) {
  const safeCurrentBps = Number.isFinite(currentRatioBps) ? currentRatioBps : VISUAL_CAP_BPS;
  const windowTopPct = toOffsetPct(triggerRatioBps);
  const windowBottomPct = toOffsetPct(liquidationBps);

  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-2xl font-semibold tracking-tight">The defence window</h2>
      <div
        className="relative rounded-lg border-2 border-line bg-surface p-6 shadow-card"
        style={{ height: LADDER_HEIGHT_PX }}
      >
        <div
          aria-hidden="true"
          className="absolute left-32 right-60 bg-defending-soft"
          style={{ top: `${windowTopPct}%`, height: `${windowBottomPct - windowTopPct}%` }}
        />
        <Marker ratioBps={safeCurrentBps} label={DEFENCE_WINDOW_LEGEND.position} tone="bg-safe" />
        <Marker
          ratioBps={triggerRatioBps}
          label={DEFENCE_WINDOW_LEGEND.trigger}
          tone="bg-defending"
        />
        <Marker
          ratioBps={liquidationBps}
          label={DEFENCE_WINDOW_LEGEND.liquidation}
          tone="bg-critical"
        />
      </div>
      <p className="max-w-prose text-sm text-ink-muted">
        {formatBpsRaw(triggerRatioBps - liquidationBps)} of room. {DEFENCE_WINDOW_LEGEND.window}{' '}
        Borrowing 100 against 110 of collateral is exactly {formatBpsRaw(liquidationBps)}.
      </p>
    </section>
  );
}
