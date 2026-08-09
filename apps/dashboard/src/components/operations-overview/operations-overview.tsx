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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function AvailabilityRow({ item }: { item: OperationalAreaView }) {
  const meta = STATUS_META[item.status];
  return (
    <li className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 items-center gap-2 sm:w-44 sm:shrink-0">
        <span className={`size-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
        <span className="truncate text-sm font-medium text-fg">{item.area}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-fg-secondary">{item.question}</p>
        <p className="mt-0.5 text-[0.7rem] leading-5 text-fg-muted">{item.detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={`text-[0.7rem] font-medium uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
        {item.href && (
          <Link
            href={item.href}
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Open
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </li>
  );
}

export function OperationsOverview() {
  const model = getOperationsOverviewModel();
  const { executionBoundary: boundary } = model;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-fg-secondary">
        <Activity className="size-4 text-primary" aria-hidden="true" />
        Operations states what Hebun can observe and what it can execute today — honestly, without inflating runtime reality.
      </div>

      {/* Availability map — honest state per subsystem, no counts */}
      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-fg">Operational availability</h2>
          <p className="text-[0.7rem] text-fg-muted">What is connected, derived, seeded, or not connected — honest state only.</p>
        </div>
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
          {model.availability.map((item) => (
            <AvailabilityRow key={item.area} item={item} />
          ))}
        </ul>
      </section>

      {/* Execution boundary — counts from the REAL action registry */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Execution boundary</CardTitle>
            <span className="text-xs text-fg-muted">Prepared ≠ authorized ≠ executed ≠ successful.</span>
          </div>
          <Link
            href="/director/execution-center"
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover"
          >
            Open Execution
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Declared actions", value: boundary.declared },
              { label: "Invokable (READ_ONLY)", value: boundary.invokable },
              { label: "Non-executable", value: boundary.nonExecutable },
            ].map((stat) => (
              <div key={stat.label} className="rounded-md border border-border bg-surface-sunken p-3">
                <p className="text-lg font-bold tabular-nums text-fg">{stat.value}</p>
                <p className="mt-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-fg-muted">{stat.label}</p>
              </div>
            ))}
          </div>
          <ul className="flex flex-col gap-1.5">
            {boundary.summary.map((line) => (
              <li key={line} className="flex items-start gap-2 text-xs leading-5 text-fg-secondary">
                <GitBranch className="mt-0.5 size-3 shrink-0 text-fg-muted" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Operational signals — honest, no fabricated alerts/events */}
      <Card>
        <CardHeader>
          <CardTitle>Operational signals</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-fg-secondary">{model.signalsNote}</p>
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Operations is read-only. It observes and explains operational state; it never runs, retries, kills, or executes work.
      </p>
    </div>
  );
}
