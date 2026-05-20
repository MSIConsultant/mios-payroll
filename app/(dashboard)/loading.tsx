export default function Loading() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="h-20 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 bg-white border border-[var(--border-default)] rounded-xl animate-pulse"
          />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-16 bg-white border border-[var(--border-default)] rounded-xl animate-pulse"
        />
      ))}
    </div>
  );
}
