// Terminal.tsx — typewriter-style terminal output, deterministic per frame.
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { COLORS, RADIUS } from '../theme';

interface TerminalProps {
  lines: string[];
  /** Frame the typing starts. */
  startFrame: number;
  /** Characters typed per frame (deterministic, not wall-clock). */
  charsPerFrame?: number;
  width?: number;
  fontSize?: number;
}

export const Terminal: React.FC<TerminalProps> = ({
  lines,
  startFrame,
  charsPerFrame = 1.4,
  width = 760,
  fontSize = 20,
}) => {
  const frame = useCurrentFrame();

  const elapsed = Math.max(0, frame - startFrame);
  const totalCharsToShow = Math.floor(elapsed * charsPerFrame);

  const fullText = lines.join('\n');
  const visibleText = fullText.slice(0, totalCharsToShow);
  const isDone = totalCharsToShow >= fullText.length;

  // Blinking cursor: on for 15 frames, off for 15 frames.
  const cursorVisible = !isDone || Math.floor(frame / 15) % 2 === 0;

  const containerOpacity = interpolate(frame, [startFrame - 6, startFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        width,
        borderRadius: RADIUS.md,
        border: `2px solid ${COLORS.line}`,
        background: '#0d0d10',
        boxShadow: `4px 4px 0 0 ${COLORS.line}`,
        overflow: 'hidden',
        opacity: containerOpacity,
        fontFamily: 'ui-monospace, "Cascadia Code", monospace',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 16px',
          background: '#1a1a1f',
          borderBottom: `1px solid ${COLORS.line}`,
        }}
      >
        {['#ff5f56', '#ffbd2e', '#27c93f'].map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 999, background: c }} />
        ))}
      </div>
      <pre
        style={{
          margin: 0,
          padding: 24,
          fontSize,
          lineHeight: 1.6,
          color: '#e5e5ea',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          minHeight: fontSize * 1.6 * lines.length,
        }}
      >
        {visibleText}
        <span style={{ opacity: cursorVisible ? 1 : 0, color: '#39e508' }}>█</span>
      </pre>
    </div>
  );
};
