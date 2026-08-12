// TxBadge.tsx — status pill for "verified", "reverted", "execution record".
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { COLORS, RADIUS } from '../theme';

type TxStatus = 'verified' | 'reverted' | 'execution-record';

const STATUS_COPY: Record<TxStatus, string> = {
  verified: 'VERIFIED ON BASESCAN',
  reverted: 'REVERTED — VERIFIED ON BASESCAN',
  'execution-record': 'EXECUTION RECORD — NO TRANSACTION',
};

const STATUS_COLOR: Record<TxStatus, string> = {
  verified: COLORS.safe,
  reverted: COLORS.critical,
  'execution-record': COLORS.inkMuted,
};

const STATUS_BG: Record<TxStatus, string> = {
  verified: COLORS.safeSoft,
  reverted: COLORS.criticalSoft,
  'execution-record': COLORS.surfaceSunken,
};

interface TxBadgeProps {
  status: TxStatus;
  delay?: number;
  scale?: number;
}

export const TxBadge: React.FC<TxBadgeProps> = ({ status, delay = 0, scale = 1 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const translateY = interpolate(frame, [delay, delay + 12], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8 * scale,
        borderRadius: RADIUS.full,
        border: `2px solid ${STATUS_COLOR[status]}`,
        background: STATUS_BG[status],
        color: STATUS_COLOR[status],
        padding: `${8 * scale}px ${18 * scale}px`,
        fontSize: 18 * scale,
        fontWeight: 700,
        letterSpacing: 1,
        opacity,
        translate: `0px ${translateY}px`,
      }}
    >
      {STATUS_COPY[status]}
    </span>
  );
};
