import { STATUS_LABEL } from '@/constants/copy';
import { VISUAL_CAP_BPS } from '@/constants/protocol';
import type { HealthStatus } from '@/types';
import { formatBps, formatRatioBps } from '@/utils/format';

const STATUS_STROKE: Record<HealthStatus, string> = {
  safe: 'var(--color-safe)',
  defending: 'var(--color-defending)',
  critical: 'var(--color-critical)',
};

const STATUS_TEXT_CLASS: Record<HealthStatus, string> = {
  safe: 'text-safe',
  defending: 'text-defending',
  critical: 'text-critical',
};

const STROKE_WIDTH = 14;
const TRACK_STROKE = 'var(--color-line-soft)';
const TRIGGER_MARK_LENGTH = 6;

interface HealthRingProps {
  healthRatioBps: number;
  triggerRatioBps: number;
  status: HealthStatus;
  size?: number;
}

function toFraction(ratioBps: number): number {
  const safeBps = Number.isFinite(ratioBps) ? ratioBps : VISUAL_CAP_BPS;
  return Math.max(0, Math.min(1, safeBps / VISUAL_CAP_BPS));
}

export function HealthRing({
  healthRatioBps,
  triggerRatioBps,
  status,
  size = 260,
}: HealthRingProps) {
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const progress = circumference * toFraction(healthRatioBps);
  const triggerAngleDeg = 360 * toFraction(triggerRatioBps) - 90;

  return (
    <figure className="inline-flex flex-col items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Health ratio ${formatRatioBps(healthRatioBps)}, status ${STATUS_LABEL[status]}`}
      >
        <g transform={`rotate(-90 ${center} ${center})`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={TRACK_STROKE}
            strokeWidth={STROKE_WIDTH}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={STATUS_STROKE[status]}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference - progress}`}
          />
        </g>
        <line
          x1={center + (radius - TRIGGER_MARK_LENGTH) * Math.cos((triggerAngleDeg * Math.PI) / 180)}
          y1={center + (radius - TRIGGER_MARK_LENGTH) * Math.sin((triggerAngleDeg * Math.PI) / 180)}
          x2={center + (radius + TRIGGER_MARK_LENGTH) * Math.cos((triggerAngleDeg * Math.PI) / 180)}
          y2={center + (radius + TRIGGER_MARK_LENGTH) * Math.sin((triggerAngleDeg * Math.PI) / 180)}
          stroke="var(--color-ink)"
          strokeWidth={2}
        />
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-ink text-4xl tabular-nums"
          style={{ fontSize: size * 0.16, fontWeight: 600 }}
        >
          {formatRatioBps(healthRatioBps)}
        </text>
      </svg>
      <figcaption className="text-center">
        <span className={`block text-sm font-semibold ${STATUS_TEXT_CLASS[status]}`}>
          {STATUS_LABEL[status]}
        </span>
        <span className="block text-xs tabular-nums text-ink-muted">
          Guard Trigger {formatBps(triggerRatioBps)}
        </span>
      </figcaption>
    </figure>
  );
}
