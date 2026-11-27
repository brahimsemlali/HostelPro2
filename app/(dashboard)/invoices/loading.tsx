export default function InvoicesLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-10 bg-muted rounded-xl w-48" />
        <div className="h-10 bg-muted rounded-xl w-52" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <div className="h-3 bg-muted rounded w-20" />
            <div className="h-6 bg-muted rounded w-24" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-muted rounded w-28" />
              <div className="h-3 bg-muted rounded w-44" />
            </div>
            <div className="h-4 bg-muted rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
