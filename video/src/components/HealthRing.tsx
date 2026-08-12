// HealthRing.tsx — mirrors frontend/src/components/ui/HealthRing.tsx exactly,
// but drives the ring value through an animated interpolation over frames
// instead of a static prop.
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { COLORS } from '../theme';

const VISUAL_CAP_BPS = 20000;
const STROKE_WIDTH = 14;
const TRACK_STROKE = COLORS.lineSoft;
const TRIGGER_MARK_LENGTH = 6;

type HealthStatus = 'safe' | 'defending' | 'critical';

const STATUS_STROKE: Record<HealthStatus, string> = {
  safe: COLORS.safe,
  defending: COLORS.defending,
  critical: COLORS.critical,
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  safe: 'Protected',
  defending: 'Defending',
  critical: 'Needs action',
};

function toFraction(ratioBps: number): number {
  const safeBps = Number.isFinite(ratioBps) ? ratioBps : VISUAL_CAP_BPS;
  return Math.max(0, Math.min(1, safeBps / VISUAL_CAP_BPS));
}

function resolveStatus(healthBps: number, triggerBps: number, liquidationBps: number): HealthStatus {
  if (healthBps < liquidationBps) return 'critical';
  if (healthBps < triggerBps) return 'defending';
  return 'safe';
}

function formatBpsAsPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function formatBpsRaw(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

interface HealthRingProps {
  /** [fromBps, toBps] animated between [startFrame, endFrame]. Pass a single number for a static ring. */
  healthRatioBps: number | [number, number];
  triggerRatioBps: number;
  liquidationRatioBps?: number;
  /** Required only when healthRatioBps is a tuple. */
  animateFrames?: [number, number];
  size?: number;
}

export const HealthRing: React.FC<HealthRingProps> = ({
  healthRatioBps,
  triggerRatioBps,
  liquidationRatioBps = 11000,
  animateFrames,
  size = 340,
}) => {
  const frame = useCurrentFrame();

  const currentBps = Array.isArray(healthRatioBps)
    ? interpolate(
        frame,
        animateFrames ?? [0, 30],
        healthRatioBps,
        {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        },
      )
    : healthRatioBps;

  const status = resolveStatus(currentBps, triggerRatioBps, liquidationRatioBps);

  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const progress = circumference * toFraction(currentBps);
  const triggerAngleDeg = 360 * toFraction(triggerRatioBps) - 90;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${center} ${center})`}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke={TRACK_STROKE} strokeWidth={STROKE_WIDTH} />
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
          stroke={COLORS.ink}
          strokeWidth={2}
        />
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fill={COLORS.ink}
          style={{ fontSize: size * 0.16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        >
          {formatBpsAsPercent(currentBps)}
        </text>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <span style={{ display: 'block', fontSize: 20, fontWeight: 600, color: STATUS_STROKE[status] }}>
          {STATUS_LABEL[status]}
        </span>
        <span style={{ display: 'block', fontSize: 15, color: COLORS.inkMuted, fontVariantNumeric: 'tabular-nums' }}>
          Guard Trigger {formatBpsRaw(triggerRatioBps)}
        </span>
      </div>
    </div>
  );
};
