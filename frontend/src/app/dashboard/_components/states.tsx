import { ERROR_STATE_COPY } from '@/constants/copy';

export function SummarySkeleton() {
  return (
    <div className="flex animate-pulse flex-col items-center gap-6" aria-busy="true">
      <div className="h-[260px] w-[260px] rounded-full bg-surface-sunken" />
      <div className="h-4 w-56 rounded-sm bg-surface-sunken" />
      <div className="h-40 w-full rounded-lg bg-surface-sunken" />
    </div>
  );
}

export function SummaryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <h2 className="text-lg font-semibold">{ERROR_STATE_COPY.title}</h2>
      <p className="max-w-prose text-sm text-ink-muted">{ERROR_STATE_COPY.body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border-2 border-line bg-surface px-4 py-2 text-sm font-medium transition-shadow duration-200 ease-out hover:shadow-card"
      >
        {ERROR_STATE_COPY.retryLabel}
      </button>
    </div>
  );
}
