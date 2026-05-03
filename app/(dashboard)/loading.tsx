export default function Loading() {
  return (
    <div className="p-8 space-y-4">
      {[1,2,3].map(i => (
        <div key={i} className="h-16 bg-[#111113] border border-[#1A1A1C] rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
