import { SkeletonHeader, SkeletonStats, SkeletonTable } from '@/components/ui/Skeleton';
export default function Loading() {
  return (
    <div className="max-w-6xl space-y-6">
      <SkeletonHeader />
      <SkeletonStats count={3} />
      <SkeletonTable rows={8} />
    </div>
  );
}
