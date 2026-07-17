function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-border ${className}`} />;
}

function SkeletonRow({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-t border-border px-3 py-3">
      <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full bg-section" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBlock className={`h-3.5 ${wide ? "w-11/12" : "w-8/12"}`} />
        <SkeletonBlock className="h-3 w-5/12 bg-section" />
      </div>
      <SkeletonBlock className="h-6 w-12 bg-section" />
    </div>
  );
}

export function PageLoadingSkeleton({ compact = false }: { compact?: boolean }) {
  const rows = compact ? 5 : 7;

  return (
    <div aria-busy="true" aria-label="Loading page" className="animate-pulse space-y-3">
      <div className="px-1 pb-2 pt-1">
        <SkeletonBlock className="h-3 w-28 bg-section" />
        <SkeletonBlock className="mt-2 h-8 w-48 bg-section" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-card p-3 shadow-sm">
          <SkeletonBlock className="h-3 w-12 bg-section" />
          <SkeletonBlock className="mt-3 h-7 w-16 bg-section" />
        </div>
        <div className="rounded-xl bg-card p-3 shadow-sm">
          <SkeletonBlock className="h-3 w-14 bg-section" />
          <SkeletonBlock className="mt-3 h-7 w-12 bg-section" />
        </div>
        <div className="rounded-xl bg-card p-3 shadow-sm">
          <SkeletonBlock className="h-3 w-10 bg-section" />
          <SkeletonBlock className="mt-3 h-7 w-14 bg-section" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-card shadow-sm">
        <div className="bg-section px-4 py-3">
          <SkeletonBlock className="h-4 w-36 bg-border-strong" />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonRow key={index} wide={index % 3 === 0} />
        ))}
      </div>

      {!compact && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-card p-4 shadow-sm">
            <SkeletonBlock className="h-4 w-28 bg-section" />
            <SkeletonBlock className="mt-4 h-24 w-full bg-section" />
          </div>
          <div className="rounded-xl bg-card p-4 shadow-sm">
            <SkeletonBlock className="h-4 w-24 bg-section" />
            <SkeletonBlock className="mt-4 h-24 w-full bg-section" />
          </div>
        </div>
      )}
    </div>
  );
}
