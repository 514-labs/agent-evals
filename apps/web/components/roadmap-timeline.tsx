type RoadmapItem = {
  label: string
  description?: string
}

function StatusBadge({ status }: { status: "active" | "next" | "future" }) {
  const styles = {
    active: "bg-[#FF10F0] text-black border-black",
    next: "bg-black text-white border-black",
    future: "bg-transparent text-black/40 border-black/20 border-dashed",
  }
  const labels = {
    active: "IN PROGRESS",
    next: "UP NEXT",
    future: "FUTURE",
  }
  return (
    <span className={`text-xs font-bold uppercase tracking-[0.3em] border-[2px] px-2 py-0.5 inline-block ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export function RoadmapTimeline({
  currentTitle = "v0.1",
  currentDescription = "We're actively iterating on the current research preview.",
  nextTitle = "v0.2",
  nextItems = [],
  futureItems = [],
}: {
  currentTitle?: string
  currentDescription?: string
  nextTitle?: string
  nextItems?: RoadmapItem[]
  futureItems?: RoadmapItem[]
}) {
  return (
    <div className="space-y-6">
      {/* Current */}
      <div className="border-[3px] border-black">
        <div className="px-6 py-4 flex items-center gap-4">
          <StatusBadge status="active" />
          <span className="font-[family-name:var(--font-display)] text-2xl tracking-tight uppercase leading-none">
            {currentTitle}
          </span>
        </div>
        <div className="px-6 pb-4">
          <p className="text-sm text-black/50 tracking-wide">{currentDescription}</p>
        </div>
      </div>

      {/* Up Next */}
      {nextItems.length > 0 && (
        <div className="border-[3px] border-black">
          <div className="px-6 py-4 flex items-center gap-4 border-b-[2px] border-black/15">
            <StatusBadge status="next" />
            <span className="font-[family-name:var(--font-display)] text-2xl tracking-tight uppercase leading-none">
              {nextTitle}
            </span>
          </div>
          <div className="px-6 py-4 space-y-3">
            {nextItems.map((item) => (
              <div key={item.label} className="flex items-start gap-3 group">
                <span className="mt-1.5 block size-2 border-[2px] border-black shrink-0 group-hover:bg-[#FF10F0] transition-colors" />
                <div>
                  <span className="text-sm font-bold uppercase tracking-[0.1em]">
                    {item.label}
                  </span>
                  {item.description && (
                    <p className="text-sm text-black/50 mt-0.5">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Future */}
      {futureItems.length > 0 && (
        <div className="border-[2px] border-dashed border-black/20">
          <div className="px-6 py-4 flex items-center gap-4 border-b-[2px] border-dashed border-black/10">
            <StatusBadge status="future" />
          </div>
          <div className="px-6 py-4 space-y-3">
            {futureItems.map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <span className="mt-1.5 block size-2 border-[2px] border-dashed border-black/20 shrink-0" />
                <div>
                  <span className="text-sm font-bold uppercase tracking-[0.1em] text-black/40">
                    {item.label}
                  </span>
                  {item.description && (
                    <p className="text-sm text-black/30 mt-0.5">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
