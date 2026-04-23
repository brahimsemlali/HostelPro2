export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-8 bg-muted rounded w-20" />
            <div className="h-2.5 bg-muted rounded w-16" />
          </div>
        ))}
      </div>

      {/* Middle section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bed mini map */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <div className="h-4 bg-muted rounded w-32" />
          <div className="grid grid-cols-8 gap-2 pt-1">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="h-9 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
        {/* Arrivals */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <div className="h-4 bg-muted rounded w-28" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <div className="w-8 h-8 bg-muted rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3 bg-muted rounded w-24" />
                <div className="h-2.5 bg-muted rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity feed */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <div className="h-4 bg-muted rounded w-24" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 py-1">
              <div className="w-7 h-7 bg-muted rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-2.5 bg-muted rounded w-20" />
              </div>
            </div>
          ))}
        </div>
        {/* Chart */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <div className="h-4 bg-muted rounded w-32" />
          <div className="flex items-end gap-2 h-40 pt-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-muted rounded-t-lg"
                style={{ height: `${30 + Math.sin(i) * 20 + 40}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
