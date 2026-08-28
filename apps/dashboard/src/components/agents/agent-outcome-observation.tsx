import {
  AGENT_OUTCOME_NON_CLAIMS,
  AGENT_OUTCOME_STAGES,
  AGENT_OUTCOME_STAGE_MEANING,
  AGENT_OUTCOME_WORDING,
  PROVENANCE_COVERAGE_WORDING,
  type AgentOutcomeStage,
} from "@/features/agent-outcome-observation/contracts";
import type {
  AgentOutcomeObservation,
  AgentOutcomeObservationRead,
} from "@/features/agent-outcome-observation/agent-outcome-projection.server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/*
 * Agent Outcome Observation (SELF-IMPROVING-AGENTS-1) — what became of what each durable agent
 * proposed.
 *
 * ── WHY THIS IS A SERVER COMPONENT WITH NO STATE ─────────────────────────────
 *
 * There is no `"use client"` directive, no hook, no handler and no imported server action. That is
 * the guarantee rather than a style choice: a component with no client boundary and no action
 * import has no representation in which a control could be added by accident. The absence of a
 * "tune this agent" button here is STRUCTURAL — there is nothing for one to call.
 *
 * Its sibling `durable-agent-identity-card.tsx` is a client component precisely because it DOES
 * offer a consequential ceremony. Keeping the observing surface on the other side of that line
 * means the two cannot be confused, by a reader or by a later edit.
 *
 * ── THE SEVEN STAGES ARE RENDERED AS SEVEN ───────────────────────────────────
 *
 * PROPOSED, AUTHORIZED, PERMITTED, EXECUTED, ACCEPTED, FAILED and UNKNOWN each get their own
 * number under their own heading, and the ladder at the top says what each one does NOT mean. A
 * single "12 actions completed" would be the whole defect this phase exists to avoid: it would
 * quietly equate an approval with an act and an acceptance with an arrival.
 *
 * ── IT OBSERVES ──────────────────────────────────────────────────────────────
 *
 * No score, no rate, no ranking, no trend, no recommendation, no configuration. Every figure is a
 * count of rows a released authority wrote, and where a record is missing the surface says the
 * record is missing rather than filling it in.
 */

