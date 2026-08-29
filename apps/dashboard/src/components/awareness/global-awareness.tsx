import Link from "next/link";
import { ArrowRight, Map, ShieldCheck } from "lucide-react";

import { ProvenanceChip } from "@/components/ui/provenance-chip";
import type { LiveMapAwareness } from "@/features/live-map/awareness";
import type { SecurityAwareness } from "@/features/security-center/awareness";

/*
 * THE GLOBAL AWARENESS BAND — Live Map Live · Security Live.
 *
 * ── WHAT "LIVE" MEANS HERE, AND WHAT IT DOES NOT ─────────────────────────────
 *
 * Both names are PRODUCT LABELS. Neither panel streams, subscribes, polls or refreshes: each is a
 * server read taken when the page was requested, and both say so in their own words rather than
 * letting the word "Live" imply a runtime nobody built.
 *
 *     LIVE LABEL != REAL-TIME GUARANTEE        REQUEST-TIME READ != REAL-TIME STREAM
 *
 * ── NEITHER PANEL OWNS A FACT ────────────────────────────────────────────────
 *
 * Both take an already-summarised value and render it. There is no read here, no tenant, no handle
 * and no authority — the panels cannot disagree with the surfaces they lead to, because they are
 * looking at the same resolved answer those surfaces were built from.
 *
 *     LIVE MAP LIVE != A SECOND LIVE MAP        SECURITY LIVE != A SECURITY AUTHORITY
 *
 * ── THE STATES ARE RENDERED DIFFERENTLY ON PURPOSE ───────────────────────────
 *
 * "Hebun read this and the answer is zero" and "Hebun could not read this" are two sentences, and a
 * compact panel is exactly where they get collapsed into one number. They are not collapsed here,
 * and no panel ever prints a zero it did not measure.
 *
 *     UNAVAILABLE != EMPTY        UNAVAILABLE != ZERO        ZERO RECORDED ACTS != SECURE
 *
 * Presentational and server-safe. It reads nothing, resolves nothing and grants nothing.
 */

/** One panel's frame: identity, a one-line question, a body, a provenance line and one doorway. */
function AwarenessPanel({
  id,
  title,
  question,
  icon: Icon,
  children,
  provenance,
  provenanceDetail,
  footnote,
  href,
  cta,
}: {
  readonly id: string;
  readonly title: string;
  readonly question: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly children: React.ReactNode;
  readonly provenance: "authoritative" | "derived";
  readonly provenanceDetail: string;
  readonly footnote: string;
  readonly href: string;
  readonly cta: string;
}) {
  const describedBy = `${id}-question`;
  return (
    <section
      id={id}
      aria-label={title}
      aria-describedby={describedBy}
      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm lg:p-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary ring-1 ring-inset ring-primary/15"
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
        <h2 className="min-w-0 text-meta font-semibold uppercase tracking-[0.08em] text-fg-muted">
          {title}
        </h2>
      </div>
      {/* The question is announced, never printed — the heading beside it already says it shorter. */}
      <p id={describedBy} className="sr-only">
        {question}
      </p>

      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ProvenanceChip kind={provenance} detail={provenanceDetail} />
      </div>
      {/*
        THE FRESHNESS SENTENCE SITS WITH THE NUMBERS, not in a legend somewhere else. A panel called
        "Live" that does not say what it is has already made the claim its name implies.
      */}
      <p className="text-meta leading-5 text-fg-muted">{footnote}</p>

      <Link
        href={href}
        className="group mt-auto flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-body font-semibold text-primary transition-colors duration-(--dur-fast) hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        {cta}
        <ArrowRight
          className="size-4 shrink-0 transition-transform duration-(--dur-fast) group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </section>
  );
}

