export default function ExpensesLoading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 bg-muted rounded-xl w-28" />
          ))}
        </div>
        <div className="h-9 bg-muted rounded-xl w-36" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <div className="h-3 bg-muted rounded w-20" />
            <div className="h-7 bg-muted rounded w-16" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
            <div className="w-8 h-8 bg-muted rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-muted rounded w-40" />
              <div className="h-2.5 bg-muted rounded w-24" />
            </div>
            <div className="h-6 bg-muted rounded-full w-16 hidden sm:block" />
            <div className="h-3 bg-muted rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
