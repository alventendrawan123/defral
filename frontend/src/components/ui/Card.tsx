import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

export function Card({ title, description, children }: CardProps) {
  return (
    <section className="rounded-lg border-2 border-line bg-surface p-6 shadow-card">
      {title ? <h2 className="text-lg font-semibold tracking-tight">{title}</h2> : null}
      {description ? <p className="mt-1 max-w-prose text-sm text-ink-muted">{description}</p> : null}
      <div className={title || description ? 'mt-5' : undefined}>{children}</div>
    </section>
  );
}
