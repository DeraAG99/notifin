export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-16 bg-muted animate-pulse rounded" />
        <div className="h-4 w-48 bg-muted animate-pulse rounded mt-2" />
      </div>
      <div className="flex gap-2">
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        <div className="h-10 w-24 bg-muted animate-pulse rounded" />
      </div>
      <div className="border rounded-lg">
        <div className="h-12 bg-muted animate-pulse rounded-t-lg" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 border-t bg-muted/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
