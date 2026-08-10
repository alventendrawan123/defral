import { AUTHORITY_COPY } from '@/constants/copy';

interface AuthorityBadgeProps {
  isRevoked: boolean;
}

export function AuthorityBadge({ isRevoked }: AuthorityBadgeProps) {
  const className = isRevoked
    ? 'border-critical bg-critical-soft text-critical'
    : 'border-line-soft bg-surface-sunken text-ink-muted';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 font-mono text-xs ${className}`}
    >
      {isRevoked ? AUTHORITY_COPY.revoked : AUTHORITY_COPY.granted}
    </span>
  );
}
