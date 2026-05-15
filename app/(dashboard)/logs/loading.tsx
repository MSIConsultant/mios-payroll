import { SkeletonHeader, SkeletonStats, SkeletonCard } from '@/components/ui/Skeleton';
export default function Loading() {
  return (
    <div className="max-w-5xl space-y-6">
      <SkeletonHeader />
      <SkeletonStats count={3} />
      {[1,2,3,4,5].map(i => <SkeletonCard key={i} height={72} />)}
    </div>
  );
}
