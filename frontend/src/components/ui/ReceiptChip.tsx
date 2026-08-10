import { RECEIPT_LABEL } from '@/constants/copy';
import type { ReceiptStatus } from '@/types';

const RECEIPT_CLASS: Record<ReceiptStatus, string> = {
  verified: 'border-safe bg-safe-soft text-safe',
  reverted: 'border-critical bg-critical-soft text-critical',
  unconfirmed: 'border-defending bg-defending-soft text-defending',
};

const RECEIPT_MARK: Record<ReceiptStatus, string> = {
  verified: '✓',
  reverted: '✕',
  unconfirmed: '…',
};

interface ReceiptChipProps {
  status: ReceiptStatus;
  isSponsored?: boolean;
}

export function ReceiptChip({ status, isSponsored = false }: ReceiptChipProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs ${RECEIPT_CLASS[status]}`}
      >
        <span aria-hidden="true">{RECEIPT_MARK[status]}</span>
        {RECEIPT_LABEL[status]}
      </span>
      {isSponsored ? (
        <span className="inline-flex items-center rounded-full border border-line-soft bg-surface-sunken px-2.5 py-0.5 font-mono text-xs text-ink-muted">
          sponsored
        </span>
      ) : null}
    </span>
  );
}
