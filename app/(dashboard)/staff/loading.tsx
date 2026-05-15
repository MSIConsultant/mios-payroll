import { SkeletonHeader, SkeletonCard } from '@/components/ui/Skeleton';
export default function Loading() {
  return (
    <div className="max-w-4xl space-y-6">
      <SkeletonHeader />
      <SkeletonCard height={120} />
      {[1,2,3].map(i => <SkeletonCard key={i} height={88} />)}
    </div>
  );
}
