export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-7">
        <div className="col-span-4 h-80 bg-muted animate-pulse rounded-lg" />
        <div className="col-span-3 h-80 bg-muted animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
