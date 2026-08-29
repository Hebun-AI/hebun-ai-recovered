import {
  EVIDENCE_MEANING,
  HYPOTHESIS_LIMITATIONS,
  IMPROVEMENT_HYPOTHESIS_WORDING,
} from "@/features/agent-improvement-hypothesis/contracts";
import type {
  ImprovementHypothesisRead,
  ImprovementHypothesisView,
} from "@/features/agent-improvement-hypothesis/read-improvement-hypotheses.server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/*
 * Improvement Hypotheses (SELF-IMPROVING-AGENTS-3) — evidence-backed questions put to Governance.
 *
 * ── WHY THIS IS A SERVER COMPONENT WITH NO STATE, LIKE THE TWO ABOVE IT ──────
 *
 * No `"use client"`, no hook, no handler, and NO IMPORTED ACTION. This is the surface where an
 * "Apply" button would feel most natural — it is showing a human an approved change proposal — so
 * its absence is STRUCTURAL rather than editorial: with no client boundary and nothing imported
 * that could mutate, there is nothing such a control could be wired to.
 *
 * The writer and the Governance seam both exist as server functions. Neither is reachable from
 * this file, and no route imports them.
 *
 * ── THE FOUR SECTIONS ARE RENDERED AS FOUR ───────────────────────────────────
 *
 *   OBSERVED EVIDENCE     what an authoritative record said, at a stated instant
 *   DERIVED EVALUATION    what SIA-2 made of it
 *   IMPROVEMENT HYPOTHESIS  a candidate change — a question, not a finding
 *   GOVERNANCE DECISION   what a human decided, held in the Governance ledger
 *
 * They are four different kinds of claim and they are never blended. A candidate change sitting
 * among observed counts reads as a plan; a decision rendered next to a hypothesis without its own
 * heading reads as though the decision were a property of the proposal.
 *
 * ── AND APPROVAL IS NEVER RENDERED AS APPLICATION ────────────────────────────
 *
 * An accepted hypothesis says so, and says in the same breath that nothing was applied. That
 * sentence is not decoration: "Governance approved" is exactly the phrase a reader completes for
 * themselves as "so it was done".
 */

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
        {label}
      </span>
      <span className="text-xs leading-5 text-fg">{value}</span>
    </div>
  );
}

function Section({
  title,
  caption,
  children,
}: {
  readonly title: string;
  readonly caption: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <h5 className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-secondary">
        {title}
      </h5>
      <p className="text-[0.6rem] leading-4 text-fg-muted">{caption}</p>
      {children}
    </section>
  );
}

function HypothesisBlock({ hypothesis }: { hypothesis: ImprovementHypothesisView }) {
  const { decision } = hypothesis;
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <header className="flex flex-wrap items-baseline gap-2">
        <h4 className="text-sm font-semibold text-fg">{hypothesis.agentName}</h4>
        <span className="text-[0.65rem] text-fg-muted">{hypothesis.improvementTarget}</span>
        {!hypothesis.inService ? (
          <span className="text-[0.65rem] text-fg-muted">· withdrawn from service</span>
        ) : null}
      </header>

      {/* ── 1. OBSERVED EVIDENCE ── */}
      <Section
        title={IMPROVEMENT_HYPOTHESIS_WORDING.evidenceTitle}
        caption={IMPROVEMENT_HYPOTHESIS_WORDING.evidenceCaption}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            {/*
             * RENDERED AS "n of d", NEVER DIVIDED. The read model carries no quotient and this file
             * computes none, so a rate cannot appear here through an edit that merely forgets a rule.
             */}
            <span className="text-base font-semibold tabular-nums text-fg">
              {hypothesis.evidenceObservedValue} of {hypothesis.evidenceObservedTotal}
            </span>
            <span className="text-xs font-medium text-fg-secondary">
              {hypothesis.evidenceFindingKey}
            </span>
          </div>
          <p className="text-[0.65rem] leading-5 text-fg-muted">
            {EVIDENCE_MEANING[hypothesis.evidenceFindingKey]}
          </p>
          <p className="font-mono text-[0.6rem] text-fg-muted">{hypothesis.evidenceSource}</p>
          {/* The instant, always beside the numbers. A snapshot without its time reads as "now". */}
          <p className="font-mono text-[0.6rem] text-fg-muted">
            observed at {hypothesis.evidenceObservedAt}
          </p>
        </div>
      </Section>

      {/* ── 2. DERIVED EVALUATION ── */}
      <Section
        title={IMPROVEMENT_HYPOTHESIS_WORDING.evaluationTitle}
        caption={IMPROVEMENT_HYPOTHESIS_WORDING.evaluationCaption}
      >
        <p className="text-xs leading-5 text-fg-secondary">
          {EVIDENCE_MEANING[hypothesis.evidenceFindingKey]}
        </p>
      </Section>

      {/* ── 3. IMPROVEMENT HYPOTHESIS ── */}
      <Section
        title={IMPROVEMENT_HYPOTHESIS_WORDING.hypothesisTitle}
        caption={IMPROVEMENT_HYPOTHESIS_WORDING.hypothesisCaption}
      >
        <div className="flex flex-col gap-2">
          <Row label="Candidate change" value={hypothesis.candidateChange} />
          <Row label="Expected effect" value={hypothesis.expectedEffect} />
          {/* Stated as prominently as the proposal itself, because it bounds it. */}
          <Row label="What this does not know" value={hypothesis.limitations} />
          {hypothesis.supersedesHypothesisId ? (
            <p className="font-mono text-[0.6rem] text-fg-muted">
              supersedes {hypothesis.supersedesHypothesisId}
            </p>
          ) : null}
          {hypothesis.supersededByCount > 0 ? (
            <p className="text-[0.65rem] leading-5 text-fg-muted">
              {IMPROVEMENT_HYPOTHESIS_WORDING.supersededBy}{" "}
              {IMPROVEMENT_HYPOTHESIS_WORDING.supersessionIsNotWithdrawal}
            </p>
          ) : null}
        </div>
      </Section>

      {/* ── 4. GOVERNANCE DECISION ── */}
      <Section
        title={IMPROVEMENT_HYPOTHESIS_WORDING.decisionTitle}
        caption={IMPROVEMENT_HYPOTHESIS_WORDING.decisionCaption}
      >
        {decision.status === "undecided" ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs leading-5 text-fg">{IMPROVEMENT_HYPOTHESIS_WORDING.undecided}</p>
            {/* An absence is never rendered as a result. */}
            <p className="text-[0.65rem] leading-5 text-fg-muted">
              {IMPROVEMENT_HYPOTHESIS_WORDING.undecidedIsNotRejected}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-xs leading-5 text-fg">
              <span className="font-mono text-[0.65rem]">{decision.outcome}</span>
              {decision.decidedAt ? (
                <span className="text-fg-muted"> · {decision.decidedAt}</span>
              ) : null}
            </p>
            <p className="text-[0.65rem] leading-5 text-fg-muted">{decision.justification}</p>
            {/*
             * SAID EXACTLY WHERE IT IS NEEDED. An accepted decision is the one place a reader
             * completes the sentence themselves, so the correction sits inside the acceptance
             * rather than in a footnote further down the page.
             */}
            {decision.accepted ? (
              <p className="text-[0.65rem] leading-5 text-fg-secondary">
                {IMPROVEMENT_HYPOTHESIS_WORDING.approvalIsNotApplication}
              </p>
            ) : null}
          </div>
        )}
      </Section>
    </article>
  );
}

