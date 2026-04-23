export default function MaintenanceLoading() {
  return (
    <div className="p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-5 bg-muted rounded w-32" />
        <div className="h-9 bg-muted rounded-xl w-40" />
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['Ouvert', 'En cours', 'Résolu'].map((col) => (
          <div key={col} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-muted" />
              <div className="h-3.5 bg-muted rounded w-20" />
              <div className="h-5 bg-muted rounded-full w-6 ml-auto" />
            </div>
            {Array.from({ length: col === 'Résolu' ? 2 : 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                <div className="h-3.5 bg-muted rounded w-40" />
                <div className="h-2.5 bg-muted rounded w-28" />
                <div className="flex gap-2">
                  <div className="h-5 bg-muted rounded-full w-14" />
                  <div className="h-5 bg-muted rounded-full w-16" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
