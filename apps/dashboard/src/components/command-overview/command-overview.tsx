import Link from "next/link";
import { ArrowRight, ChevronRight, CircleCheck, Lock, Scale, Sparkles, UsersRound } from "lucide-react";

import { CommandRegion, OperatingStatement, QuietLink } from "@/components/command-overview/region";
import { CardHeading, COMMAND_CARD, HIDE_REGION_HEADING } from "@/components/command-overview/command-surface";
import { cn } from "@/lib/utils";
import { ExecutiveContext } from "@/components/command-overview/executive-hero";
import { CommandLiveMap, ConnectedSystems, RecordedActivity, TruthBasis } from "@/components/command-overview/command-rail";
import { WorkInMotion } from "@/components/command-work/work-in-motion";
import {
  PENDING_READ_BOUND,
  UNCONNECTED_CAPABILITIES,
  toCommandStanding,
  type ConnectedCapabilityState,
  type ExpressIntentSummary,
  type WaitingOnYouState,
  type WorkInMotionState,
} from "@/features/command-overview/workspace-model";
import type { LiveMapAwareness } from "@/features/live-map/awareness";
import type { LiveMapProjection } from "@/features/live-map/contracts";
import type { SecurityRecordedActObservation } from "@/features/security-center/contracts";
import type { SecurityAwareness } from "@/features/security-center/awareness";

/*
 * COMMAND (command-final) — the operating model, drawn as a dashboard rather than a diagram:
 *
 *     People + Heby prepare  →  Governance holds the decision  →  Work moves
 *
 * Every number on this page comes from the seam the route already read, in its own state shape.
 * Nothing here writes, authorizes or executes; every consequential step is a link to its owner.
 */

function Bridge() {
  return (
    <span className="cmd-bridge hidden size-7 items-center justify-center rounded-full border border-border bg-surface text-fg-muted shadow-sm xl:flex" aria-hidden="true">
      <ArrowRight className="size-3.5" />
    </span>
  );
}

function initialsOf(name: string | null | undefined): string {
  const parts = name?.trim().split(/\s+/u).filter(Boolean) ?? [];
  if (parts.length === 0) return "";
  return parts.slice(0, 2).map((part) => part[0]!.toLocaleUpperCase("tr-TR")).join("");
}

function PeopleAndHeby({ intent, humanName }: { readonly intent: ExpressIntentSummary; readonly humanName?: string | null }) {
  const initials = initialsOf(humanName);
  return (
    <CommandRegion
      id="people-heby"
      title="People + Heby"
      question="Who prepares work in this organization, and what can Heby do?"
      provenance="configuration"
      provenanceDetail="Heby's figures are counted from the declared action registry. The person is you, from your authenticated session."
      readState="available"
      provenanceNonClaims="that a declared capability is invokable, authorized, executed, or successful"
      weight="bare"
      className={cn(COMMAND_CARD, HIDE_REGION_HEADING, "h-full")}
    >
      <CardHeading icon={UsersRound} tone="heby" title="People + Heby" subtitle="who prepares work here" />
      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface-sunken/60 p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-meta font-bold text-on-primary" aria-hidden="true">
          {initials || <UsersRound className="size-4" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-meta font-bold text-fg">{humanName ?? "You"}</p>
          <p className="truncate text-label text-fg-secondary">Decides proposals · declares work</p>
        </div>
      </div>
      <div className="flex min-w-0 gap-3 rounded-2xl border border-border bg-surface-sunken/60 p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-highlight text-on-primary" aria-hidden="true">
          <Sparkles className="size-[1.125rem]" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2 text-meta font-bold text-fg">
            Heby <span className="rounded-full bg-highlight/10 px-2 py-0.5 text-label font-semibold text-highlight">AI agent</span>
          </p>
          <p className="text-label text-fg-secondary">Prepares proposals for you</p>
          <p className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-label text-fg-secondary">
            <span className="text-title font-bold leading-none tabular-nums text-fg">{intent.declared}</span> declared
            <span className="text-fg-muted">·</span>
            <span className="text-title font-bold leading-none tabular-nums text-fg">{intent.invokableNow}</span> can run now
          </p>
          <p className="mt-1 text-label text-fg-muted">Authorized in Decisions</p>
          <p className="text-label text-fg-muted">Execution not observed here</p>
        </div>
      </div>
      <Bridge />
    </CommandRegion>
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
      weight="bare"
      className={cn(COMMAND_CARD, HIDE_REGION_HEADING, "h-full", state.status === "waiting" && "cmd-card-attention")}
    >
      <CardHeading
        icon={Scale}
        tone="attention"
        title={"Needs your decision"}
        subtitle="Governance holds these until you decide"
        aside={state.status === "waiting" ? (
          <span className="text-label text-fg-muted">{shown.length} shown{state.awaitingCount !== null ? ` · ${state.awaitingCount} awaiting` : ""}</span>
        ) : state.status === "none-waiting" ? (
          <span className="text-label text-fg-muted">0 waiting</span>
        ) : null}
      />

      {state.status === "unavailable" ? (
        <OperatingStatement tone="unavailable" compact title="Decision queue unavailable" detail="Hebun could not read it, so it does not know whether anything is waiting." reason={state.reason} />
      ) : state.status === "none-waiting" ? (
        <div data-state-tone="empty" className="cmd-decision-ready flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-success-subtle/40 p-4">
          <CircleCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-meta font-bold text-fg">Nothing needs your decision</span>
            <span className="block text-label text-fg-secondary">The queue answered and nothing is waiting.</span>
          </span>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 items-end gap-4">
            <span className="text-display-lg font-bold leading-[0.85] tracking-tight tabular-nums text-warning">
              {state.awaitingCount ?? `${shown.length}${state.boundReached ? "+" : ""}`}
            </span>
            <span className="min-w-0 text-meta leading-5 text-fg-secondary">
              {state.awaitingCount === null ? "shown · the full count could not be read" : state.awaitingCount === 1 ? "proposal held by governance" : "proposals held by governance"}
              {state.oldestWaiting ? <><br /><span className="font-bold text-warning">Oldest waiting {state.oldestWaiting.label}</span></> : null}
            </span>
          </div>
          <ul className="min-w-0 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {shown.map((item) => (
              <li key={item.requestId} className="flex min-w-0 items-center gap-3 px-4 py-3">
                <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-meta font-semibold text-fg">{item.actionKind}</span>
                  <span className="block truncate text-label text-fg-muted">{item.targetLabel ? `${item.targetLabel} · ` : ""}{item.expectedEffect}{item.waitingFor ? ` · Waiting ${item.waitingFor.label}` : ""}</span>
                </span>
                <span className="shrink-0 rounded-full bg-warning-subtle px-2.5 py-1 text-label font-bold text-warning">Awaiting you</span>
              </li>
            ))}
          </ul>
          {state.boundReached ? <p className="text-label text-fg-muted">Showing {shown.length} from the most recent {PENDING_READ_BOUND}; more are waiting in Decisions.</p> : null}
        </>
      )}

      <div className="mt-auto flex min-w-0 flex-wrap items-center justify-between gap-3">
        {state.status === "none-waiting" ? (
          <QuietLink href="/approvals">Open Decisions</QuietLink>
        ) : (
          <Link href="/approvals" className="group inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-meta font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring">
            {state.status === "waiting" ? "Review Decisions" : "Open Decisions"}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        )}
        {state.status === "waiting" ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-label text-fg-secondary">
            <Lock className="size-3.5 text-warning" aria-hidden="true" /> Held until you decide
          </span>
        ) : null}
      </div>
      <Bridge />
    </CommandRegion>
  );
}

