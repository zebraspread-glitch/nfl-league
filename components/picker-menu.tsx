"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Pill-button dropdown built on <details>.
 *
 *  The menu items are links that only change the query string, so the App
 *  Router re-renders the page without remounting this element — a plain
 *  <details> would keep its `open` attribute and the panel would sit there
 *  after a selection. Closing it on click (plus Escape / outside click) is
 *  what makes it behave like a menu.
 */
export function PickerMenu({
  label,
  panelClassName = "",
  children,
}: {
  label: ReactNode;
  panelClassName?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  const close = () => ref.current?.removeAttribute("open");

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const el = ref.current;
      if (el?.open && event.target instanceof Node && !el.contains(event.target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={ref} name="matchup-picker" className="group relative inline-block">
      <summary className="flex h-9 cursor-pointer list-none items-center rounded-full border border-border bg-card px-3.5 font-cond text-sm font-bold text-text shadow-sm transition-colors hover:bg-card-hover">
        {label}
      </summary>

      <div
        className={`absolute left-0 top-11 z-20 overflow-hidden rounded-lg border border-border bg-card shadow-lg ${panelClassName}`}
        onClick={close}
      >
        {children}
      </div>
    </details>
  );
}
