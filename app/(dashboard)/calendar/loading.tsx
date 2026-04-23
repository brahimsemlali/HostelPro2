export default function CalendarLoading() {
  return (
    <div className="p-6 space-y-4 animate-pulse h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-muted rounded-xl" />
          <div className="h-5 bg-muted rounded w-36" />
          <div className="h-9 w-9 bg-muted rounded-xl" />
        </div>
        <div className="h-9 bg-muted rounded-xl w-32" />
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex-1">
        {/* Room labels + day headers */}
        <div className="flex border-b border-border">
          <div className="w-28 shrink-0 p-3">
            <div className="h-3 bg-muted rounded w-16" />
          </div>
          <div className="flex-1 grid grid-cols-7 gap-0">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="p-3 text-center border-l border-border first:border-0">
                <div className="h-3 bg-muted rounded w-8 mx-auto" />
                <div className="h-5 w-5 bg-muted rounded-full mx-auto mt-1.5" />
              </div>
            ))}
          </div>
        </div>

        {/* Bed rows */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex border-b border-border last:border-0" style={{ height: 44 }}>
            <div className="w-28 shrink-0 px-3 flex items-center">
              <div className="h-3 bg-muted rounded w-10" />
            </div>
            <div className="flex-1 grid grid-cols-7 relative">
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} className="border-l border-border first:border-0" />
              ))}
              {/* Simulated booking block */}
              {i % 3 === 0 && (
                <div
                  className="absolute top-2 h-7 bg-muted rounded-lg"
                  style={{ left: `${(i % 7) * 14.28}%`, width: '28.56%' }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
