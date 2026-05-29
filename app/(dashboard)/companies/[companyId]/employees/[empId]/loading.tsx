import { SkeletonHeader, SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
export default function Loading() {
  return (
    <div className="max-w-5xl space-y-6">
      <SkeletonHeader />
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard height={180} />
        <SkeletonCard height={180} />
      </div>
      <SkeletonTable rows={6} />
    </div>
  );
}
