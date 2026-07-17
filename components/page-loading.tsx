export type PageLoadingVariant = "home" | "matchups" | "teams" | "players" | "more" | "detail" | "table" | "draft" | "mockDraft";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-border ${className}`} />;
}

function SkeletonText({ className = "" }: { className?: string }) {
  return <SkeletonBlock className={`h-3 bg-section ${className}`} />;
}

function PageTitleSkeleton({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="px-1 pb-2 pt-1">
      {subtitle && <SkeletonText className="w-28" />}
      <SkeletonBlock className="mt-2 h-8 w-48 bg-section" />
    </div>
  );
}

function StatCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl bg-card p-3 shadow-sm">
          <SkeletonText className="w-12" />
          <SkeletonBlock className="mt-3 h-7 w-16 bg-section" />
        </div>
      ))}
    </div>
  );
}

function ListRowSkeleton({ wide = false, avatar = true }: { wide?: boolean; avatar?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-t border-border px-3 py-3">
      {avatar && <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full bg-section" />}
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonText className={wide ? "w-11/12" : "w-8/12"} />
        <SkeletonText className="w-5/12" />
      </div>
      <SkeletonBlock className="h-6 w-12 bg-section" />
    </div>
  );
}

function CardListSkeleton({ rows = 6, header = true }: { rows?: number; header?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm">
      {header && (
        <div className="bg-section px-4 py-3">
          <SkeletonBlock className="h-4 w-36 bg-border-strong" />
        </div>
      )}
      {Array.from({ length: rows }, (_, index) => (
        <ListRowSkeleton key={index} wide={index % 3 === 0} />
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm">
      <div className="grid gap-3 bg-section px-3 py-3" style={{ gridTemplateColumns: `1.8fr repeat(${columns - 1}, minmax(2.5rem, 1fr))` }}>
        {Array.from({ length: columns }, (_, index) => (
          <SkeletonBlock key={index} className="h-3 bg-border-strong" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid items-center gap-3 border-t border-border px-3 py-3"
          style={{ gridTemplateColumns: `1.8fr repeat(${columns - 1}, minmax(2.5rem, 1fr))` }}
        >
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-8 w-8 shrink-0 rounded-full bg-section" />
            <SkeletonText className={rowIndex % 2 ? "w-20" : "w-28"} />
          </div>
          {Array.from({ length: columns - 1 }, (_, colIndex) => (
            <SkeletonBlock key={colIndex} className="h-4 bg-section" />
          ))}
        </div>
      ))}
    </div>
  );
}

function HomeSkeleton({ compact = false }: { compact?: boolean }) {
  const rows = compact ? 5 : 8;
  return (
    <div className="space-y-3">
      <div className="px-1 pb-2 pt-1">
        <SkeletonText className="w-36" />
      </div>
      <div className="overflow-hidden rounded-xl bg-card shadow-sm">
        <div className="px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-7 w-40 bg-section" />
              <SkeletonText className="mt-2 w-28" />
            </div>
            <SkeletonBlock className="h-11 w-11 rounded-full bg-section" />
          </div>
        </div>
        <div className="bg-section px-4 py-3">
          <SkeletonBlock className="h-4 w-24 bg-border-strong" />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <ListRowSkeleton key={index} wide={index % 2 === 0} />
        ))}
      </div>
    </div>
  );
}

function MatchupsSkeleton({ compact = false }: { compact?: boolean }) {
  const cards = compact ? 3 : 5;
  return (
    <div className="space-y-3">
      <PageTitleSkeleton subtitle={false} />
      <div className="flex gap-2 overflow-hidden px-1">
        {Array.from({ length: 5 }, (_, index) => (
          <SkeletonBlock key={index} className="h-9 w-16 shrink-0 rounded-lg bg-card" />
        ))}
      </div>
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="rounded-xl bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SkeletonBlock className="h-12 w-12 rounded-full bg-section" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonText className="w-28" />
                <SkeletonText className="w-16" />
              </div>
            </div>
            <SkeletonBlock className="h-8 w-14 bg-section" />
          </div>
          <div className="my-3 h-px bg-border" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SkeletonBlock className="h-12 w-12 rounded-full bg-section" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonText className="w-32" />
                <SkeletonText className="w-20" />
              </div>
            </div>
            <SkeletonBlock className="h-8 w-14 bg-section" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamsSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-3">
      <PageTitleSkeleton />
      <div className="flex gap-2 overflow-hidden px-1">
        {Array.from({ length: 5 }, (_, index) => (
          <SkeletonBlock key={index} className="h-9 w-20 shrink-0 rounded-full bg-card" />
        ))}
      </div>
      <TableSkeleton rows={compact ? 7 : 10} columns={5} />
    </div>
  );
}

function PlayersSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="-mx-3 -mt-3 min-h-screen bg-[#dfddd8] pb-28 text-[#353638]">
      <section className="px-3 pt-3">
        <div className="rounded-2xl bg-white px-3 py-3 shadow-[0_2px_0_rgba(0,0,0,0.22)]">
          <SkeletonBlock className="h-9 w-full rounded-lg bg-[#eeeeee]" />
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {Array.from({ length: 3 }, (_, index) => (
              <SkeletonBlock key={index} className="h-7 rounded-md bg-[#eeeeee]" />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {Array.from({ length: 8 }, (_, index) => (
              <SkeletonBlock key={index} className="h-7 rounded-md bg-[#eeeeee]" />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <SkeletonBlock className="h-8 rounded-md bg-[#eeeeee]" />
            <SkeletonBlock className="h-8 rounded-md bg-[#eeeeee]" />
          </div>
        </div>
      </section>
      <div className="px-3 pb-3 pt-5">
        <SkeletonBlock className="h-5 w-32 bg-[#cfcac2]" />
      </div>
      <div className="overflow-hidden bg-white">
        {Array.from({ length: compact ? 7 : 10 }, (_, index) => (
          <div key={index} className="grid grid-cols-[2.2fr_3.5rem_3.5rem_3.5rem] items-center gap-2 border-t border-[#e5e5e5] px-3 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <SkeletonBlock className="h-9 w-9 rounded-full bg-[#e6e6e6]" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className="h-3 w-28 bg-[#e6e6e6]" />
                <SkeletonBlock className="h-3 w-16 bg-[#eeeeee]" />
              </div>
            </div>
            <SkeletonBlock className="h-4 bg-[#eeeeee]" />
            <SkeletonBlock className="h-4 bg-[#eeeeee]" />
            <SkeletonBlock className="h-4 bg-[#eeeeee]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function MoreSkeleton() {
  return (
    <div className="space-y-3">
      <PageTitleSkeleton subtitle={false} />
      <div className="grid gap-2">
        {Array.from({ length: 11 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-sm">
            <SkeletonBlock className="h-9 w-9 rounded-lg bg-section" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonText className={index % 2 ? "w-32" : "w-40"} />
              <SkeletonText className="w-20" />
            </div>
            <SkeletonBlock className="h-5 w-5 rounded-full bg-section" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-card p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <SkeletonBlock className="h-16 w-16 shrink-0 rounded-full bg-section" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="h-7 w-44 bg-section" />
            <SkeletonText className="w-28" />
            <SkeletonText className="w-36" />
          </div>
        </div>
      </div>
      <StatCardsSkeleton />
      <CardListSkeleton rows={compact ? 5 : 8} />
    </div>
  );
}

function DraftSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-3">
      <PageTitleSkeleton />
      <div className="flex gap-2 overflow-hidden px-1">
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonBlock key={index} className="h-9 w-16 shrink-0 rounded-lg bg-card" />
        ))}
      </div>
      <CardListSkeleton rows={compact ? 6 : 10} />
    </div>
  );
}

function MockDraftSkeleton() {
  return (
    <div className="-mx-3 -mt-3 min-h-screen bg-[#111] px-3 pb-24 pt-3 text-white">
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <div className="rounded-lg bg-white/10 p-3">
          <SkeletonBlock className="h-4 w-32 bg-white/15" />
          <SkeletonBlock className="mt-3 h-9 w-full bg-white/15" />
        </div>
        <div className="rounded-lg bg-white/10 p-3">
          <SkeletonBlock className="h-4 w-16 bg-white/15" />
          <SkeletonBlock className="mt-3 h-9 w-full bg-white/15" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {Array.from({ length: 28 }, (_, index) => (
          <div key={index} className="h-16 rounded bg-white/10" />
        ))}
      </div>
    </div>
  );
}

export function loadingVariantForPath(pathname: string): PageLoadingVariant {
  if (pathname === "/") return "home";
  if (pathname === "/matchups") return "matchups";
  if (pathname === "/players" || pathname === "/players/search") return "players";
  if (pathname === "/teams" || pathname === "/standings") return "teams";
  if (pathname === "/more" || pathname === "/settings") return "more";
  if (pathname === "/drafts" || pathname === "/trades" || pathname === "/transactions" || pathname === "/playoffs") return "draft";
  if (pathname === "/mock-draft") return "mockDraft";
  if (pathname.startsWith("/matchups/") || pathname.startsWith("/games/") || pathname.startsWith("/players/") || pathname.startsWith("/teams/")) {
    return "detail";
  }
  return "table";
}

export function PageLoadingSkeleton({
  compact = false,
  variant = "table",
}: {
  compact?: boolean;
  variant?: PageLoadingVariant;
}) {
  return (
    <div aria-busy="true" aria-label="Loading page" className="animate-pulse">
      {variant === "home" && <HomeSkeleton compact={compact} />}
      {variant === "matchups" && <MatchupsSkeleton compact={compact} />}
      {variant === "teams" && <TeamsSkeleton compact={compact} />}
      {variant === "players" && <PlayersSkeleton compact={compact} />}
      {variant === "more" && <MoreSkeleton />}
      {variant === "detail" && <DetailSkeleton compact={compact} />}
      {variant === "draft" && <DraftSkeleton compact={compact} />}
      {variant === "mockDraft" && <MockDraftSkeleton />}
      {variant === "table" && (
        <div className="space-y-3">
          <PageTitleSkeleton />
          <StatCardsSkeleton />
          <TableSkeleton rows={compact ? 7 : 10} />
        </div>
      )}
    </div>
  );
}
