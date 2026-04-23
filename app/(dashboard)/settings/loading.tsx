export default function SettingsLoading() {
  return (
    <div className="p-6 max-w-2xl space-y-6 animate-pulse">
      {/* Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
        <div className="h-4 bg-muted rounded w-36" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 bg-muted rounded w-20" />
              <div className="h-10 bg-muted rounded-xl" />
            </div>
          ))}
        </div>
        <div className="h-10 bg-muted rounded-xl w-28 ml-auto" />
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <div className="h-4 bg-muted rounded w-28" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-10 bg-muted rounded-xl" />
          </div>
        ))}
        <div className="h-10 bg-muted rounded-xl w-28 ml-auto" />
      </div>
    </div>
  )
}
