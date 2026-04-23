export default function HousekeepingLoading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 bg-muted rounded-xl w-24" />
          ))}
        </div>
        <div className="h-9 bg-muted rounded-xl w-36" />
      </div>

      {/* Task grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 bg-muted rounded w-20" />
              <div className="h-6 bg-muted rounded-full w-14" />
            </div>
            <div className="h-3 bg-muted rounded w-32" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-muted rounded-full" />
              <div className="h-2.5 bg-muted rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
