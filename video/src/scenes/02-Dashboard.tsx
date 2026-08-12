// 02-Dashboard.tsx — 25-55s (900 frames). Faithful recreation of the live
// dashboard: health ring, oracle panel, position stats, address pills.
// Built in JSX (not a screenshot) so it stays editable and never goes stale.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { HealthRing } from '../components/HealthRing';
import { AddressPill } from '../components/AddressPill';
import { COLORS, DEMO, RADIUS } from '../theme';

const { fontFamily } = loadFont('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });

export const Dashboard: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const ringZoom = interpolate(frame, [180, 240], [1, 1.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const pillsOpacity = interpolate(frame, [560, 590], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: COLORS.paper, fontFamily, padding: 60 }}>
      <div style={{ opacity: fadeIn, display: 'flex', flexDirection: 'column', gap: 32, height: '100%' }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: 40, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Your position</h1>
          <p style={{ fontSize: 18, color: COLORS.inkMuted, marginTop: 8, maxWidth: 700 }}>
            Every figure here was read from the vault contract on Base Sepolia.
            I do not recompute them, because the contract is the one that decides.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 60, alignItems: 'center', flex: 1 }}>
          {/* Health ring */}
          <div style={{ scale: ringZoom, transformOrigin: 'center' }}>
            <HealthRing healthRatioBps={DEMO.healthyBps} triggerRatioBps={DEMO.triggerBps} size={280} />
          </div>

          {/* Oracle + position stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
            <Card title="Price and posture" statusLabel="Armed and idle" statusColor={COLORS.safe}>
              <StatRow label="Last price" value="$1.00000000" />
              <StatRow label="Oracle round" value="3" />
              <StatRow label="Price age" value="42s" />
            </Card>

            <Card title="Position">
              <StatRow label="Outstanding debt" value={`${DEMO.debtOpen.toLocaleString()}.00 dUSD`} />
              <StatRow label="Collateral" value="10,000 dUST" />
              <StatRow label="Reserve" value={`${DEMO.reserveOpen.toLocaleString()}.00 dUSD`} />
            </Card>
          </div>
        </div>

        {/* Address pills */}
        <div style={{ opacity: pillsOpacity, display: 'flex', gap: 12 }}>
          <AddressPill address={DEMO.borrowerAddress} label="Borrower" />
          <AddressPill address={DEMO.vaultAddress} label="Vault" />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Card: React.FC<{
  title: string;
  statusLabel?: string;
  statusColor?: string;
  children: React.ReactNode;
}> = ({ title, statusLabel, statusColor, children }) => (
  <div
    style={{
      border: `2px solid ${COLORS.line}`,
      borderRadius: RADIUS.md,
      background: COLORS.surface,
      boxShadow: `3px 3px 0 0 ${COLORS.line}`,
      padding: 24,
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <span style={{ fontSize: 20, fontWeight: 600, color: COLORS.ink }}>{title}</span>
      {statusLabel ? (
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: statusColor,
            border: `1.5px solid ${statusColor}`,
            borderRadius: RADIUS.full,
            padding: '4px 12px',
          }}
        >
          {statusLabel}
        </span>
      ) : null}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
  </div>
);

const StatRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17 }}>
    <span style={{ color: COLORS.inkMuted }}>{label}</span>
    <span style={{ color: COLORS.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  </div>
);
