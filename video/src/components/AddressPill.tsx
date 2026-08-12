// AddressPill.tsx — mirrors frontend/src/components/ui/AddressPill.tsx exactly.
import { COLORS, RADIUS, shortenAddress } from '../theme';

interface AddressPillProps {
  address: string;
  label?: string;
  scale?: number;
}

export const AddressPill: React.FC<AddressPillProps> = ({ address, label, scale = 1 }) => {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8 * scale,
        borderRadius: RADIUS.full,
        border: `1px solid ${COLORS.lineSoft}`,
        background: COLORS.surface,
        padding: `${6 * scale}px ${14 * scale}px`,
        fontFamily: 'monospace',
        fontSize: 14 * scale,
        color: COLORS.ink,
      }}
    >
      {label ? (
        <span style={{ fontFamily: 'sans-serif', color: COLORS.inkMuted }}>{label}</span>
      ) : null}
      <span>{shortenAddress(address)}</span>
    </span>
  );
};
