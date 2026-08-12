// 01-Problem.tsx — 5-25s (600 frames). Rina's problem + defence window ladder.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { DefenceWindow } from '../components/DefenceWindow';
import { COLORS, DEMO } from '../theme';

const { fontFamily } = loadFont('normal', { weights: ['400', '600', '700'], subsets: ['latin'] });

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();

  const headlineOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const diagramOpacity = interpolate(frame, [40, 65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const asleepOpacity = interpolate(frame, [480, 510], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.paper,
        fontFamily,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 100px',
      }}
    >
      <div style={{ maxWidth: 560 }}>
        <div
          style={{
            opacity: headlineOpacity,
            fontSize: 52,
            fontWeight: 700,
            color: COLORS.ink,
            lineHeight: 1.2,
          }}
        >
          Rina borrowed <span style={{ color: COLORS.accent }}>${DEMO.debtOpen.toLocaleString()}</span>
          <br />
          against <span style={{ color: COLORS.accent }}>$10,000</span> of tokenized Treasury.
        </div>

        <div
          style={{
            opacity: diagramOpacity,
            marginTop: 40,
            fontSize: 26,
            color: COLORS.inkMuted,
            lineHeight: 1.5,
          }}
        >
          A 2,000 bps window between the guard trigger and liquidation.
          <br />
          That window is the only job of the reserve.
        </div>

        <div
          style={{
            opacity: asleepOpacity,
            marginTop: 32,
            fontSize: 44,
            fontWeight: 700,
            color: COLORS.critical,
          }}
        >
          She was asleep.
        </div>
      </div>

      <div style={{ opacity: diagramOpacity }}>
        {/* Illustrates the danger scenario: price drifting down toward liquidation
            while unwatched. The rescue itself is shown later, in Scene 05. */}
        <DefenceWindow positionBps={[DEMO.healthyBps, DEMO.liquidationBps]} animateFrames={[350, 500]} />
      </div>
    </AbsoluteFill>
  );
};
