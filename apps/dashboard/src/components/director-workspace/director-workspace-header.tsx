import { CalendarDays, RefreshCw } from "lucide-react";

const directorTimeZone = "Europe/Istanbul";

export function DirectorWorkspaceHeader({ updatedAtIso }: { updatedAtIso: string }) {
  const currentDate = new Date();
  const updatedAt = new Date(updatedAtIso);
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: directorTimeZone,
  }).format(currentDate);
  const updated = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: directorTimeZone,
  }).format(updatedAt);

  return (
    <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-primary">Director briefing</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Good morning, Şenol.</h2>
        <p className="mt-3 text-base leading-7 text-fg-secondary">
          The enterprise is stable. Two decisions and one compliance risk need your attention today.
        </p>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-fg-secondary">
        <span className="flex items-center gap-2"><CalendarDays className="size-4" />{date}</span>
        <span className="flex items-center gap-2"><RefreshCw className="size-4" />Updated {updated}</span>
      </div>
    </header>
  );
}
