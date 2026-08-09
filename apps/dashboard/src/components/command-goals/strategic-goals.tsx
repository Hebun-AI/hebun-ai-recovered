import { Target } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HebyWhy } from "@/components/command-center/heby-why";
import type { StrategicGoalsModel } from "@/features/command-goals/workspace-model";

/*
 * Command · Strategic Goals (Hebun UI Phase 20B) — reads the real goal authority
 * (`goal-runtime`, active Goal nodes DERIVED from the knowledge graph). It no longer imports
 * `director/mock`. Goals shown are exactly what the authority returns, attributed as derived;
 * if none, an honest empty state. No fabricated target, percentage, due date, or progress.
 * A Goal is not a metric, not a task, not a recommendation. Heby advisory only.
 */

export function StrategicGoals({ model }: { model: StrategicGoalsModel }) {
  return (
    <>
      <PageHeader
        title="Strategic Goals"
        context="Where the organization is trying to go. Derived from the goal authority — not a metric, task, or recommendation."
        action={
          model.connected ? (
            <Badge variant="info">{model.goals.length} derived</Badge>
          ) : (
            <Badge variant="neutral">Not connected</Badge>
          )
        }
      />

      {/* Provenance strip */}
      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
        <span className="text-xs text-fg-secondary">
          Source: <span className="font-medium text-fg">{model.source}</span>
        </span>
        <span className="ml-auto">
          <HebyWhy
            label="Trace goal provenance"
            variant="icon"
            region={{ key: "strategic-goals", label: "Strategic Goals" }}
            intent="EXPLAIN"
          />
        </span>
      </div>

      {model.connected ? (
        <section aria-label="Strategic goals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {model.goals.map((goal) => (
            <Card key={goal.id} className="h-full">
              <CardContent className="flex h-full flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-fg">
                    <Target className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{goal.title}</span>
                  </span>
                  {goal.status && <Badge variant="neutral">{goal.status}</Badge>}
                </div>
                {goal.description && (
                  <p className="line-clamp-3 text-xs leading-5 text-fg-secondary">{goal.description}</p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-2 text-[0.7rem] text-fg-muted">
                  {goal.source && <span>Source: {goal.source}</span>}
                  {goal.ownerType && <span>Owner: {goal.ownerType}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Target className="size-6 text-fg-muted" />
            <p className="text-sm font-medium text-fg">No strategic goals are connected</p>
            <p className="max-w-md text-xs leading-5 text-fg-muted">
              The goal authority returned no active goals. Goals appear here only when the knowledge
              graph holds them — none are fabricated.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
