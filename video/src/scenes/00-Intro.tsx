// 00-Intro.tsx — 0-5s (150 frames). Logo fade-in + tagline.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { COLORS } from '../theme';

const { fontFamily } = loadFont('normal', { weights: ['400', '600', '700'], subsets: ['latin'] });

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();

  const logoScale = interpolate(frame, [0, 25], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineOpacity = interpolate(frame, [35, 60], [0, 1], {
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
      <div
        style={{
          scale: logoScale,
          opacity: logoOpacity,
          fontSize: 128,
          fontWeight: 700,
          color: COLORS.white,
          letterSpacing: 4,
        }}
      >
        DEFRAL
      </div>
      <div
        style={{
          opacity: taglineOpacity,
          marginTop: 24,
          fontSize: 36,
          fontWeight: 400,
          color: '#a3a3ad',
        }}
      >
        A loan that defends itself.
      </div>
    </AbsoluteFill>
  );
};
