import Link from "next/link";
import { Activity, ArrowRight, CheckCircle2, ChevronRight, Target } from "lucide-react";

import { CommandRegion, OperatingStatement, QuietLink, SourceNote, ordinaryDate } from "@/components/command-overview/region";
import { cn } from "@/lib/utils";
import { ExecutiveContext, OperatingSignalStrip } from "@/components/command-overview/executive-hero";
import { CommandLiveMap, ConnectedSystems, RecordedActivity } from "@/components/command-overview/command-rail";
import { WorkInMotion } from "@/components/command-work/work-in-motion";
import {
  PENDING_READ_BOUND,
  FUTURE_OPERATING_SURFACES,
  UNCONNECTED_CAPABILITIES,
  toCommandStanding,
  toExecutiveSummary,
  type ConnectedCapabilityState,
  type ExpressIntentSummary,
  type WaitingOnYouState,
  type WorkInMotionState,
} from "@/features/command-overview/workspace-model";
import type { LiveMapAwareness } from "@/features/live-map/awareness";
import type { LiveMapProjection } from "@/features/live-map/contracts";
import type { SecurityRecordedActObservation } from "@/features/security-center/contracts";
import type { SecurityAwareness } from "@/features/security-center/awareness";

function PrimaryAction({ href, children }: { readonly href: string; readonly children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex min-w-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-meta font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring">
      {children}
      <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

function NeedsYourDecision({ state }: { readonly state: WaitingOnYouState }) {
  const shown = state.status === "waiting" ? state.items.slice(0, 3) : [];
  const readState = state.status === "unavailable" ? "unavailable" : state.status === "none-waiting" ? "empty" : "available";
  return (
    <CommandRegion
      id="waiting"
      title="Needs your decision"
      question="What is waiting for a human decision in this organization?"
      provenance="authoritative"
      provenanceDetail="The Action Authorization Authority pending queue, scoped to this tenant."
      readState={readState}
      provenanceBounds={state.status === "waiting" ? `${shown.length} rows shown from the ${PENDING_READ_BOUND}-row read bound` : undefined}
      provenanceNonClaims="importance, lateness, approval, or execution"
      weight="card"
      className={cn("cmd-executive-panel cmd-priority-card", state.status === "none-waiting" && "cmd-priority-empty")}
      eyebrow={state.status === "waiting" ? `${shown.length} shown${state.awaitingCount !== null ? ` · ${state.awaitingCount} awaiting` : ""}` : state.status === "none-waiting" ? "0 waiting" : undefined}
    >
      {state.status === "unavailable" ? (
        <OperatingStatement tone="unavailable" compact title="Decision queue unavailable" detail="Hebun could not read it, so it does not know whether anything is waiting." reason={state.reason} />
      ) : state.status === "none-waiting" ? (
        <div data-state-tone="empty" className="cmd-decision-ready flex min-w-0 flex-1 items-center gap-3 border-y border-border py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success" aria-hidden="true">
            <CheckCircle2 className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-title font-semibold text-fg">Nothing needs your decision</span>
            <span className="mt-1 block text-meta text-fg-secondary">You’re all caught up.</span>
            <span className="sr-only">The queue answered and nothing is waiting.</span>
          </span>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col">
          <ul className="flex min-w-0 flex-col divide-y divide-border">
            {shown.map((item) => (
              <li key={item.requestId} className="flex min-w-0 items-start gap-3 py-2.5 first:pt-0">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="min-w-0 text-meta font-semibold text-fg">{item.actionKind}</span>
                    {item.targetLabel ? <span className="min-w-0 truncate text-label text-fg-secondary">{item.targetLabel}</span> : null}
                  </span>
                  <span className="mt-0.5 block min-w-0 truncate text-label leading-4 text-fg-muted">
                    {item.expectedEffect} · {ordinaryDate(item.proposedAt)}{item.waitingFor ? ` · Waiting ${item.waitingFor.label}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {state.oldestWaiting ? <p className="mt-2 text-label text-fg-muted">Oldest waiting {state.oldestWaiting.label}</p> : null}
          {state.boundReached ? <p className="mt-2 text-label text-fg-muted">Showing {shown.length} from the most recent {PENDING_READ_BOUND}; more are waiting in Decisions.</p> : null}
        </div>
      )}

      <div className="mt-auto flex min-w-0 items-center gap-3">
        {state.status === "waiting" ? <PrimaryAction href="/approvals">Review Decisions</PrimaryAction> : null}
        {state.status === "unavailable" ? <PrimaryAction href="/approvals">Open Decisions</PrimaryAction> : null}
        {state.status === "none-waiting" ? <QuietLink href="/approvals">Open Decisions</QuietLink> : null}
      </div>
    </CommandRegion>
  );
}

function HebyOperatingSurface({ intent }: { readonly intent: ExpressIntentSummary }) {
  const surface = FUTURE_OPERATING_SURFACES.find((candidate) => candidate.id === "heby-runtime");
  return (
    <section id="heby-runtime" aria-label="Heby" aria-describedby="heby-runtime-question" data-future-surface="heby-runtime" data-capability-state="not-connected" className="cmd-executive-panel cmd-heby-panel flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p id="heby-runtime-question" className="sr-only">What can Hebun prove about Heby’s current runtime activity?</p>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-title font-semibold leading-tight tracking-tight text-fg">Heby</h2>
          <p className="mt-0.5 text-label text-fg-muted">AI Operating Surface</p>
        </div>
        <span className="shrink-0 text-label font-medium text-fg-muted">Runtime not connected</span>
      </div>
      <div className="cmd-heby-dormant flex min-w-0 flex-1 flex-col items-center justify-center border-y border-border px-4 py-3 text-center">
        <span className="cmd-heby-orbit flex size-14 items-center justify-center rounded-full border border-border-strong bg-surface text-highlight" aria-hidden="true">
          <Activity className="size-7" />
        </span>
        <p className="mt-2 text-meta font-semibold text-fg">Live activity is not available</p>
        <p className="mt-1 max-w-72 text-label leading-5 text-fg-secondary">{surface?.statement}</p>
        <p className="mt-2 text-label text-fg-muted">{intent.declared} capabilities declared · {intent.invokableNow} can run now</p>
      </div>
      <SourceNote
        id="heby-operating-surface-provenance"
        kind="not-connected"
        detail="No authoritative tenant-scoped runtime source is connected for current Heby activity."
        readState="not-connected"
        nonClaims="live activity, current task, progress, completion, or execution success"
      />
    </section>
  );
}

function GoalsOperatingSurface() {
  const surface = FUTURE_OPERATING_SURFACES.find((candidate) => candidate.id === "goals");
  return (
    <section id="goals" aria-label="Goals" aria-describedby="goals-question" data-future-surface="goals" data-capability-state="not-connected" className="cmd-executive-panel cmd-goals-panel flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p id="goals-question" className="sr-only">What strategic goals can Hebun prove for this organization?</p>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="text-title font-semibold leading-tight tracking-tight text-fg">Goals</h2>
        <span className="shrink-0 text-label font-medium text-fg-muted">Not connected</span>
      </div>
      <div className="cmd-goals-dormant flex min-w-0 flex-1 items-center gap-5 border-y border-border py-3">
        <span className="cmd-goals-ring flex size-24 shrink-0 items-center justify-center rounded-full" aria-hidden="true">
          <span className="flex size-14 items-center justify-center rounded-full bg-surface text-fg-muted shadow-xs"><Target className="size-6" /></span>
        </span>
        <span className="min-w-0">
          <span className="block text-meta font-semibold text-fg">Goal authority is not connected</span>
          <span className="mt-1 block text-label leading-5 text-fg-secondary">{surface?.statement}</span>
        </span>
      </div>
      <SourceNote
        id="goals-operating-surface-provenance"
        kind="not-connected"
        detail="The available goal projection is seeded and tenant-blind, so it is withheld here."
        readState="not-connected"
        nonClaims="goal count, progress, target, owner, health, or risk"
      />
    </section>
  );
}

function CapabilityLimits() {
  return (
    <CommandRegion
      id="not-connected"
      title="Capability Limits"
      question="What will Command answer once these sources exist?"
      provenance="not-connected"
      provenanceDetail="No connected source exists for the capabilities listed here."
      readState="not-connected"
      provenanceNonClaims="that the underlying organizational data does not exist"
      weight="bare"
      className="cmd-horizon h-full rounded-2xl border border-border bg-surface px-4 py-4 shadow-sm sm:px-5"
      bodyClassName="gap-2"
    >
      <details className="group min-w-0">
        <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 rounded-md text-meta text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 shrink-0 text-fg-muted transition-transform group-open:rotate-90" aria-hidden="true" />
          <span className="min-w-0 flex-1">More intelligence becomes available as sources are connected.</span>
          <span className="shrink-0 text-label font-semibold text-fg-muted">{UNCONNECTED_CAPABILITIES.length} not connected</span>
        </summary>
        <ul className="grid min-w-0 grid-cols-1 gap-x-8 pt-3 md:grid-cols-2">
          {UNCONNECTED_CAPABILITIES.map((row) => (
            <li key={row.capability} className="min-w-0 border-t border-border py-2">
              <p className="text-meta font-semibold text-fg">{row.capability}</p>
              <p className="text-label leading-5 text-fg-muted">{row.reason}</p>
            </li>
          ))}
        </ul>
      </details>
    </CommandRegion>
  );
}

/** One server-rendered operating picture. It performs no read and owns no action. */
export function CommandOverview({
  waiting,
  intent,
  work,
  capability,
  organization,
  liveMap,
  security,
  recordedActs,
  humanName,
}: {
  readonly waiting: WaitingOnYouState;
  readonly intent: ExpressIntentSummary;
  readonly work: WorkInMotionState;
  readonly capability: ConnectedCapabilityState;
  readonly organization: LiveMapAwareness;
  readonly liveMap: LiveMapProjection;
  readonly security: SecurityAwareness;
  readonly recordedActs: SecurityRecordedActObservation;
  readonly humanName?: string | null;
}) {
  const standing = toCommandStanding(organization);
  const signals = toExecutiveSummary({ waiting, work, capability, security });

  return (
    <div data-command-v3="" className="flex min-w-0 flex-col gap-3.5">
      <ExecutiveContext standing={standing} intent={intent} askPrimary={waiting.status === "none-waiting"} humanName={humanName} />
      <OperatingSignalStrip cards={signals} />

      <div className="cmd-executive-triad grid min-w-0 grid-cols-1 gap-3.5">
        <NeedsYourDecision state={waiting} />
        <HebyOperatingSurface intent={intent} />
        <GoalsOperatingSurface />
      </div>

      <div className="cmd-operational-row grid min-w-0 grid-cols-1 gap-3.5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-4"><WorkInMotion state={work} className={cn("cmd-support-card h-full p-4", work.status === "empty" && "cmd-priority-empty")} /></div>
        <div className="min-w-0 xl:col-span-5"><CommandLiveMap projection={liveMap} /></div>
        <div className="min-w-0 xl:col-span-3"><ConnectedSystems state={capability} /></div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3.5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-5"><RecordedActivity observation={recordedActs} /></div>
        <div className="min-w-0 xl:col-span-7"><CapabilityLimits /></div>
      </div>
    </div>
  );
}
