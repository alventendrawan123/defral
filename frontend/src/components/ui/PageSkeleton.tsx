interface PageSkeletonProps {
  hasRing?: boolean;
  cardCount?: number;
}

export function PageSkeleton({ hasRing = false, cardCount = 4 }: PageSkeletonProps) {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Reading the vault on Base Sepolia</span>

      <div className="flex flex-col gap-3">
        <div className="h-9 w-64 rounded-md bg-surface-sunken" />
        <div className="h-4 w-full max-w-prose rounded-sm bg-surface-sunken" />
      </div>

      {hasRing ? (
        <div className="flex justify-center">
          <div className="h-[260px] w-[260px] rounded-full bg-surface-sunken" />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cardCount }, (_, index) => (
          <div key={index} className="h-24 rounded-md border border-line-soft bg-surface-sunken" />
        ))}
      </div>
    </div>
  );
}
