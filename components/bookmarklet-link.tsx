"use client";

import { useEffect, useRef } from "react";

/**
 * A draggable `javascript:` link. The href is attached to the node directly
 * rather than passed through JSX: React strips javascript: URLs, and this one
 * has to survive to be dragged onto the bookmarks bar.
 */
export function BookmarkletLink({ href, children }: { href: string; children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.setAttribute("href", href);
  }, [href]);

  return (
    <a
      ref={ref}
      // Clicking it here would run the overlay against this page, which is not
      // where it belongs — it only means anything on the draft room.
      onClick={(event) => event.preventDefault()}
      className="inline-block cursor-grab rounded-md bg-teal px-5 py-3 font-cond text-lg font-extrabold uppercase tracking-widest text-black"
    >
      {children}
    </a>
  );
}
