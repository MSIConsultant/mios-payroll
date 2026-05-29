import { SkeletonHeader, SkeletonTable } from '@/components/ui/Skeleton';
export default function Loading() {
  return (
    <div className="max-w-5xl space-y-6">
      <SkeletonHeader />
      <SkeletonTable rows={8} />
    </div>
  );
}