/**
 * CAPABILITY LIMITS — kept whole, made quiet. Every unconnected capability keeps its name and its own
 * reason, one native disclosure away, inside the page's truth basis. Closed, it states the count in
 * words; it never renders a zero for a source that does not exist.
 */
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
      className={cn(HIDE_REGION_HEADING, "gap-1")}
      bodyClassName="gap-1"
    >
      <details className="group min-w-0">
        <summary className="flex min-w-0 cursor-pointer list-none items-start gap-2 rounded-md text-label text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring [&::-webkit-details-marker]:hidden">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full ring-[1.5px] ring-fg-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-fg-muted"><span className="font-semibold text-fg-secondary">Unknown</span> · goals, execution outcomes · {UNCONNECTED_CAPABILITIES.length} not connected</span>
          <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-fg-muted transition-transform group-open:rotate-90" aria-hidden="true" />
        </summary>
        <ul className="mt-2 grid min-w-0 grid-cols-1 gap-1.5">
          {UNCONNECTED_CAPABILITIES.map((row) => (
            <li key={row.capability} className="min-w-0">
              <p className="text-label font-semibold text-fg">{row.capability}</p>
              <p className="text-label leading-4 text-fg-muted">{row.reason}</p>
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

  return (
    <div data-command-v3="" className="flex min-w-0 flex-col gap-4">
      <ExecutiveContext standing={standing} intent={intent} waiting={waiting} askPrimary={waiting.status === "none-waiting"} humanName={humanName} />

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)_minmax(0,1fr)]">
        <PeopleAndHeby intent={intent} humanName={humanName} />
        <NeedsYourDecision state={waiting} />
        <WorkInMotion state={work} className={cn(COMMAND_CARD, "h-full md:col-span-2 xl:col-span-1")} />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 md:col-span-2 xl:col-span-1"><CommandLiveMap projection={liveMap} /></div>
        <ConnectedSystems state={capability} />
        <div className={cn(COMMAND_CARD, "cmd-ledger-card flex h-full flex-col gap-3")}>
          <RecordedActivity observation={recordedActs} />
          <div className="mt-auto flex min-w-0 flex-col gap-1">
            <TruthBasis observation={recordedActs} work={work} capability={capability} waiting={waiting} liveMap={liveMap} />
            <CapabilityLimits />
          </div>
        </div>
      </div>
    </div>
  );
}
