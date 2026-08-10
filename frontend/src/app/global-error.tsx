'use client';

import { GLOBAL_ERROR_COPY } from '@/constants/copy';
import '@/styles/globals.css';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body>
        <main
          role="alert"
          className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-4 px-6"
        >
          <h1 className="text-2xl font-semibold">{GLOBAL_ERROR_COPY.title}</h1>
          <p className="max-w-prose text-ink-muted">{GLOBAL_ERROR_COPY.body}</p>
          {error.digest ? (
            <p className="font-mono text-xs text-ink-muted">
              {GLOBAL_ERROR_COPY.digestLabel}: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="rounded-md border-2 border-line bg-surface px-4 py-2 text-sm font-medium transition-shadow duration-200 ease-out hover:shadow-card"
          >
            {GLOBAL_ERROR_COPY.retryLabel}
          </button>
        </main>
      </body>
    </html>
  );
}