export function AgentImprovementHypothesisSurface({
  hypotheses,
}: {
  readonly hypotheses: ImprovementHypothesisRead;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{IMPROVEMENT_HYPOTHESIS_WORDING.regionTitle}</CardTitle>
        <CardDescription>{IMPROVEMENT_HYPOTHESIS_WORDING.regionSummary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {hypotheses.status !== "read" ? (
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3">
            <p className="text-sm text-fg">{IMPROVEMENT_HYPOTHESIS_WORDING.unavailable}</p>
            {/* An unreadable list is not an empty one, and never renders as one. */}
            <p className="text-xs leading-5 text-fg-muted">
              {IMPROVEMENT_HYPOTHESIS_WORDING.unavailableIsNotEmpty}
            </p>
            <p className="font-mono text-[0.65rem] text-fg-muted">{hypotheses.reason}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-muted p-3">
              <p className="text-xs leading-5 text-fg-secondary">
                {IMPROVEMENT_HYPOTHESIS_WORDING.hypothesisIsNotImprovement}
              </p>
              <p className="text-xs leading-5 text-fg-secondary">
                {IMPROVEMENT_HYPOTHESIS_WORDING.noApplyControl}
              </p>
            </div>

            {hypotheses.hypotheses.length === 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs leading-5 text-fg-secondary">
                  {IMPROVEMENT_HYPOTHESIS_WORDING.none}
                </p>
                <p className="text-[0.65rem] leading-5 text-fg-muted">
                  {IMPROVEMENT_HYPOTHESIS_WORDING.noneIsNotNothingToImprove}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {hypotheses.hypotheses.map((hypothesis) => (
                  <HypothesisBlock key={hypothesis.hypothesisId} hypothesis={hypothesis} />
                ))}
              </div>
            )}

            {/* A bounded list whose bound is not reported reads as a complete one. */}
            {hypotheses.truncated ? (
              <p className="text-[0.65rem] leading-5 text-fg-muted">
                More hypotheses exist than are shown. This list is bounded at{" "}
                <span className="tabular-nums">{hypotheses.limit}</span>, newest first, and a
                bounded list is not the whole record.
              </p>
            ) : null}

            <section className="flex flex-col gap-1 border-t border-border pt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
                What a hypothesis cannot tell you
              </h4>
              <ul className="flex flex-col gap-1">
                {HYPOTHESIS_LIMITATIONS.map((limitation) => (
                  <li key={limitation.key} className="text-[0.65rem] leading-5 text-fg-muted">
                    <span className="font-medium text-fg-secondary">{limitation.label}:</span>{" "}
                    {limitation.explanation}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
