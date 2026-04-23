export default function ActivitiesLoading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 bg-muted rounded w-32" />
        <div className="h-9 bg-muted rounded-xl w-40" />
      </div>

      {/* Activity cards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5 flex-1">
              <div className="h-4 bg-muted rounded w-56" />
              <div className="h-3 bg-muted rounded w-36" />
            </div>
            <div className="h-6 bg-muted rounded-full w-16 shrink-0" />
          </div>
          <div className="h-3 bg-muted rounded w-full" />
          <div className="flex gap-2">
            <div className="h-8 bg-muted rounded-xl w-32" />
            <div className="h-8 bg-muted rounded-xl w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}
