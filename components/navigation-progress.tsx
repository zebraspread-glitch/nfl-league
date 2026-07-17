"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PageLoadingSkeleton } from "@/components/page-loading";

export const NAVIGATION_START_EVENT = "mgl:navigation-start";

function shouldIgnoreClick(event: MouseEvent) {
  return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function isSameDocumentOnly(next: URL, current: URL) {
  return next.pathname === current.pathname && next.search === current.search;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => {
    const search = searchParams.toString();
    return `${pathname}${search ? `?${search}` : ""}`;
  }, [pathname, searchParams]);
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const resetTimer = window.setTimeout(() => setPending(false), 0);
    return () => window.clearTimeout(resetTimer);
  }, [routeKey]);

  useEffect(() => {
    const startPending = () => {
      setPending(true);
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setPending(false);
        timeoutRef.current = null;
      }, 12000);
    };

    const onClick = (event: MouseEvent) => {
      if (shouldIgnoreClick(event)) return;
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const next = new URL(anchor.href);
      const current = new URL(window.location.href);
      if (next.origin !== current.origin || isSameDocumentOnly(next, current)) return;

      startPending();
    };

    window.addEventListener("click", onClick, true);
    window.addEventListener(NAVIGATION_START_EVENT, startPending);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener(NAVIGATION_START_EVENT, startPending);
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!pending) return null;

  return (
    <div className="app-fixed-bar pointer-events-none fixed inset-x-0 bottom-0 top-0 z-20 mx-auto max-w-xl">
      <div
        className="h-full overflow-hidden bg-bg px-3 pb-24"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 3.5rem + 0.75rem)" }}
      >
        <PageLoadingSkeleton compact />
      </div>
    </div>
  );
}
