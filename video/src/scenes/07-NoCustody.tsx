// 07-NoCustody.tsx — 185-205s (600 frames). Agent EOA dUSD balance = 0.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { AddressPill } from '../components/AddressPill';
import { COLORS, DEMO, RADIUS } from '../theme';

const { fontFamily } = loadFont('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });

export const NoCustody: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const zeroScale = interpolate(frame, [60, 100], [0.6, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const zeroOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const captionOpacity = interpolate(frame, [180, 210], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const noWithdrawOpacity = interpolate(frame, [340, 370], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: COLORS.paper, fontFamily, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity: fadeIn, display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
        <div
          style={{
            border: `2px solid ${COLORS.line}`,
            borderRadius: RADIUS.lg,
            background: COLORS.surface,
            boxShadow: `6px 6px 0 0 ${COLORS.line}`,
            padding: '40px 60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 16, color: COLORS.inkMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
            dUSD token · holder
          </span>
          <AddressPill address={DEMO.agentAddress} />
          <div
            style={{
              scale: zeroScale,
              opacity: zeroOpacity,
              fontSize: 96,
              fontWeight: 700,
              color: COLORS.safe,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            0.00
            <span style={{ fontSize: 32, marginLeft: 12, color: COLORS.inkMuted }}>dUSD</span>
          </div>
        </div>

        <div style={{ opacity: captionOpacity, fontSize: 26, fontWeight: 600, color: COLORS.ink, textAlign: 'center', maxWidth: 700 }}>
          The agent moved other people&apos;s money through gates it cannot widen, and kept none.
        </div>

        <div
          style={{
            opacity: noWithdrawOpacity,
            fontFamily: 'monospace',
            fontSize: 16,
            color: COLORS.inkMuted,
            background: COLORS.surfaceSunken,
            borderRadius: RADIUS.sm,
            padding: '8px 16px',
          }}
        >
          ABI: guardRepay() · sweepCoupon() — no withdraw(), no topUp()
        </div>
      </div>
    </AbsoluteFill>
  );
};
