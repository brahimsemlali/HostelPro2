export default function NightAuditLoading() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-pulse">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-muted rounded-full" />
            {i < 3 && <div className="w-12 h-0.5 bg-muted" />}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
        <div className="space-y-2">
          <div className="h-5 bg-muted rounded w-48" />
          <div className="h-3.5 bg-muted rounded w-64" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted/30 rounded-xl p-4 space-y-2">
              <div className="h-3 bg-muted rounded w-24" />
              <div className="h-7 bg-muted rounded w-16" />
            </div>
          ))}
        </div>
        <div className="h-10 bg-muted rounded-xl w-full" />
      </div>
    </div>
  )
}
