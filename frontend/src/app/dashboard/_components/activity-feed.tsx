import { EMPTY_STATE_COPY } from '@/constants/copy';
import type { RescueEventView, RescueKind } from '@/types';
import { formatBps, formatUsd } from '@/utils/format';

const KIND_CLASS: Record<RescueKind, string> = {
  'guard-repay': 'border-safe bg-safe-soft text-safe',
  'coupon-sweep': 'border-accent bg-surface-sunken text-accent',
  'no-op': 'border-line-soft bg-surface-sunken text-ink-muted',
  liquidation: 'border-critical bg-critical-soft text-critical',
};

const KIND_LABEL: Record<RescueKind, string> = {
  'guard-repay': 'guard repay',
  'coupon-sweep': 'coupon sweep',
  'no-op': 'checked, no action',
  liquidation: 'liquidation',
};

function RatioDelta({ event }: { event: RescueEventView }) {
  if (event.ratioBeforeBps === null || event.ratioAfterBps === null) return null;
  if (event.ratioBeforeBps === event.ratioAfterBps) {
    return (
      <span className="font-mono text-xs tabular-nums text-ink-muted">
        {formatBps(event.ratioBeforeBps)}
      </span>
    );
  }

  return (
    <span className="font-mono text-xs tabular-nums text-ink-muted">
      {formatBps(event.ratioBeforeBps)} to {formatBps(event.ratioAfterBps)}
    </span>
  );
}

interface ActivityFeedProps {
  events: RescueEventView[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-line-soft bg-surface p-4">
        <h3 className="text-sm font-semibold">{EMPTY_STATE_COPY.events.title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{EMPTY_STATE_COPY.events.body}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((event) => (
        <li
          key={event.id}
          className="flex flex-col gap-2 rounded-md border border-line-soft bg-surface p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 font-mono text-xs ${KIND_CLASS[event.kind]}`}
            >
              {KIND_LABEL[event.kind]}
            </span>
            <RatioDelta event={event} />
            {event.amount === null ? null : (
              <span className="font-mono text-xs tabular-nums text-ink-muted">
                {formatUsd(event.amount)}
              </span>
            )}
          </div>
          <p className="text-sm">{event.note}</p>
          {event.transactionLink ? (
            <a
              href={event.transactionLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit font-mono text-xs underline underline-offset-2"
            >
              open the transaction
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
