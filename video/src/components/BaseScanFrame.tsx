// BaseScanFrame.tsx — a faithful recreation of a BaseScan transaction page
// chrome, built in JSX (not a screenshot) so it stays editable in Remotion
// Studio and never goes stale. Uses real tx hashes and addresses from theme.ts.
import { COLORS, RADIUS, shortenAddress } from '../theme';

interface BaseScanRow {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}

interface BaseScanFrameProps {
  txHash: string;
  status: 'success' | 'failed';
  from: string;
  fromLabel?: string;
  to: string;
  toLabel?: string;
  rows: BaseScanRow[];
  /** When set, renders a "Logs" tab view with these decoded event fields instead of Overview. */
  logsView?: {
    eventName: string;
    fields: BaseScanRow[];
  };
  width?: number;
}

export const BaseScanFrame: React.FC<BaseScanFrameProps> = ({
  txHash,
  status,
  from,
  fromLabel,
  to,
  toLabel,
  rows,
  logsView,
  width = 900,
}) => {
  const statusColor = status === 'success' ? COLORS.safe : COLORS.critical;
  const statusBg = status === 'success' ? COLORS.safeSoft : COLORS.criticalSoft;
  const statusText = status === 'success' ? 'Success' : 'Fail';

  return (
    <div
      style={{
        width,
        borderRadius: RADIUS.md,
        border: `2px solid ${COLORS.line}`,
        background: COLORS.surface,
        boxShadow: `6px 6px 0 0 ${COLORS.line}`,
        overflow: 'hidden',
        fontFamily: 'ui-sans-serif, system-ui',
      }}
    >
      {/* Browser chrome bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 18px',
          background: '#1b2436',
          borderBottom: `1px solid ${COLORS.line}`,
        }}
      >
        {['#ff5f56', '#ffbd2e', '#27c93f'].map((c) => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: 999, background: c }} />
        ))}
        <div
          style={{
            marginLeft: 12,
            flex: 1,
            background: '#0f1520',
            borderRadius: 6,
            padding: '6px 14px',
            color: '#8b93a5',
            fontSize: 14,
            fontFamily: 'monospace',
          }}
        >
          sepolia.basescan.org/tx/{shortenAddress(txHash)}
        </div>
      </div>

      {/* BaseScan header */}
      <div style={{ padding: '20px 28px 12px', borderBottom: `1px solid ${COLORS.lineSoft}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.ink }}>Transaction Details</span>
          <span
            style={{
              background: statusBg,
              color: statusColor,
              fontSize: 13,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: RADIUS.full,
              border: `1.5px solid ${statusColor}`,
            }}
          >
            {statusText}
          </span>
        </div>
        <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 15, color: COLORS.inkMuted }}>
          {txHash}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '0 28px', background: COLORS.surfaceSunken }}>
        {['Overview', logsView ? 'Logs' : null].filter(Boolean).map((tab) => (
          <div
            key={tab}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              color: tab === (logsView ? 'Logs' : 'Overview') ? COLORS.accent : COLORS.inkMuted,
              borderBottom:
                tab === (logsView ? 'Logs' : 'Overview')
                  ? `3px solid ${COLORS.accent}`
                  : '3px solid transparent',
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={{ padding: '20px 28px 28px' }}>
        {!logsView && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={cellLabelStyle}>From:</td>
                <td style={cellValueStyle}>
                  {fromLabel ? `${fromLabel} · ` : ''}
                  {shortenAddress(from)}
                </td>
              </tr>
              <tr>
                <td style={cellLabelStyle}>To:</td>
                <td style={cellValueStyle}>
                  {toLabel ? `${toLabel} · ` : ''}
                  {shortenAddress(to)}
                </td>
              </tr>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td style={cellLabelStyle}>{row.label}:</td>
                  <td
                    style={{
                      ...cellValueStyle,
                      fontFamily: row.mono ? 'monospace' : undefined,
                      color: row.highlight ? COLORS.critical : COLORS.ink,
                      fontWeight: row.highlight ? 700 : 400,
                    }}
                  >
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {logsView && (
          <div>
            <div
              style={{
                display: 'inline-block',
                background: COLORS.surfaceSunken,
                border: `1px solid ${COLORS.lineSoft}`,
                borderRadius: RADIUS.sm,
                padding: '6px 14px',
                fontSize: 14,
                fontFamily: 'monospace',
                color: COLORS.ink,
                marginBottom: 16,
              }}
            >
              [topic0] {logsView.eventName}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {logsView.fields.map((row) => (
                  <tr key={row.label}>
                    <td style={cellLabelStyle}>{row.label}:</td>
                    <td
                      style={{
                        ...cellValueStyle,
                        fontFamily: row.mono ? 'monospace' : undefined,
                        color: row.highlight ? COLORS.safe : COLORS.ink,
                        fontWeight: row.highlight ? 700 : 400,
                      }}
                    >
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const cellLabelStyle: React.CSSProperties = {
  padding: '10px 0',
  fontSize: 15,
  color: COLORS.inkMuted,
  width: 160,
  verticalAlign: 'top',
};

const cellValueStyle: React.CSSProperties = {
  padding: '10px 0',
  fontSize: 15,
  color: COLORS.ink,
};
