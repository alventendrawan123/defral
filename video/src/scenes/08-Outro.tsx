// 08-Outro.tsx — 205-210s (150 frames). Logo + final tagline + repo link.
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { COLORS, DEMO } from '../theme';

const { fontFamily } = loadFont('normal', { weights: ['400', '600', '700'], subsets: ['latin'] });

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const repoOpacity = interpolate(frame, [50, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.black,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily,
      }}
    >
      <div style={{ opacity, fontSize: 96, fontWeight: 700, color: COLORS.white, letterSpacing: 4 }}>
        DEFRAL
      </div>
      <div style={{ opacity: taglineOpacity, marginTop: 20, fontSize: 32, color: '#a3a3ad' }}>
        It never becomes a liquidation.
      </div>
      <div
        style={{
          opacity: repoOpacity,
          marginTop: 40,
          fontSize: 24,
          fontFamily: 'monospace',
          color: COLORS.safe,
        }}
      >
        {DEMO.githubRepo}
      </div>
    </AbsoluteFill>
  );
};
