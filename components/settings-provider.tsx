"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";
export type DesktopLayout = "default" | "half" | "full";

const THEME_KEY = "mgl_theme";
const DESKTOP_LAYOUT_KEY = "mgl_desktop_layout";
// The selected team is stored in a cookie (not localStorage) so the server can
// read it and render the My Team home page without a client round-trip.
const TEAM_COOKIE = "mgl_team";

function readTeamCookie(): number | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)mgl_team=(\d+)/);
  return m ? Number(m[1]) : null;
}

function writeTeamCookie(id: number | null) {
  if (typeof document === "undefined") return;
  if (id == null) {
    document.cookie = `${TEAM_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } else {
    document.cookie = `${TEAM_COOKIE}=${id}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

interface Settings {
  /** Whether the values below have been read from localStorage yet. Avoids a
   *  flash of "no team selected" before hydration on the My Team page. */
  ready: boolean;
  theme: Theme;
  setTheme: (t: Theme) => void;
  desktopLayout: DesktopLayout;
  setDesktopLayout: (layout: DesktopLayout) => void;
  teamId: number | null;
  setTeamId: (id: number | null) => void;
}

const SettingsContext = createContext<Settings | null>(null);

/** Read the persisted theme as early as possible (used by the no-FOUC inline
 *  script too — keep this logic in sync with the script in layout.tsx). */
function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}

function applyDesktopLayoutClass(layout: DesktopLayout) {
  const root = document.documentElement;
  root.classList.remove("desktop-layout-half", "desktop-layout-full");
  if (layout !== "default") root.classList.add(`desktop-layout-${layout}`);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [theme, setThemeState] = useState<Theme>("light");
  const [desktopLayout, setDesktopLayoutState] = useState<DesktopLayout>("default");
  const [teamId, setTeamIdState] = useState<number | null>(null);

  // One-time hydration load from localStorage on the client.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const storedTheme = localStorage.getItem(THEME_KEY);
      if (storedTheme === "light" || storedTheme === "dark") {
        setThemeState(storedTheme);
        applyThemeClass(storedTheme);
      } else {
        // Fall back to whatever the inline script already applied.
        setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light");
      }
      const storedLayout = localStorage.getItem(DESKTOP_LAYOUT_KEY);
      if (storedLayout === "default" || storedLayout === "half" || storedLayout === "full") {
        setDesktopLayoutState(storedLayout);
        applyDesktopLayoutClass(storedLayout);
      } else {
        setDesktopLayoutState(
          document.documentElement.classList.contains("desktop-layout-full")
            ? "full"
            : document.documentElement.classList.contains("desktop-layout-half")
            ? "half"
            : "default",
        );
      }
      setTeamIdState(readTeamCookie());
    } catch {
      // ignore unavailable/corrupt storage
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyThemeClass(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {}
  };

  const setDesktopLayout = (layout: DesktopLayout) => {
    setDesktopLayoutState(layout);
    applyDesktopLayoutClass(layout);
    try {
      localStorage.setItem(DESKTOP_LAYOUT_KEY, layout);
    } catch {}
  };

  const setTeamId = (id: number | null) => {
    setTeamIdState(id);
    writeTeamCookie(id);
  };

  return (
    <SettingsContext.Provider value={{ ready, theme, setTheme, desktopLayout, setDesktopLayout, teamId, setTeamId }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
