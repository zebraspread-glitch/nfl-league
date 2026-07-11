"use client";

import { useRouter } from "next/navigation";
import { TEAMS } from "@/lib/teams";
import { Card, SectionHeader, PageIntro, TeamAvatar } from "@/components/ui";
import { useSettings, type Theme } from "@/components/settings-provider";

export default function SettingsPage() {
  const { ready, theme, setTheme, teamId, setTeamId } = useSettings();
  const router = useRouter();

  // Team is stored in a cookie the server reads for the My Team home page, so
  // refresh the router cache after changing it to keep that page in sync.
  const chooseTeam = (id: number | null) => {
    setTeamId(id);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <PageIntro title="Settings" subtitle="Personalise your MGL app" />

      <Card>
        <SectionHeader>Appearance</SectionHeader>
        <div className="p-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-section p-1">
            <ThemeOption label="Light" value="light" current={theme} onSelect={setTheme} />
            <ThemeOption label="Dark" value="dark" current={theme} onSelect={setTheme} />
          </div>
          <p className="mt-2 px-1 text-xs text-text-muted">
            Choose how the app looks. Your choice is saved on this device.
          </p>
        </div>
      </Card>

      <Card>
        <SectionHeader>My Team</SectionHeader>
        <div className="p-3">
          <p className="mb-3 px-1 text-xs text-text-muted">
            Pick your franchise — it becomes your home page (My Team).
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TEAMS.map((t) => {
              const selected = ready && teamId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => chooseTeam(selected ? null : t.id)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? "border-teal bg-teal/10 ring-1 ring-teal"
                      : "border-border bg-row hover:bg-card-hover"
                  }`}
                >
                  <TeamAvatar team={t} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-cond text-sm font-semibold leading-tight">{t.name}</div>
                    <div className="truncate text-[11px] text-text-muted">{t.manager}</div>
                  </div>
                  {selected ? <Check /> : null}
                </button>
              );
            })}
          </div>
          {ready && teamId != null ? (
            <button
              type="button"
              onClick={() => chooseTeam(null)}
              className="mt-3 w-full rounded-lg border border-border py-2 font-cond text-sm font-semibold uppercase tracking-wide text-text-muted hover:bg-card-hover"
            >
              Clear selection
            </button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function ThemeOption({
  label,
  value,
  current,
  onSelect,
}: {
  label: string;
  value: Theme;
  current: Theme;
  onSelect: (t: Theme) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex items-center justify-center gap-2 rounded-md py-2.5 font-cond text-sm font-semibold uppercase tracking-wide transition-colors ${
        active ? "bg-card text-text shadow-sm" : "text-text-muted hover:text-text"
      }`}
    >
      {value === "light" ? <Sun /> : <Moon />}
      {label}
    </button>
  );
}

function Sun() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function Moon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function Check() {
  return (
    <svg className="shrink-0 text-teal" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
