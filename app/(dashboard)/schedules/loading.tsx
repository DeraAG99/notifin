export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-muted animate-pulse rounded" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
      </div>
      <div className="border rounded-lg">
        <div className="h-12 bg-muted animate-pulse rounded-t-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 border-t bg-muted/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
