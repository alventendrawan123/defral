import Link from 'next/link';

import { HERO_COPY } from '@/constants/copy';
import { ROUTES } from '@/constants/routes';

export function Hero() {
  return (
    <header className="flex flex-col gap-5">
      <p className="text-xs uppercase tracking-widest text-ink-muted">{HERO_COPY.eyebrow}</p>
      <h1 className="max-w-3xl text-5xl font-semibold tracking-tight">{HERO_COPY.title}</h1>
      <p className="max-w-prose text-ink-muted">{HERO_COPY.body}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          href={ROUTES.dashboard}
          className="rounded-md border-2 border-line bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-shadow duration-200 ease-out hover:shadow-card"
        >
          {HERO_COPY.primaryAction}
        </Link>
        <Link
          href={ROUTES.proof}
          className="rounded-md border-2 border-line bg-surface px-5 py-2.5 text-sm font-medium transition-shadow duration-200 ease-out hover:shadow-card"
        >
          {HERO_COPY.secondaryAction}
        </Link>
      </div>
    </header>
  );
}
