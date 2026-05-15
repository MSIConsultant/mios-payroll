export function SkeletonCard({ height = 80 }: { height?: number }) {
  return (
    <div className="rounded-xl animate-pulse"
      style={{ height, background: 'var(--bg-card)', border: '1px solid var(--border-default)' }} />
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <div className="px-5 py-3 border-b animate-pulse"
        style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-default)', height: 44 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-4 flex items-center gap-4 border-b animate-pulse"
          style={{ borderColor: 'var(--border-subtle)', animationDelay: `${i * 0.06}s` }}>
          <div className="h-4 rounded-lg flex-1"
            style={{ background: 'var(--border-default)', maxWidth: `${60 + (i % 3) * 15}%` }} />
          <div className="h-4 rounded-lg w-24"
            style={{ background: 'var(--border-subtle)' }} />
          <div className="h-4 rounded-lg w-16"
            style={{ background: 'var(--border-subtle)' }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 3 }: { count?: number }) {
  return (
    <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl p-5 animate-pulse"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', animationDelay: `${i * 0.08}s` }}>
          <div className="h-3 w-24 rounded mb-4" style={{ background: 'var(--border-default)' }} />
          <div className="h-12 w-16 rounded" style={{ background: 'var(--border-strong)' }} />
          <div className="h-3 w-20 rounded mt-3" style={{ background: 'var(--border-subtle)' }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonHeader() {
  return (
    <div className="border-b pb-6 animate-pulse" style={{ borderColor: 'var(--border-default)' }}>
      <div className="h-4 w-32 rounded mb-3" style={{ background: 'var(--border-default)' }} />
      <div className="h-10 w-48 rounded mb-3" style={{ background: 'var(--border-strong)' }} />
      <div className="flex gap-4 mt-4">
        <div className="h-5 w-24 rounded" style={{ background: 'var(--border-default)' }} />
        <div className="h-5 w-24 rounded" style={{ background: 'var(--border-default)' }} />
        <div className="h-5 w-24 rounded" style={{ background: 'var(--border-default)' }} />
      </div>
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <SkeletonHeader />
      <SkeletonStats count={3} />
      <SkeletonTable rows={5} />
    </div>
  );
}
