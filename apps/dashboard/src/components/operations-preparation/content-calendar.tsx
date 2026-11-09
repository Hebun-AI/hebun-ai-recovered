/*
 * V1-STAGE-2 — the content calendar on /operations. Server component: every time is rendered in the
 * zone it was chosen in, with that zone named, so server and browser agree and nobody guesses which
 * clock a time means. Open schedules first, grouped by their local day; then the recent closed ones.
 */
import Link from "next/link";
import { readContentSchedulesAction } from "@/app/(dashboard)/operations/schedule-actions";
import { formatInZone, type ContentScheduleView } from "@/features/content-schedule/contracts";
import { ScheduleRowActions } from "./content-schedule-controls";

const DESTINATION = { instagram: "Instagram", youtube: "YouTube" } as const;

function Row({ s }: { readonly s: ContentScheduleView }) {
  const when = formatInZone(s.scheduledFor, s.timeZone);
  return (
    <li className="min-w-0 space-y-1 rounded border border-border-subtle p-2 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-medium text-fg-primary">{s.title}</span>
        <span className="text-fg-muted">
          {DESTINATION[s.destination]} · revision {s.revisionNo}
        </span>
      </div>
      <p className="text-fg-secondary">
        {when.slice(11)}
        {s.state === "scheduled" && s.due ? " · due now" : ""}
        {s.state === "scheduled" && s.stale ? " · a newer revision exists; this one can no longer be proposed" : ""}
        {s.state === "requested" ? " · proposed, governed request filed" : ""}
        {s.state === "cancelled" ? " · cancelled" : ""}
      </p>
      {s.state === "scheduled" ? (
        <ScheduleRowActions scheduleId={s.scheduleId} version={s.version} due={s.due} stale={s.stale} timeZone={s.timeZone} />
      ) : s.state === "requested" ? (
        <Link href="/approvals" className="underline underline-offset-2 text-fg-secondary">
          See its approval
        </Link>
      ) : null}
    </li>
  );
}

export async function ContentCalendar() {
  const read = await readContentSchedulesAction();
  if (read.status === "unauthenticated") return null;
  return (
    <section aria-labelledby="content-calendar-heading" className="min-w-0 space-y-3">
      <div>
        <h2 id="content-calendar-heading" className="text-sm font-semibold text-fg-primary">
          Content calendar
        </h2>
        <p className="text-xs text-fg-muted">
          When approved drafts are meant to go out. A schedule publishes nothing by itself: at its moment you propose the publication,
          and it still needs approval and execution.
        </p>
      </div>
      {read.status !== "read" ? (
        <p className="text-xs text-fg-muted">The calendar could not be read right now.</p>
      ) : read.open.length === 0 && read.closed.length === 0 ? (
        <p className="text-xs text-fg-muted">Nothing scheduled. A READY Instagram or YouTube draft can be scheduled from its package panel below.</p>
      ) : (
        <>
          {Object.entries(
            read.open.reduce<Record<string, ContentScheduleView[]>>((days, s) => {
              const day = formatInZone(s.scheduledFor, s.timeZone).slice(0, 10);
              (days[day] ??= []).push(s);
              return days;
            }, {}),
          ).map(([day, items]) => (
            <div key={day} className="space-y-1.5">
              <h3 className="text-xs font-medium text-fg-secondary">{day}</h3>
              <ul className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((s) => (
                  <Row key={s.scheduleId} s={s} />
                ))}
              </ul>
            </div>
          ))}
          {read.closed.length > 0 ? (
            <details className="text-xs">
              <summary className="cursor-pointer text-fg-secondary">Recently proposed or cancelled ({read.closed.length})</summary>
              <ul className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {read.closed.map((s) => (
                  <Row key={s.scheduleId} s={s} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
