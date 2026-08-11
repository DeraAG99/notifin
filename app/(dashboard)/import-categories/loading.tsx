export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-44 bg-muted animate-pulse rounded" />
      <div className="border rounded-lg p-6">
        <div className="h-6 w-32 bg-muted animate-pulse rounded mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted/50 animate-pulse rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