/** The focal line of a panel: a large answer and the clause that keeps it from being read as more. */
function Statement({ headline, detail }: { readonly headline: string; readonly detail: string }) {
  return (
    <>
      <p className="text-title font-semibold leading-tight text-fg text-balance">{headline}</p>
      <p className="text-meta leading-5 text-fg-secondary text-pretty">{detail}</p>
    </>
  );
}

function LiveMapLive({ awareness }: { awareness: LiveMapAwareness }) {
  const { organization, agents, intelligence } = awareness;

  const headline =
    organization.status === "named"
      ? organization.name
      : "Your organization could not be read";

  const agentLine =
    agents.status === "counted"
      ? `${agents.count} durable ${agents.count === 1 ? "agent" : "agents"} on the map.`
      : agents.status === "known-empty"
        ? "The agent authority answered: no durable agent has been established."
        : "Hebun could not read this organization's durable agents — that is a read failure, not an absence of agents.";

  const intelligenceLine =
    intelligence.status === "available"
      ? intelligence.unresolvedAgentProposals === 0
        ? "Agent outcome observation is available for every agent shown."
        : `Agent outcome observation is available. ${intelligence.unresolvedAgentProposals} proposals could not be placed on an agent.`
      : "Agent outcome observation could not be read. It says nothing about what these agents have proposed.";

  return (
    <AwarenessPanel
      id="live-map-live"
      title="Live Map Live"
      question="What shape can Hebun prove this organization to be in?"
      icon={Map}
      provenance={organization.status === "named" ? "authoritative" : "derived"}
      provenanceDetail="composed from the Organization Authority and durable Agent Identity"
      footnote={awareness.freshness}
      href="/live-map"
      cta="Open Live Map"
    >
      <Statement
        headline={headline}
        detail={organization.status === "named" ? agentLine : organization.detail}
      />
      {organization.status === "named" ? (
        <p className="text-meta leading-5 text-fg-muted text-pretty">{intelligenceLine}</p>
      ) : null}
    </AwarenessPanel>
  );
}

function SecurityLive({ awareness }: { awareness: SecurityAwareness }) {
  const { state } = awareness;

  /*
   * THE HEADLINE IS A COUNT OF ACTS, AND IT SAYS THE WORD. Not a posture, not a verdict, and never
   * a reassurance: the ledger records what authorized actors did, so it can no more report that an
   * organization is secure than a visitors' book can report that a building was not burgled.
   */
  const headline =
    state.status === "recorded"
      ? state.totalRecordedActs === null
        ? "Governed acts are recorded"
        : `${state.totalRecordedActs} recorded governed ${state.totalRecordedActs === 1 ? "act" : "acts"}`
      : state.status === "known-empty"
        ? "No governed act has been recorded"
        : "Recorded acts could not be read";

  const detail =
    state.status === "recorded"
      ? "Acts this organization's authorized actors took, as Hebun wrote them down."
      : state.status === "known-empty"
        ? "The ledger was read and holds nothing for this organization. That is a measured zero, and it is not a statement that anything is secure."
        : "Hebun could not read the ledger. This is not an organization with nothing recorded.";

  return (
    <AwarenessPanel
      id="security-live"
      title="Security Live"
      question="What governed activity has this organization actually recorded?"
      icon={ShieldCheck}
      provenance="derived"
      provenanceDetail="a per-request view of the recorded-act ledger, which owns the record"
      footnote={awareness.limits}
      href="/director/governance/security"
      cta="Open Security Center"
    >
      <Statement headline={headline} detail={detail} />
      {state.status === "recorded" && state.truncated ? (
        <p className="text-meta leading-5 text-fg-muted">
          The Security Center shows a bounded page of these, not all of them.
        </p>
      ) : null}
    </AwarenessPanel>
  );
}

export function GlobalAwareness({
  liveMap,
  security,
}: {
  readonly liveMap: LiveMapAwareness;
  readonly security: SecurityAwareness;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
      <LiveMapLive awareness={liveMap} />
      <SecurityLive awareness={security} />
    </div>
  );
}
