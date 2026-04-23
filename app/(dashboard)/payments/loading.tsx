export default function PaymentsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      {/* Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 bg-muted rounded-xl w-32" />
        ))}
      </div>

      {/* Summary row */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2.5 bg-muted rounded w-14" />
              <div className="h-6 bg-muted rounded w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="bg-white rounded-2xl shadow-sm divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="w-8 h-8 bg-muted rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-muted rounded w-32" />
              <div className="h-2.5 bg-muted rounded w-20" />
            </div>
            <div className="h-3 bg-muted rounded w-16" />
            <div className="h-6 bg-muted rounded-full w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
