// Captions.tsx — reads narration.srt and renders a single caption bar,
// synced to the global timeline. Placed once in Video.tsx, absolutely
// positioned above all scenes.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AbsoluteFill, staticFile, useCurrentFrame, useDelayRender, useVideoConfig } from 'remotion';
import { parseSrt } from '@remotion/captions';
import type { Caption } from '@remotion/captions';
import { COLORS } from '../theme';

export const Captions: React.FC = () => {
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender('Loading narration.srt'));
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fetchCaptions = useCallback(async () => {
    try {
      const response = await fetch(staticFile('captions/narration.srt'));
      const text = await response.text();
      const { captions: parsed } = parseSrt({ input: text });
      setCaptions(parsed);
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [continueRender, cancelRender, handle]);

  useEffect(() => {
    fetchCaptions();
  }, [fetchCaptions]);

  const currentMs = (frame / fps) * 1000;

  const activeCaption = useMemo(() => {
    if (!captions) return null;
    return captions.find((c) => currentMs >= c.startMs && currentMs < c.endMs) ?? null;
  }, [captions, currentMs]);

  if (!activeCaption) return null;

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          marginBottom: 90,
          maxWidth: '82%',
          background: 'rgba(10, 10, 10, 0.82)',
          borderRadius: 12,
          padding: '18px 36px',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            color: COLORS.white,
            fontSize: 36,
            fontWeight: 600,
            lineHeight: 1.3,
            fontFamily: 'ui-sans-serif, system-ui',
          }}
        >
          {activeCaption.text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
