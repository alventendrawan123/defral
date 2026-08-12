// 04-PriceDip.tsx — 75-100s (750 frames). Split screen: cast send terminal +
// dashboard refreshing to reflect the new (lower) price.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { Terminal } from '../components/Terminal';
import { HealthRing } from '../components/HealthRing';
import { COLORS, DEMO, RADIUS } from '../theme';

const { fontFamily } = loadFont('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });

const TERMINAL_LINES = [
  '$ cast send 0x44b94bb593f6de51ad3385264c0168eec8e56392 \\',
  '    "setPrice(int256)" 58982112 \\',
  '    --private-key $PUBLISHER_KEY \\',
  '    --rpc-url https://base-sepolia-rpc.publicnode.com',
  '',
  `blockHash:  0x4bc491317cd85888f994a07dfb13c8af9fb8116...`,
  'status:     1 (success)',
  'roundId:    11',
];

export const PriceDip: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Dashboard health drops once the tx has "confirmed" (after typing completes, ~frame 260).
  const healthAnimateFrames: [number, number] = [280, 340];

  const postureLabel = interpolate(frame, [300, 301], [0, 1]) > 0.5 ? 'Would defend now' : 'Armed and idle';
  const postureColor = postureLabel === 'Would defend now' ? COLORS.defending : COLORS.safe;

  const priceOpacityOld = interpolate(frame, [280, 310], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const priceOpacityNew = interpolate(frame, [280, 310], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: COLORS.paper, fontFamily, padding: 60 }}>
      <div style={{ opacity: fadeIn, display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: COLORS.ink, margin: 0 }}>
          The publisher pushes a new price
        </h1>
        <p style={{ fontSize: 17, color: COLORS.inkMuted, marginTop: -12, maxWidth: 800 }}>
          The publisher key is separate from the agent key.
          The agent cannot push prices — it can only respond to them.
        </p>

        <div style={{ display: 'flex', gap: 48, flex: 1, alignItems: 'center' }}>
          <Terminal lines={TERMINAL_LINES} startFrame={30} charsPerFrame={2.2} width={640} fontSize={17} />

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              border: `2px solid ${COLORS.line}`,
              borderRadius: RADIUS.lg,
              background: COLORS.surface,
              boxShadow: `4px 4px 0 0 ${COLORS.line}`,
              padding: 32,
            }}
          >
            <HealthRing
              healthRatioBps={[DEMO.healthyBps, DEMO.dippedBps]}
              triggerRatioBps={DEMO.triggerBps}
              animateFrames={healthAnimateFrames}
              size={220}
            />

            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: postureColor,
                border: `1.5px solid ${postureColor}`,
                borderRadius: RADIUS.full,
                padding: '5px 14px',
              }}
            >
              {postureLabel}
            </span>

            <div style={{ position: 'relative', height: 30, width: 200, textAlign: 'center' }}>
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: priceOpacityOld,
                  fontSize: 22,
                  fontVariantNumeric: 'tabular-nums',
                  color: COLORS.ink,
                }}
              >
                Price: $1.00000000
              </span>
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: priceOpacityNew,
                  fontSize: 22,
                  fontVariantNumeric: 'tabular-nums',
                  color: COLORS.defending,
                  fontWeight: 700,
                }}
              >
                Price: $0.58982112
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
