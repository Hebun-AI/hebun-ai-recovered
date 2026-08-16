import { Compass, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HebyWhy } from "@/components/command-center/heby-why";
import type { DirectorIntentModel } from "@/features/director-intent/workspace-model";

/*
 * Command · Director Intent (Hebun UI Phase 20B) — the prepared-intent surface that replaces the
 * former "Command Console" (Phase 20A decision D1). It is NOT a shell, terminal, or direct
 * execution, and never routes free text to raw execution. It presents the Phase 17 action
 * lifecycle read-only: only READ_ONLY / side-effect-free preparation is invokable; every mutation
 * stays gated to human authority with no connected substrate. There is no "authorized" state the
 * system can produce. Prepared ≠ authorized ≠ executed. Heby prepares; it never executes.
 */

const SIDE_EFFECT_LABEL: Record<string, string> = {
  READ_ONLY: "Read-only",
  PREPARATION_ONLY: "Preparation only",
  REVERSIBLE_MUTATION: "Reversible mutation",
  CONSEQUENTIAL_MUTATION: "Consequential mutation",
  DEVICE_ACTION: "Device action",
};

export function DirectorIntent({ model }: { model: DirectorIntentModel }) {
  return (
    <>
      <PageHeader
        title="Director Intent"
        context="Express what you want Hebun to investigate, prepare, or change. Heby understands and prepares — it never authorizes or executes."
        action={<Badge variant="neutral">Preparation only</Badge>}
      />

      {/* Honest capability boundary */}
      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
        <span className="inline-flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Understanding</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary">
            <span className="size-2 rounded-full bg-fg-muted" aria-hidden="true" />
            No language model connected
          </span>
        </span>
        <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />
        <span className="text-xs text-fg-muted">
          {model.invokableCount} action{model.invokableCount === 1 ? "" : "s"} invokable — read-only only. Prepared ≠ authorized ≠ executed.
        </span>
        <span className="ml-auto">
          <HebyWhy
            label="Explain the boundary"
            variant="icon"
            region={{ key: "director-intent", label: "Director Intent" }}
            intent="EXPLAIN"
          />
        </span>
      </div>

      {/* Safe intent categories */}
      <h2 className="mb-3 text-sm font-semibold text-fg">What do you want to do?</h2>
      <section aria-label="Intent categories" className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {model.categories.map((category) => (
          <Card key={category.key} className="h-full">
            <CardContent className="flex h-full flex-col gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Compass className="size-4 shrink-0 text-primary" />
                {category.label}
              </span>
              <p className="text-xs leading-5 text-fg-secondary">{category.describes}</p>
              <div className="mt-auto pt-1">
                <Badge variant={category.invokableNow ? "success" : "neutral"}>
                  {category.invokableNow ? "Available" : "Requires authority"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* The Phase 17 lifecycle — no authorized state */}
      <h2 className="mb-3 text-sm font-semibold text-fg">How intent is handled</h2>
      <Card className="mb-8">
        <CardContent>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {model.lifecycle
              .filter((stage) => !["FAILED", "EXPIRED", "REJECTED", "CANCELLED", "EXECUTED"].includes(stage.state))
              .map((stage, index, arr) => (
                <li key={stage.state} className="flex items-center gap-2">
                  <span className="rounded-md border border-border bg-surface-sunken px-2 py-1 text-[0.7rem] font-medium text-fg-secondary">
                    {stage.label}
                  </span>
                  {index < arr.length - 1 && <ArrowRight className="size-3 text-fg-muted" aria-hidden="true" />}
                </li>
              ))}
          </ol>
          <p className="mt-3 text-xs leading-5 text-fg-muted">
            There is no &ldquo;authorized&rdquo; state the system produces — authorization is a human act.
            Consequential work halts at human review. One action kind has a connected execution
            runtime, spendable only by an explicit human act on Decisions and disabled at the
            durable switch; every other consequential action has no substrate at all.
          </p>
        </CardContent>
      </Card>

      {/* Declared action tools — honest about what can run */}
      <h2 className="mb-3 text-sm font-semibold text-fg">Declared actions</h2>
      <section aria-label="Declared actions" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {model.actions.map((action) => (
          <Card key={action.toolId} className="h-full">
            <CardContent className="flex h-full flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold text-fg">{action.actionKind}</span>
                <Badge variant={action.substrateConnected ? "success" : "neutral"} className="shrink-0">
                  {action.substrateConnected ? "Invokable" : "Not connected"}
                </Badge>
              </div>
              <p className="text-xs leading-5 text-fg-secondary">{action.describes}</p>
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-2 text-[0.7rem] text-fg-muted">
                <span>{SIDE_EFFECT_LABEL[action.sideEffect] ?? action.sideEffect}</span>
                <span>· {action.authorityRequirement}</span>
                <span>· owner: {action.ownerWorkspace}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
