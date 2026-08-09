/*
 * policies-rules-surface.tsx — read-only Policies & Rules inspection (Hebun UI Phase 23B).
 *
 * Surfaces the REAL policy engine — the deterministic evaluation pipeline and the policy/rule
 * definitions — with an unmistakable DERIVED · SEEDED INPUT provenance. It renders NO fabricated
 * compliance/risk/audit score, NO policy count presented as truth, NO governance-result outcome,
 * and NO create / edit / enable / approve / reject / enforce control. Policy evaluation is not
 * authorization, execution, or human approval.
 *
 * Server component — no client state, no mutation affordance.
 */

import { GitBranch, ListOrdered, ScrollText, ShieldOff, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPoliciesRulesModel } from "@/features/governance-policies";

export function PoliciesRulesSurface() {
  const model = getPoliciesRulesModel();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* Engine provenance banner — DERIVED · SEEDED INPUT */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-sunken">
            <Workflow className="size-4 text-fg-secondary" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-fg">{model.engine.headline}</h2>
              <Badge variant="warning">DERIVED · SEEDED INPUT</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-fg-secondary">{model.engine.detail}</p>
          </div>
        </CardContent>
      </Card>

      {/* Evaluation pipeline — real structural machinery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="size-4 text-fg-muted" aria-hidden="true" />
            Evaluation pipeline
          </CardTitle>
          <span className="text-xs text-fg-muted">The real deterministic governance evaluation steps. Structure, not live results.</span>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-2">
            {model.pipeline.map((step, index) => (
              <li key={step.id} className="flex items-start gap-3 rounded-md border border-border bg-surface-sunken p-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[0.7rem] font-semibold tabular-nums text-fg-muted">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg">{step.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-fg-muted">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Policy & rule definitions — derived from seeded input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="size-4 text-fg-muted" aria-hidden="true" />
            Policy &amp; rule definitions
          </CardTitle>
          <span className="text-xs text-fg-muted">Structural definitions from the real registry, derived from seeded input — not live organizational policy.</span>
        </CardHeader>
        <CardContent>
          <div className="ui-table-wrap">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-fg-muted">
                  <th className="px-3 py-2 font-medium">Policy / rule</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Applies to</th>
                  <th className="px-3 py-2 font-medium">Approval path</th>
                  <th className="px-3 py-2 font-medium">Review</th>
                </tr>
              </thead>
              <tbody>
                {model.rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-border/60 align-top last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-fg">{rule.name}</span>
                        <span className="text-[0.7rem] leading-4 text-fg-muted">{rule.description}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2"><Badge variant="neutral">{rule.category}</Badge></td>
                    <td className="px-3 py-2 text-xs text-fg-secondary">{rule.owner}</td>
                    <td className="px-3 py-2 text-[0.7rem] text-fg-muted">{rule.appliesTo.join(", ")}</td>
                    <td className="px-3 py-2 text-xs text-fg-secondary">{rule.approvalMode}</td>
                    <td className="px-3 py-2">
                      <Badge variant={rule.reviewRequired ? "warning" : "neutral"}>{rule.reviewRequired ? "required" : "none"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[0.7rem] text-fg-muted">
            Approval path describes what a decision under this rule would require — it is never executed here; human approval belongs to Decisions.
          </p>
        </CardContent>
      </Card>

      {/* Provenance + boundaries */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Provenance</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {model.provenance.map((line) => (
                <li key={line} className="flex items-start gap-2 text-xs leading-5 text-fg-muted">
                  <GitBranch className="mt-0.5 size-3 shrink-0 text-fg-muted" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Boundaries</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {model.boundaries.map((line) => (
                <li key={line} className="flex items-start gap-2 text-xs leading-5 text-fg-muted">
                  <ShieldOff className="mt-0.5 size-3 shrink-0 text-fg-muted" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Policies &amp; Rules is read-only. It inspects the policy engine and its provenance; it never creates, edits, enables, approves, enforces, or executes a policy.
      </p>
    </div>
  );
}
