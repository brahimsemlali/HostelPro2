export default function ReportsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Date range + KPI row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 bg-muted rounded-xl w-24" />
          ))}
        </div>
        <div className="h-8 bg-muted rounded-xl w-32" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm space-y-2">
            <div className="h-3 bg-muted rounded w-28" />
            <div className="h-8 bg-muted rounded w-20" />
            <div className="h-2.5 bg-muted rounded w-16" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <div className="h-4 bg-muted rounded w-36" />
            <div className="h-48 bg-muted/50 rounded-xl" />
          </div>
        ))}
      </div>

      {/* Channel table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="h-4 bg-muted rounded w-40" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-5 py-4 border-b border-border last:border-0">
            {[100, 60, 80, 60, 80].map((w, j) => (
              <div key={j} className="h-3 bg-muted rounded" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
