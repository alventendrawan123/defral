// 06-Proof.tsx — 140-185s (1350 frames). Three sub-beats:
//   A (0-450f / 0-15s):   proof page overview, scrolling entries
//   B (450-900f / 15-30s): NotAgent tx zoom + BaseScan
//   C (900-1350f / 30-45s): refusal execution records, no BaseScan button
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { BaseScanFrame } from '../components/BaseScanFrame';
import { TxBadge } from '../components/TxBadge';
import { COLORS, DEMO, RADIUS, shortenAddress } from '../theme';

const { fontFamily } = loadFont('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });

interface ProofRow {
  title: string;
  claim: string;
  kind: 'transaction' | 'execution-record';
  errorLabel?: string;
}

const PROOF_ENTRIES: ProofRow[] = [
  {
    title: 'The address that deployed the entire system is refused',
    claim: 'Nobody outside the agent can make the vault act, not even the party that owns the rest of the system.',
    kind: 'transaction',
    errorLabel: 'NotAgent(0xe2d3B7…)',
  },
  {
    title: 'A defence that landed, with gas sponsored',
    claim: 'Repaid 758.620690 dUSD. Health went 12667 to 14500, landing on target rather than near it.',
    kind: 'transaction',
  },
  {
    title: 'The agent asks to defend a healthy position',
    claim: 'The contract re-reads the oracle inside the same transaction and refuses while healthy.',
    kind: 'execution-record',
    errorLabel: 'Refused_Healthy(16667, 13000)',
  },
  {
    title: 'The agent asks to act twice in the same oracle round',
    claim: 'One defensive action per oracle round, so a repeated trigger cannot drain the reserve.',
    kind: 'execution-record',
    errorLabel: 'Refused_AlreadyActed(2)',
  },
  {
    title: 'The live demo vault refuses the agent when healthy',
    claim: 'The demo vault, never defended before, re-reads the oracle and refuses while above trigger.',
    kind: 'execution-record',
    errorLabel: 'Refused_Healthy(19497, 13000)',
  },
];

const SubBeatA: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const scrollY = interpolate(frame, [60, 400], [0, -520], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ background: COLORS.paper, fontFamily, padding: '60px 100px', overflow: 'hidden' }}>
      <div style={{ opacity: fadeIn }}>
        <h1 style={{ fontSize: 40, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Proof archive</h1>
        <p style={{ fontSize: 17, color: COLORS.inkMuted, marginTop: 8, maxWidth: 800 }}>
          This page reads a JSON archive committed to this repository, not a live API.
          It keeps working even after execution logs expire.
        </p>
      </div>

      {/* Clipped viewport: only content inside this box scrolls. The header
          above stays fixed because the translate is scoped to this wrapper,
          not the whole scene. */}
      <div style={{ marginTop: 24, height: 720, overflow: 'hidden' }}>
        <div style={{ translate: `0 ${scrollY}px`, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {PROOF_ENTRIES.map((entry) => (
            <ProofEntryCard key={entry.title} entry={entry} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ProofEntryCard: React.FC<{ entry: ProofRow }> = ({ entry }) => (
  <div
    style={{
      border: `2px solid ${COLORS.line}`,
      borderRadius: RADIUS.md,
      background: COLORS.surface,
      boxShadow: `3px 3px 0 0 ${COLORS.line}`,
      padding: 20,
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: COLORS.ink }}>{entry.title}</div>
        <div style={{ fontSize: 14, color: COLORS.inkMuted, marginTop: 4 }}>{entry.claim}</div>
      </div>
      <span
        style={{
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: RADIUS.full,
          border: `1.5px solid ${entry.kind === 'transaction' ? COLORS.safe : COLORS.inkMuted}`,
          color: entry.kind === 'transaction' ? COLORS.safe : COLORS.inkMuted,
        }}
      >
        {entry.kind === 'transaction' ? 'transaction' : 'execution record'}
      </span>
    </div>
    {entry.errorLabel ? (
      <div
        style={{
          marginTop: 10,
          fontFamily: 'monospace',
          fontSize: 14,
          color: COLORS.critical,
          background: COLORS.criticalSoft,
          borderRadius: RADIUS.sm,
          padding: '6px 12px',
          display: 'inline-block',
        }}
      >
        {entry.errorLabel}
      </div>
    ) : null}
  </div>
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
      <div style={{ opacity: fadeIn, display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', maxWidth: 950 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: COLORS.ink, margin: 0, textAlign: 'center' }}>
          The deployer of this entire system — the address that owns the pool
          <br />
          and holds every admin key — was refused.
        </h2>
        <BaseScanFrame
          txHash={DEMO.notAgentTx}
          status="failed"
          from={DEMO.deployerAddress}
          fromLabel="deployer, pool owner"
          to={DEMO.vaultAddress}
          toLabel="DefralVault"
          rows={[
            { label: 'Error', value: `NotAgent(${shortenAddress(DEMO.deployerAddress)})`, mono: true, highlight: true },
            { label: 'Block', value: '45,307,309', mono: true },
            { label: 'Gas used', value: '21,385', mono: true },
          ]}
        />
        <TxBadge status="reverted" delay={40} />
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

  return (
    <AbsoluteFill style={{ background: COLORS.paper, fontFamily, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity: fadeIn, display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', maxWidth: 900 }}>
        <h2 style={{ fontSize: 30, fontWeight: 700, color: COLORS.ink, margin: 0, textAlign: 'center' }}>
          KeeperHub declines to broadcast a call it predicts will revert
        </h2>

        <div
          style={{
            border: `2px solid ${COLORS.line}`,
            borderRadius: RADIUS.md,
            background: COLORS.surface,
            boxShadow: `4px 4px 0 0 ${COLORS.line}`,
            padding: 28,
            width: 720,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.ink }}>
            The agent asks to defend a healthy position
          </div>
          <div style={{ fontSize: 15, color: COLORS.inkMuted, marginTop: 6 }}>
            executionId: 18s842dcekxxtkz0tq61d
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: 'monospace',
              fontSize: 20,
              color: COLORS.critical,
              background: COLORS.criticalSoft,
              borderRadius: RADIUS.sm,
              padding: '10px 16px',
              display: 'inline-block',
            }}
          >
            Refused_Healthy(19497, 13000)
          </div>
        </div>

        <TxBadge status="execution-record" delay={70} />
        <p style={{ fontSize: 15, color: COLORS.inkMuted, textAlign: 'center', maxWidth: 640 }}>
          No transaction exists for a refusal. This is the execution record: the contract&apos;s own decoded error.
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const Proof: React.FC = () => {
  return (
    <>
      <Sequence  durationInFrames={450} name="Proof - overview">
        <SubBeatA />
      </Sequence>
      <Sequence from={450} durationInFrames={450} name="Proof - NotAgent">
        <SubBeatB />
      </Sequence>
      <Sequence from={900} durationInFrames={450} name="Proof - execution record">
        <SubBeatC />
      </Sequence>
    </>
  );
};
