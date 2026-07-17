"use client";

import { useRouter } from "next/navigation";
import { NAVIGATION_START_EVENT } from "@/components/navigation-progress";

type RoundOption = {
  week: number;
  label: string;
};

export function RoundSelect({
  season,
  selectedWeek,
  rounds,
}: {
  season: number;
  selectedWeek: number;
  rounds: RoundOption[];
}) {
  const router = useRouter();

  return (
    <div className="mb-4 px-1">
      <select
        aria-label="Round"
        value={selectedWeek}
        onChange={(event) => {
          window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
          router.push(`/games?season=${season}&week=${event.target.value}`);
        }}
        className="h-10 w-full rounded-xl border border-black/5 bg-card px-3 font-cond text-base font-semibold text-text shadow-sm outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20 sm:max-w-72"
      >
        {rounds.map((round) => (
          <option key={round.week} value={round.week}>
            {round.label}
          </option>
        ))}
      </select>
    </div>
  );
}
