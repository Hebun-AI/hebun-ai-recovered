import { Target } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HebyWhy } from "@/components/command-center/heby-why";
import type { StrategicGoalsModel } from "@/features/command-goals/workspace-model";

/*
 * Command · Strategic Goals.
 *
 * CMD-0. This surface used to describe its rows as "Derived from the goal authority" and badge
 * them "N derived". They are neither: `goal-runtime` projects a compiled-in registry seed out of
 * the in-memory store, with no tenant and no canonical Knowledge anywhere on the path. Wherever a
 * real tenant can be authenticated the model now WITHHOLDS the projection, and this component
 * states that withholding as its own truth — "unavailable" is not "the authority returned none".
 *
 * Where the demo gate permits it, the rows are shown and labelled SEEDED. No fabricated target,
 * percentage, due date, owner, or progress; no count is presented as an organizational figure.
 * A Goal is not a metric, not a task, not a recommendation. Heby advisory only.
 */

export function StrategicGoals({ model }: { model: StrategicGoalsModel }) {
  return (
    <>
      <PageHeader
        title="Strategic Goals"
        context="Where the organization is trying to go. No goal authority is established — nothing here is an organizational commitment."
        action={
          model.withheld ? (
            <Badge variant="neutral">Withheld</Badge>
          ) : (
            <Badge variant="neutral">{model.goals.length} seeded</Badge>
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

      {!model.withheld && model.goals.length > 0 ? (
        <section aria-label="Strategic goals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {model.goals.map((goal) => (
            <Card key={goal.id} className="h-full">
              <CardContent className="flex h-full flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-fg">
                    <Target className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{goal.title}</span>
                  </span>
                  {/*
                    * The row's `status` is the knowledge-node vocabulary — "verified", "review".
                    * On a seeded row that word reads as an authority's verdict on an organizational
                    * goal, which is the same overclaim this gate exists to remove, so it is not
                    * rendered while the rows are seeded.
                    */}
                  {model.provenance !== "seeded" && goal.status && (
                    <Badge variant="neutral">{goal.status}</Badge>
                  )}
                </div>
                {goal.description && (
                  <p className="line-clamp-3 text-xs leading-5 text-fg-secondary">{goal.description}</p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-2 text-[0.7rem] text-fg-muted">
                  <span>{model.provenance === "seeded" ? "Seeded" : "Unverified"}</span>
                  {goal.source && <span>Row source: {goal.source}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Target className="size-6 text-fg-muted" />
            <p className="text-sm font-medium text-fg">
              {model.withheld ? "Strategic goals are unavailable" : "No strategic goals are listed"}
            </p>
            <p className="max-w-md text-xs leading-5 text-fg-muted">
              {model.withheld
                ? "The only goal source in this system is a compiled-in seed, so it is withheld rather than shown as this organization's goals. Hebun does not know what goals this organization holds."
                : "The seeded goal source returned no rows. Nothing is fabricated to fill the space."}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
