import { PageSkeleton } from '@/components/ui/PageSkeleton';

export default function Loading() {
  return <PageSkeleton hasRing cardCount={10} />;
}
