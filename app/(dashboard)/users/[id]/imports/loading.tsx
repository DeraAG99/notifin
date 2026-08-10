export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-muted animate-pulse rounded" />
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
      </div>
      <div className="border rounded-lg p-8">
        <div className="h-6 w-32 bg-muted animate-pulse rounded mb-4" />
        <div className="h-40 bg-muted/50 animate-pulse rounded" />
      </div>
      <div className="border rounded-lg p-8">
        <div className="h-6 w-32 bg-muted animate-pulse rounded mb-4" />
        <div className="h-56 bg-muted/50 animate-pulse rounded" />
      </div>
    </div>
  );
}
