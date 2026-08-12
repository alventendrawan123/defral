// Video.tsx — top-level orchestrator. Scene timings match docs/video-plan.md
// exactly (in frames, fps=30) so they stay in sync with public/captions/narration.srt.
//
// Plain <Sequence> stacking (not <TransitionSeries>) is used deliberately:
// TransitionSeries shortens total duration when transitions overlap scenes,
// which would drift the timeline away from the SRT timestamps written in
// the plan. Each scene handles its own fade-in internally instead.
import { AbsoluteFill, Sequence } from 'remotion';
import { Intro } from './scenes/00-Intro';
import { Problem } from './scenes/01-Problem';
import { Dashboard } from './scenes/02-Dashboard';
import { Vault } from './scenes/03-Vault';
import { PriceDip } from './scenes/04-PriceDip';
import { Rescue } from './scenes/05-Rescue';
import { Proof } from './scenes/06-Proof';
import { NoCustody } from './scenes/07-NoCustody';
import { Outro } from './scenes/08-Outro';
import { Captions } from './components/Captions';

// ─── Scene timing table (frames @ 30fps) — mirrors docs/video-plan.md §Scene breakdown ──

export const SCENES = {
  intro: { from: 0, duration: 150 }, //     0:00–0:05
  problem: { from: 150, duration: 600 }, //  0:05–0:25
  dashboard: { from: 750, duration: 900 }, //  0:25–0:55
  vault: { from: 1650, duration: 600 }, //  0:55–1:15
  priceDip: { from: 2250, duration: 750 }, //  1:15–1:40
  rescue: { from: 3000, duration: 1200 }, //  1:40–2:20
  proof: { from: 4200, duration: 1350 }, //  2:20–3:05
  noCustody: { from: 5550, duration: 600 }, //  3:05–3:25
  outro: { from: 6150, duration: 150 }, //  3:25–3:30
} as const;

export const TOTAL_DURATION_IN_FRAMES = SCENES.outro.from + SCENES.outro.duration; // 6300 = 210s @ 30fps

// Toggle to preview the video without the subtitle bar. Flip back to `true`
// before the final render.
const SHOW_CAPTIONS = false;

export const DefralVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={SCENES.intro.from} durationInFrames={SCENES.intro.duration} name="Intro">
        <Intro />
      </Sequence>
      <Sequence from={SCENES.problem.from} durationInFrames={SCENES.problem.duration} name="Problem">
        <Problem />
      </Sequence>
      <Sequence from={SCENES.dashboard.from} durationInFrames={SCENES.dashboard.duration} name="Dashboard">
        <Dashboard />
      </Sequence>
      <Sequence from={SCENES.vault.from} durationInFrames={SCENES.vault.duration} name="Vault">
        <Vault />
      </Sequence>
      <Sequence from={SCENES.priceDip.from} durationInFrames={SCENES.priceDip.duration} name="PriceDip">
        <PriceDip />
      </Sequence>
      <Sequence from={SCENES.rescue.from} durationInFrames={SCENES.rescue.duration} name="Rescue">
        <Rescue />
      </Sequence>
      <Sequence from={SCENES.proof.from} durationInFrames={SCENES.proof.duration} name="Proof">
        <Proof />
      </Sequence>
      <Sequence from={SCENES.noCustody.from} durationInFrames={SCENES.noCustody.duration} name="NoCustody">
        <NoCustody />
      </Sequence>
      <Sequence from={SCENES.outro.from} durationInFrames={SCENES.outro.duration} name="Outro">
        <Outro />
      </Sequence>

      {/* Captions render on top of every scene, timed to absolute video frame. */}
      {SHOW_CAPTIONS ? <Captions /> : null}
    </AbsoluteFill>
  );
};
