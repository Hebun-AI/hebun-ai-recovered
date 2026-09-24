/*
 * operations-overview.tsx — the Operations Overview truth surface (Hebun UI Phase 22B).
 *
 * States what operational reality Hebun can actually observe today: an honest availability
 * map, the prepared→executed boundary (counts from the REAL action registry), and an honest
 * signals note. It renders NO aggregate Operations Health %, uptime, success rate, or any
 * fabricated run / queue / incident / agent / workflow count, and NO execution controls.
 *
 * Server component — no client state, no mutation affordance.
 */

import Link from "next/link";
import { ArrowUpRight, Activity, GitBranch, ShieldOff } from "lucide-react";
import {
  getOperationsOverviewModel,
  type OperationalStatus,
  type OperationalAreaView,
} from "@/features/operations-overview";

const STATUS_META: Record<OperationalStatus, { label: string; dot: string; text: string }> = {
  connected: { label: "Connected", dot: "bg-success", text: "text-success" },
  derived: { label: "Derived", dot: "bg-info", text: "text-info" },
  empty: { label: "Empty", dot: "bg-fg-muted", text: "text-fg-muted" },
  seeded: { label: "Seeded", dot: "bg-warning", text: "text-warning" },
  simulated: { label: "Simulation only", dot: "bg-warning", text: "text-warning" },
  "not-connected": { label: "Not connected", dot: "bg-fg-muted", text: "text-fg-muted" },
  restricted: { label: "Restricted", dot: "bg-error", text: "text-error" },
  "in-memory": { label: "In-memory", dot: "bg-fg-muted", text: "text-fg-muted" },
};

/*
 * OPS-VIS-3. A ROW, not a card. Eleven capability cards with a paragraph each consumed most of a
 * screen for information a Director scans rather than reads — the page's least important band was
 * its largest. The row states the two things a scan needs, the name and the honest status, and the
 * question, the explanation and the link are one disclosure away.
 *
 * THE TRUTH LABELS ARE NOT DEMOTED, ONLY THE PROSE. Seeded still reads Seeded, simulation still
 * reads Simulation only, derived Derived, in-memory In-memory and not-connected Not connected —
 * each with its own colour and dot, never equated with Connected. A gap that is hidden stops being
 * known, and every one of these is a real thing Hebun cannot do yet.
 */
function AvailabilityRow({ item }: { item: OperationalAreaView }) {
  const meta = STATUS_META[item.status];
  return (
    <li className="min-w-0 border-b border-border-subtle last:border-b-0">
      <details className="min-w-0">
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className={`size-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
            <span className="truncate text-xs font-medium text-fg">{item.area}</span>
          </span>
          <span
            className={`shrink-0 text-[0.65rem] font-medium uppercase tracking-wide ${meta.text}`}
          >
            {meta.label}
          </span>
        </summary>
        <div className="space-y-1 pb-2 pl-3.5">
          <p className="text-[0.7rem] font-medium leading-4 text-fg-secondary">{item.question}</p>
          <p className="text-[0.7rem] leading-4 text-fg-muted">{item.detail}</p>
          {item.href && (
            <Link
              href={item.href}
              className="inline-flex w-fit items-center gap-0.5 text-[0.7rem] font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            >
              Open
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      </details>
    </li>
  );
}

export function OperationsOverview() {
  const model = getOperationsOverviewModel();
  const { executionBoundary: boundary } = model;

  return (
    <div className="mt-6 flex min-w-0 flex-col gap-3 border-t border-border pt-5">
      {/*
        BAND 3 HEADER. Demoted, not removed: this band is a capability/reality diagnostic, and it
        sits beneath the workspace and the act boundary rather than leading the page. The seeded,
        simulated and not-connected rows below stay visible BY NAME — a known gap that is hidden
        stops being known, and every one of them is a real thing Hebun cannot do yet.
      */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Activity className="size-4 text-fg-muted" aria-hidden="true" />
          What Hebun can observe
        </h2>
        <p className="text-[0.7rem] text-fg-muted">
          A capability diagnostic, not the workspace. Seeded and simulated subsystems are named as such.
        </p>
      </div>

      {/* Availability — honest state per subsystem, no counts. Three scannable columns. */}
      <ul className="grid min-w-0 grid-cols-1 gap-x-6 rounded-lg border border-border bg-surface px-3 py-1 md:grid-cols-2 xl:grid-cols-3">
        {model.availability.map((item) => (
          <AvailabilityRow key={item.area} item={item} />
        ))}
      </ul>

      {/*
        The two secondary diagnostics, side by side and compact. The boundary's five standing
        sentences are kept in full, one disclosure below the counts they qualify.
      */}
      <div className="grid min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold text-fg">Execution boundary</h3>
            <Link
              href="/director/execution-center"
              className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover"
            >
              Open Execution
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          {/* Counts from the REAL action registry. Nothing here is a literal. */}
          <dl className="grid grid-cols-3 gap-x-3">
            {[
              { label: "Declared", value: boundary.declared },
              { label: "Invokable", value: boundary.invokable },
              { label: "Non-executable", value: boundary.nonExecutable },
            ].map((stat) => (
              <div key={stat.label} className="min-w-0">
                <dt className="truncate text-[0.6rem] font-medium uppercase tracking-wide text-fg-muted">
                  {stat.label}
                </dt>
                <dd className="text-lg font-semibold tabular-nums leading-6 text-fg">{stat.value}</dd>
              </div>
            ))}
          </dl>
          <details className="min-w-0">
            <summary className="cursor-pointer select-none text-[0.7rem] text-fg-muted">
              Prepared ≠ authorized ≠ executed ≠ successful
            </summary>
            <ul className="flex flex-col gap-1 pt-1.5">
              {boundary.summary.map((line) => (
                <li key={line} className="flex items-start gap-2 text-[0.7rem] leading-4 text-fg-secondary">
                  <GitBranch className="mt-0.5 size-3 shrink-0 text-fg-muted" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </details>
        </div>

        <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-surface p-3">
          <h3 className="text-sm font-semibold text-fg">Operational signals</h3>
          <p className="text-[0.7rem] leading-4 text-fg-secondary">{model.signalsNote}</p>
        </div>
      </div>

      <p className="flex items-center gap-2 text-[0.7rem] text-fg-muted">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Operations is read-only. It observes and explains operational state; it never runs, retries, kills, or executes work.
      </p>
    </div>
  );
}
