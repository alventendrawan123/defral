// 05-Rescue.tsx — 100-140s (1200 frames). Three sub-beats:
//   A (0-450f / 0-15s):   agent terminal log fires
//   B (450-900f / 15-30s): BaseScan Logs tab, Rescued event fields
//   C (900-1200f / 30-40s): health ring animates 11500 -> 14500
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { Terminal } from '../components/Terminal';
import { BaseScanFrame } from '../components/BaseScanFrame';
import { TxBadge } from '../components/TxBadge';
import { HealthRing } from '../components/HealthRing';
import { COLORS, DEMO, shortenAddress } from '../theme';

const { fontFamily } = loadFont('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });

const AGENT_LOG_LINES = [
  'Agent starting. ledger=keeperhub pollMs=300000 overlapGuard=on',
  '',
  'Price dipped 41.02%. Repaid $758.62 from your reserve.',
  'Position safe. — Defral',
];

const SubBeatA: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.paper, fontFamily, justifyContent: 'center', alignItems: 'center' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
      <h2 style={{ fontSize: 32, fontWeight: 700, color: COLORS.ink, margin: 0 }}>
        The agent fired automatically
      </h2>
      <Terminal lines={AGENT_LOG_LINES} startFrame={20} charsPerFrame={1.6} width={760} fontSize={20} />
    </div>
  </AbsoluteFill>
);

const SubBeatB: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ background: COLORS.paper, fontFamily, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity: fadeIn, display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
        <h2 style={{ fontSize: 30, fontWeight: 700, color: COLORS.ink, margin: 0, textAlign: 'center' }}>
          Open the Logs tab — that&apos;s where the proof lives
        </h2>
        <BaseScanFrame
          txHash={DEMO.rescueTx}
          status="success"
          from={DEMO.agentAddress}
          fromLabel="KeeperHub relayer"
          to={DEMO.vaultAddress}
          toLabel="DefralVault"
          rows={[]}
          logsView={{
            eventName: 'Rescued(address,uint8,uint256,uint16,uint16,int256,uint80,uint64)',
            fields: [
              { label: 'borrower', value: shortenAddress(DEMO.borrowerAddress), mono: true },
              { label: 'kind', value: '1 (guard-repay)', mono: true },
              { label: 'amount', value: `${DEMO.amountRepaid.toFixed(6)} dUSD`, mono: true },
              { label: 'healthBefore', value: `${DEMO.dippedBps.toLocaleString()} bps`, mono: true },
              { label: 'healthAfter', value: `${DEMO.targetBps.toLocaleString()} bps`, mono: true, highlight: true },
              { label: 'price', value: `${DEMO.priceDipped.toFixed(8)}`, mono: true },
              { label: 'roundId', value: '11', mono: true },
            ],
          }}
        />
        <TxBadge status="verified" delay={40} />
      </div>
    </AbsoluteFill>
  );
};

const SubBeatC: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const captionOpacity = interpolate(frame, [180, 210], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: COLORS.paper, fontFamily, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity: fadeIn, display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
        <HealthRing
          healthRatioBps={[DEMO.dippedBps, DEMO.targetBps]}
          triggerRatioBps={DEMO.triggerBps}
          animateFrames={[30, 120]}
          size={300}
        />
        <div
          style={{
            opacity: captionOpacity,
            fontSize: 26,
            fontWeight: 600,
            color: COLORS.safe,
            textAlign: 'center',
          }}
        >
          Landed exactly on target. Not near it — exactly on it.
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Rescue: React.FC = () => {
  return (
    <>
      <Sequence  durationInFrames={450} name="Rescue - agent log">
        <SubBeatA />
      </Sequence>
      <Sequence from={450} durationInFrames={450} name="Rescue - BaseScan logs">
        <SubBeatB />
      </Sequence>
      <Sequence from={900} durationInFrames={300} name="Rescue - health update">
        <SubBeatC />
      </Sequence>
    </>
  );
};
