export default function WhatsAppLoading() {
  return (
    <div className="p-6 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-120px)]">
        {/* Templates panel */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="h-4 bg-muted rounded w-32" />
          <div className="h-9 bg-muted rounded-xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-border rounded-xl p-4 space-y-3">
              <div className="h-3.5 bg-muted rounded w-36" />
              <div className="h-20 bg-muted/50 rounded-lg" />
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-7 bg-muted rounded-xl w-10" />
                ))}
              </div>
              <div className="h-8 bg-muted rounded-xl w-full" />
            </div>
          ))}
        </div>

        {/* Message log */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <div className="h-4 bg-muted rounded w-28" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <div className="w-8 h-8 bg-muted rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-muted rounded w-32" />
                <div className="h-2.5 bg-muted rounded w-48" />
              </div>
              <div className="h-2.5 bg-muted rounded w-14 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
