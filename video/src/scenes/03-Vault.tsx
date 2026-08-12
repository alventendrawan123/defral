// 03-Vault.tsx — 55-75s (600 frames). Vault policy page: reserve, trigger,
// target, max repay, agent armed badge.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { AddressPill } from '../components/AddressPill';
import { COLORS, DEMO, RADIUS } from '../theme';

const { fontFamily } = loadFont('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });

export const Vault: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const reserveHighlight = interpolate(frame, [90, 130, 320, 360], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const policyOpacity = interpolate(frame, [340, 380], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const armedOpacity = interpolate(frame, [480, 520], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: COLORS.paper, fontFamily, padding: 60 }}>
      <div style={{ opacity: fadeIn, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <h1 style={{ fontSize: 40, fontWeight: 700, color: COLORS.ink, margin: 0 }}>
            Reserve and policy
          </h1>
          <p style={{ fontSize: 18, color: COLORS.inkMuted, marginTop: 8, maxWidth: 760 }}>
            Two zero-argument calls. The contract knows what to do.
            No parameters, no destinations.
          </p>
        </div>

        {/* Reserve card, with a subtle highlight ring during the reserveHighlight window */}
        <div
          style={{
            border: `2px solid ${COLORS.line}`,
            borderRadius: RADIUS.md,
            background: COLORS.surface,
            boxShadow: `3px 3px 0 0 ${COLORS.line}`,
            outline: `${4 * reserveHighlight}px solid ${COLORS.accent}44`,
            padding: 28,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 600, color: COLORS.ink, marginBottom: 10 }}>
            Reserve
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: COLORS.ink, fontVariantNumeric: 'tabular-nums' }}>
            {DEMO.reserveOpen.toLocaleString()}.00 dUSD
          </div>
          <p style={{ fontSize: 16, color: COLORS.inkMuted, marginTop: 10, maxWidth: 700 }}>
            Your reserve is min(balance, allowance), and it sits in your own wallet.
            Setting it is an approve, and lowering that approval is how you take it back.
          </p>
        </div>

        {/* Policy grid */}
        <div style={{ opacity: policyOpacity, display: 'flex', gap: 20 }}>
          <PolicyStat label="Guard Trigger" value="130.00%" hint="The agent acts below this ratio." />
          <PolicyStat label="Target" value="145.00%" hint="Restore ratio after a rescue." />
          <PolicyStat label="Max repay / event" value={`${DEMO.maxRepayPerEvent.toLocaleString()} dUSD`} hint="Hard cap per action." />
        </div>

        <div style={{ opacity: armedOpacity, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.safe,
              border: `1.5px solid ${COLORS.safe}`,
              borderRadius: RADIUS.full,
              padding: '6px 16px',
            }}
          >
            GUARD_ROLE only — armed
          </span>
          <AddressPill address={DEMO.agentAddress} label="Agent executor" />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PolicyStat: React.FC<{ label: string; value: string; hint: string }> = ({ label, value, hint }) => (
  <div
    style={{
      flex: 1,
      border: `2px solid ${COLORS.line}`,
      borderRadius: RADIUS.md,
      background: COLORS.surface,
      boxShadow: `3px 3px 0 0 ${COLORS.line}`,
      padding: 20,
    }}
  >
    <div style={{ fontSize: 14, color: COLORS.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </div>
    <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.ink, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </div>
    <div style={{ fontSize: 14, color: COLORS.inkMuted, marginTop: 6 }}>{hint}</div>
  </div>
);
