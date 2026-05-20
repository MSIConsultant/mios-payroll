export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm font-medium text-[var(--text-muted)]">
          Memuat halaman…
        </p>
      </div>
    </div>
  );
}
