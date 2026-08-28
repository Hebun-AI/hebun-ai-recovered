import {
  AGENT_EVALUATION_WORDING,
  EVALUATION_NON_CLAIMS,
  type DerivedMetric,
  type ObservedMetric,
  type UnavailableDimension,
} from "@/features/agent-evaluation/contracts";
import type {
  AgentEvaluation,
  AgentEvaluationRead,
} from "@/features/agent-evaluation/agent-evaluation-projection.server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/*
 * Agent Evaluation (SELF-IMPROVING-AGENTS-2) — what Hebun can truthfully say about each agent.
 *
 * ── WHY THIS IS A SERVER COMPONENT WITH NO STATE ─────────────────────────────
 *
 * No `"use client"`, no hook, no handler, no imported action. An evaluation surface is exactly
 * where a "tune this agent" control would feel natural, so the absence is made STRUCTURAL rather
 * than editorial: with no client boundary and no action import, there is nothing such a control
 * could be wired to.
 *
 * ── THE THREE LISTS ARE RENDERED AS THREE ────────────────────────────────────
 *
 * Observed facts, derived coverage, and dimensions Hebun cannot answer each get their own heading
 * and their own caption. Blending them is the whole failure mode: a derived figure sitting among
 * observed counts reads as a measurement, and an omitted dimension reads as a covered one.
 *
 * ── THERE IS NO PERCENTAGE ANYWHERE ──────────────────────────────────────────
 *
 * A derived metric renders as "3 of 4". The projection carries no quotient and this file computes
 * none, so a grade cannot appear here through an edit that merely forgets a rule.
 */

function Observed({ metric }: { metric: ObservedMetric }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold tabular-nums text-fg">{metric.value}</span>
        <span className="text-xs font-medium text-fg-secondary">{metric.label}</span>
      </div>
      <p className="text-[0.65rem] leading-5 text-fg-muted">
        {metric.means} <span className="text-fg-muted">{metric.doesNotMean}</span>
      </p>
      <p className="font-mono text-[0.6rem] text-fg-muted">{metric.source}</p>
    </li>
  );
}

function Derived({ metric }: { metric: DerivedMetric }) {
  const unavailable = metric.availability.state !== "available";
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        {unavailable ? (
          <span className="text-xs font-medium text-fg-muted">
            {AGENT_EVALUATION_WORDING.noEvidenceYet}
          </span>
        ) : (
          <span className="text-base font-semibold tabular-nums text-fg">
            {metric.numerator} of {metric.denominator}
          </span>
        )}
        <span className="text-xs font-medium text-fg-secondary">{metric.label}</span>
        <span className="rounded border border-border px-1 text-[0.55rem] uppercase tracking-wider text-fg-muted">
          derived
        </span>
      </div>
      <p className="text-[0.65rem] leading-5 text-fg-muted">{metric.definition}</p>
      <p className="text-[0.65rem] leading-5 text-fg-muted">
        {metric.means} <span className="text-fg-muted">{metric.doesNotMean}</span>
      </p>
      <p className="font-mono text-[0.6rem] text-fg-muted">{metric.source}</p>
    </li>
  );
}

function Unavailable({ dimension }: { dimension: UnavailableDimension }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-dashed border-border p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-xs font-medium text-fg-secondary">{dimension.label}</span>
        <span className="rounded border border-border px-1 text-[0.55rem] uppercase tracking-wider text-fg-muted">
          {dimension.reason}
        </span>
      </div>
      <p className="text-[0.65rem] leading-5 text-fg-muted">{dimension.explanation}</p>
    </li>
  );
}

function Group({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">{title}</h4>
        <p className="text-[0.65rem] leading-5 text-fg-muted">{caption}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">{children}</ul>
    </section>
  );
}

function AgentBlock({ agent }: { agent: AgentEvaluation }) {
  return (
    <article className="flex flex-col gap-5 rounded-xl border border-border p-4">
      <header className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-fg">{agent.agentName}</h3>
        <span className="text-[0.65rem] uppercase tracking-wider text-fg-muted">
          {agent.inService ? "in service" : "retired"}
        </span>
      </header>

      {agent.hasNoEvidence ? (
        <p className="text-xs leading-5 text-fg-secondary">{AGENT_EVALUATION_WORDING.zeroActivity}</p>
      ) : null}

      <Group
        title={AGENT_EVALUATION_WORDING.observedTitle}
        caption={AGENT_EVALUATION_WORDING.observedCaption}
      >
        {agent.observed.map((metric) => (
          <Observed key={metric.key} metric={metric} />
        ))}
      </Group>

      <Group
        title={AGENT_EVALUATION_WORDING.derivedTitle}
        caption={AGENT_EVALUATION_WORDING.derivedCaption}
      >
        {agent.derived.map((metric) => (
          <Derived key={metric.key} metric={metric} />
        ))}
      </Group>

      <Group
        title={AGENT_EVALUATION_WORDING.unavailableTitle}
        caption={AGENT_EVALUATION_WORDING.unavailableCaption}
      >
        {agent.unavailable.map((dimension) => (
          <Unavailable key={dimension.key} dimension={dimension} />
        ))}
      </Group>
    </article>
  );
}

export function AgentEvaluationSurface({
  evaluation,
}: {
  readonly evaluation: AgentEvaluationRead;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{AGENT_EVALUATION_WORDING.regionTitle}</CardTitle>
        <CardDescription>{AGENT_EVALUATION_WORDING.regionSummary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {evaluation.status !== "read" ? (
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3">
            <p className="text-sm text-fg">{AGENT_EVALUATION_WORDING.unavailable}</p>
            <p className="text-xs leading-5 text-fg-muted">
              {AGENT_EVALUATION_WORDING.unavailableIsNotEmpty}
            </p>
            <p className="font-mono text-[0.65rem] text-fg-muted">{evaluation.reason}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-muted p-3">
              <p className="text-xs leading-5 text-fg-secondary">
                {AGENT_EVALUATION_WORDING.coverageNotQuality}
              </p>
              <p className="text-xs leading-5 text-fg-secondary">
                {AGENT_EVALUATION_WORDING.noScore}
              </p>
            </div>

            {evaluation.agents.length === 0 ? (
              <p className="text-xs leading-5 text-fg-secondary">
                {AGENT_EVALUATION_WORDING.noAgents}
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {evaluation.agents.map((agent) => (
                  <AgentBlock key={agent.agentName} agent={agent} />
                ))}
              </div>
            )}

            <section className="flex flex-col gap-1 border-t border-border pt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
                {AGENT_EVALUATION_WORDING.limitationsTitle}
              </h4>
              <ul className="flex flex-col gap-1">
                {EVALUATION_NON_CLAIMS.map((claim) => (
                  <li key={claim} className="text-[0.65rem] leading-5 text-fg-muted">
                    {claim}
                  </li>
                ))}
              </ul>
              <p className="text-[0.65rem] leading-5 text-fg-muted">
                {AGENT_EVALUATION_WORDING.noControls}
              </p>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
