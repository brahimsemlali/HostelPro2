export default function BedsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Quick actions bar */}
      <div className="flex gap-3">
        <div className="h-9 bg-muted rounded-xl w-36" />
        <div className="h-9 bg-muted rounded-xl w-28" />
        <div className="h-9 bg-muted rounded-xl w-28" />
      </div>

      {/* Room sections */}
      {Array.from({ length: 3 }).map((_, roomIdx) => (
        <div key={roomIdx} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 bg-muted rounded w-28" />
            <div className="h-5 bg-muted rounded-full w-16" />
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {Array.from({ length: roomIdx === 2 ? 4 : 6 }).map((_, bedIdx) => (
              <div key={bedIdx} className="h-20 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