function Figure({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div
      className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 ${
        tone === "warn" ? "border-danger/40 bg-danger/10" : "border-border bg-surface"
      }`}
    >
      <span
        className={`text-lg font-semibold tabular-nums ${
          tone === "warn" ? "text-danger" : "text-fg"
        }`}
      >
        {value}
      </span>
      <span className="text-[0.65rem] uppercase tracking-wider text-fg-muted">{label}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">{title}</h4>
      {children}
    </section>
  );
}

/** The ladder, stated once for the whole surface. Seven stages, seven refusals. */
function StageLadder() {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
        What each stage means
      </h4>
      <ul className="flex flex-col gap-1.5">
        {AGENT_OUTCOME_STAGES.map((stage: AgentOutcomeStage) => (
          <li key={stage} className="text-xs leading-5 text-fg-secondary">
            <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-fg">
              {stage}
            </span>{" "}
            {AGENT_OUTCOME_STAGE_MEANING[stage].means}{" "}
            <span className="text-fg-muted">{AGENT_OUTCOME_STAGE_MEANING[stage].doesNotMean}</span>
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-1 border-t border-border pt-2">
        {AGENT_OUTCOME_NON_CLAIMS.map((claim) => (
          <li key={claim} className="text-[0.65rem] leading-5 text-fg-muted">
            {claim}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AgentBlock({ agent }: { agent: AgentOutcomeObservation }) {
  const nothingYet = agent.activity.proposalsFiled === 0;

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <header className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-fg">{agent.agentName}</h3>
        <span className="text-[0.65rem] uppercase tracking-wider text-fg-muted">
          {agent.inService ? "in service" : "retired"}
        </span>
        <span className="text-[0.65rem] text-fg-muted">
          established {new Date(agent.establishedAt).toLocaleString()}
        </span>
      </header>

      {!agent.inService ? (
        <p className="text-xs leading-5 text-fg-muted">{AGENT_OUTCOME_WORDING.retired}</p>
      ) : null}

      {nothingYet ? (
        <p className="text-xs leading-5 text-fg-secondary">{AGENT_OUTCOME_WORDING.zeroActivity}</p>
      ) : null}

      <Section title={AGENT_OUTCOME_WORDING.activityTitle}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Figure label="Proposed" value={agent.activity.proposalsFiled} />
          <Figure label="Pending decision" value={agent.activity.pending} />
          <Figure label="Withdrawn" value={agent.activity.withdrawn} />
        </div>
      </Section>

      <Section title={AGENT_OUTCOME_WORDING.governanceTitle}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Figure label="Authorized" value={agent.governance.approved} />
          <Figure label="Rejected" value={agent.governance.rejected} />
          <Figure label="Permitted" value={agent.governance.permitsIssued} />
          <Figure label="Permit active" value={agent.governance.permitsActive} />
          <Figure label="Permit expired" value={agent.governance.permitsExpired} />
          <Figure label="Permit consumed" value={agent.governance.permitsConsumed} />
          <Figure label="Permit revoked" value={agent.governance.permitsRevoked} />
          <Figure
            label="Authorized, never executed"
            value={agent.governance.approvedWithoutExecution}
          />
        </div>
      </Section>

      <Section title={AGENT_OUTCOME_WORDING.executionTitle}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Figure label="Executed" value={agent.execution.attempts} />
          <Figure label="Accepted" value={agent.execution.accepted} />
          <Figure label="Failed" value={agent.execution.failed} />
          <Figure label="Unknown" value={agent.execution.unknown} tone="warn" />
          <Figure label="Refused" value={agent.execution.refused} />
          <Figure label="No outcome recorded" value={agent.execution.pending} tone="warn" />
        </div>
        <p className="text-[0.65rem] leading-5 text-fg-muted">
          {AGENT_OUTCOME_STAGE_MEANING.UNKNOWN.means}{" "}
          {AGENT_OUTCOME_STAGE_MEANING.UNKNOWN.doesNotMean}
        </p>
      </Section>

      <Section title={AGENT_OUTCOME_WORDING.modelUsageTitle}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Figure label="Linked invocations" value={agent.modelUsage.linkedInvocations} />
          <Figure label="Input tokens" value={agent.modelUsage.inputTokens} />
          <Figure label="Output tokens" value={agent.modelUsage.outputTokens} />
          <Figure
            label="No usage reported"
            value={agent.modelUsage.invocationsWithoutReportedUsage}
          />
        </div>
        {agent.modelUsage.distribution.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {agent.modelUsage.distribution.map((bucket) => (
              <li
                key={`${bucket.provider ?? "-"}/${bucket.model ?? "-"}`}
                className="text-xs text-fg-secondary"
              >
                <span className="font-mono text-[0.65rem]">
                  {bucket.provider ?? "provider not reported"} ·{" "}
                  {bucket.model ?? "model not reported"}
                </span>{" "}
                <span className="tabular-nums text-fg-muted">{bucket.invocations}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-[0.65rem] leading-5 text-fg-muted">
          {AGENT_OUTCOME_WORDING.tokensAreLowerBound}
        </p>
        <p className="text-[0.65rem] leading-5 text-fg-muted">
          {AGENT_OUTCOME_WORDING.invocationsAreLinkedOnly}
        </p>
      </Section>

      <Section title={AGENT_OUTCOME_WORDING.provenanceTitle}>
        <div className="grid grid-cols-2 gap-2">
          <Figure label="Transport proven" value={agent.provenance.proposalsWithInvocation} />
          <Figure
            label="Transport not durably proven"
            value={agent.provenance.proposalsWithoutInvocation}
          />
        </div>
        {agent.provenance.proposalsWithoutInvocation > 0 ? (
          <>
            <p className="text-[0.65rem] leading-5 text-fg-muted">
              {PROVENANCE_COVERAGE_WORDING.unprovenIsNotAbsence}
            </p>
            <p className="text-[0.65rem] leading-5 text-fg-muted">
              {PROVENANCE_COVERAGE_WORDING.neverBackfilled}
            </p>
          </>
        ) : null}
      </Section>
    </article>
  );
}

export function AgentOutcomeObservationSurface({
  observation,
}: {
  readonly observation: AgentOutcomeObservationRead;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{AGENT_OUTCOME_WORDING.regionTitle}</CardTitle>
        <CardDescription>{AGENT_OUTCOME_WORDING.regionSummary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {observation.status !== "read" ? (
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3">
            <p className="text-sm text-fg">{AGENT_OUTCOME_WORDING.unavailable}</p>
            <p className="text-xs leading-5 text-fg-muted">
              {AGENT_OUTCOME_WORDING.unavailableIsNotEmpty}
            </p>
            <p className="font-mono text-[0.65rem] text-fg-muted">{observation.reason}</p>
          </div>
        ) : (
          <>
            <StageLadder />

            {observation.agents.length === 0 ? (
              <p className="text-xs leading-5 text-fg-secondary">
                {AGENT_OUTCOME_WORDING.noAgents}
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {observation.agents.map((agent) => (
                  <AgentBlock key={`${agent.agentName}-${agent.establishedAt}`} agent={agent} />
                ))}
              </div>
            )}

            <section className="flex flex-col gap-1 border-t border-border pt-3">
              <p className="text-[0.65rem] leading-5 text-fg-muted">
                {AGENT_OUTCOME_WORDING.unattributedInvocations}{" "}
                <span className="tabular-nums text-fg-secondary">
                  {observation.unattributedInvocations}
                </span>
              </p>
              {observation.unresolvedAgentProposals > 0 ? (
                <p className="text-[0.65rem] leading-5 text-fg-muted">
                  {AGENT_OUTCOME_WORDING.unresolvedActivity}{" "}
                  <span className="tabular-nums text-fg-secondary">
                    {observation.unresolvedAgentProposals}
                  </span>
                </p>
              ) : null}
              {observation.distributionTruncated ? (
                <p className="text-[0.65rem] leading-5 text-fg-muted">
                  {AGENT_OUTCOME_WORDING.distributionTruncated}
                </p>
              ) : null}
              <p className="text-[0.65rem] leading-5 text-fg-muted">
                {AGENT_OUTCOME_WORDING.noControls}
              </p>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
