'use client';

import { ERROR_STATE_COPY } from '@/constants/copy';

export default function GlobalRouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">{ERROR_STATE_COPY.title}</h1>
      <p className="max-w-prose text-ink-muted">{ERROR_STATE_COPY.body}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium shadow-raised transition-shadow duration-200 ease-out hover:shadow-card"
      >
        {ERROR_STATE_COPY.retryLabel}
      </button>
    </main>
  );
}
