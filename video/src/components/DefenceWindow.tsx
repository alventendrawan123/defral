// DefenceWindow.tsx — the bps ladder diagram: 16667 → 13000 (trigger) →
// 11000 (liquidation). Mirrors the PRD §4.3 defence window exactly.
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { COLORS, DEMO } from '../theme';

interface DefenceWindowProps {
  /** Animate the position marker from one bps value to another. */
  positionBps: [number, number];
  animateFrames: [number, number];
  width?: number;
}

const SCALE_TOP = 20000; // bps shown at top of the ladder
const SCALE_BOTTOM = 8000; // bps shown at bottom

function bpsToY(bps: number, height: number): number {
  const clamped = Math.max(SCALE_BOTTOM, Math.min(SCALE_TOP, bps));
  const fraction = (SCALE_TOP - clamped) / (SCALE_TOP - SCALE_BOTTOM);
  return fraction * height;
}

export const DefenceWindow: React.FC<DefenceWindowProps> = ({
  positionBps,
  animateFrames,
  width = 640,
}) => {
  const frame = useCurrentFrame();
  const height = 520;
  const laneX = width / 2;
  const laneWidth = 120;

  const currentBps = interpolate(frame, animateFrames, positionBps, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const triggerY = bpsToY(DEMO.triggerBps, height);
  const liquidationY = bpsToY(DEMO.liquidationBps, height);
  const positionY = bpsToY(currentBps, height);

  const inWindow = currentBps < DEMO.triggerBps && currentBps >= DEMO.liquidationBps;
  const markerColor = inWindow
    ? COLORS.defending
    : currentBps >= DEMO.triggerBps
      ? COLORS.safe
      : COLORS.critical;

  return (
    <svg width={width} height={height + 60} viewBox={`0 0 ${width} ${height + 60}`}>
      {/* Safe zone (above trigger) */}
      <rect x={laneX - laneWidth / 2} y={0} width={laneWidth} height={triggerY} fill={COLORS.safeSoft} />
      {/* Defence window */}
      <rect
        x={laneX - laneWidth / 2}
        y={triggerY}
        width={laneWidth}
        height={liquidationY - triggerY}
        fill={COLORS.defendingSoft}
      />
      {/* Liquidation zone */}
      <rect
        x={laneX - laneWidth / 2}
        y={liquidationY}
        width={laneWidth}
        height={height - liquidationY}
        fill={COLORS.criticalSoft}
      />
      {/* Lane border */}
      <rect
        x={laneX - laneWidth / 2}
        y={0}
        width={laneWidth}
        height={height}
        fill="none"
        stroke={COLORS.line}
        strokeWidth={2}
      />

      {/* Trigger line */}
      <line
        x1={laneX - laneWidth / 2 - 20}
        y1={triggerY}
        x2={laneX + laneWidth / 2 + 20}
        y2={triggerY}
        stroke={COLORS.ink}
        strokeWidth={2}
        strokeDasharray="6 4"
      />
      <text x={laneX + laneWidth / 2 + 32} y={triggerY + 5} fontSize={20} fill={COLORS.ink} fontWeight={600}>
        13,000 — Guard Trigger
      </text>

      {/* Liquidation line */}
      <line
        x1={laneX - laneWidth / 2 - 20}
        y1={liquidationY}
        x2={laneX + laneWidth / 2 + 20}
        y2={liquidationY}
        stroke={COLORS.critical}
        strokeWidth={2}
        strokeDasharray="6 4"
      />
      <text
        x={laneX + laneWidth / 2 + 32}
        y={liquidationY + 5}
        fontSize={20}
        fill={COLORS.critical}
        fontWeight={600}
      >
        11,000 — LIQUIDATION
      </text>

      {/* Window label, vertical */}
      <text
        x={laneX - laneWidth / 2 - 32}
        y={(triggerY + liquidationY) / 2}
        fontSize={16}
        fill={COLORS.defending}
        fontWeight={700}
        textAnchor="end"
      >
        DEFENCE WINDOW
      </text>

      {/* Position marker */}
      <circle cx={laneX} cy={positionY} r={16} fill={markerColor} stroke={COLORS.ink} strokeWidth={3} />
      <text
        x={laneX}
        y={positionY - 30}
        fontSize={26}
        fontWeight={700}
        fill={markerColor}
        textAnchor="middle"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {Math.round(currentBps).toLocaleString()} bps
      </text>

      {/* Open position label at 16667 */}
      <text x={laneX} y={height + 40} fontSize={16} fill={COLORS.inkMuted} textAnchor="middle">
        Opened at 16,667 bps · $10,000 collateral vs $6,000 debt
      </text>
    </svg>
  );
};
