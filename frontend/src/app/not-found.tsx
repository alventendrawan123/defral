import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">This page does not exist</h1>
      <p className="max-w-prose text-ink-muted">
        The link you opened does not point to anything in Defral.
      </p>
      <Link
        href="/"
        className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium shadow-raised transition-shadow duration-200 ease-out hover:shadow-card"
      >
        Back to the dashboard
      </Link>
    </main>
  );
}
