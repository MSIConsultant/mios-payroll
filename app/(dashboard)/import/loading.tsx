import { SkeletonHeader, SkeletonCard } from '@/components/ui/Skeleton';
export default function Loading() {
  return (
    <div className="max-w-4xl space-y-4">
      <SkeletonHeader />
      {[1,2,3,4].map(i => <SkeletonCard key={i} height={72} />)}
    </div>
  );
}
