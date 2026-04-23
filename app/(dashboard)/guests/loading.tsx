export default function GuestsLoading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      {/* Header + search */}
      <div className="flex items-center justify-between">
        <div className="h-9 bg-muted rounded-xl w-64" />
        <div className="h-9 bg-muted rounded-xl w-32" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="flex gap-4 px-5 py-3 border-b border-border">
          {[160, 80, 100, 80, 60].map((w, i) => (
            <div key={i} className="h-3 bg-muted rounded" style={{ width: w }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
            <div className="w-8 h-8 bg-muted rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-muted rounded w-36" />
              <div className="h-2.5 bg-muted rounded w-20" />
            </div>
            <div className="h-3 bg-muted rounded w-20 hidden sm:block" />
            <div className="h-6 bg-muted rounded-full w-16 hidden md:block" />
            <div className="h-3 bg-muted rounded w-12 hidden lg:block" />
          </div>
        ))}
      </div>
    </div>
  )
}
