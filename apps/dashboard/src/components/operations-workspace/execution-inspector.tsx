import { Info, GitBranch, LogIn, LogOut, ListChecks, Fingerprint } from "lucide-react";
import { OperationsRegion, SystemViewMarker } from "./operations-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Execution Inspector (Phase 10 §15) — the contextual lens for one operation.
 *
 * The lenses: Overview → Lifecycle → Inputs → Outputs → Events → Provenance. With
 * no operation selected (and none surfaced to select), the inspector shows its
 * honest instructional state and never fabricates a lifecycle, input, output,
 * event, or evidence reference.
 */

const LENS: readonly { icon: typeof Info; facet: string; question: string }[] = [
  { icon: Info, facet: "Overview", question: "What is this operation?" },
  { icon: GitBranch, facet: "Lifecycle", question: "Where is it in its lifecycle?" },
  { icon: LogIn, facet: "Inputs", question: "What went in?" },
  { icon: LogOut, facet: "Outputs", question: "What did it produce?" },
  { icon: ListChecks, facet: "Events", question: "What happened along the way?" },
  { icon: Fingerprint, facet: "Provenance", question: "Where did it originate?" },
];

export function ExecutionInspector() {
  return (
    <OperationsRegion
      eyebrow="Inspect"
      title="Execution Inspector"
      className="h-full"
      action={<SystemViewMarker label="Nothing selected" />}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-5 text-fg-secondary">
          Select an operation to inspect it through these lenses. Nothing is surfaced yet, so there is nothing
          to inspect — the inspector never fabricates a lifecycle or result to fill this space.
        </p>
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface-sunken">
          {LENS.map(({ icon: Icon, facet, question }) => (
            <li key={facet} className="flex items-start gap-2.5 p-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">{facet}</p>
                <p className="text-[0.7rem] leading-5 text-fg-muted">{question}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Want the lifecycle explained?</span>
          <HebyWhy label="Ask Heby" variant="text" />
        </div>
      </div>
    </OperationsRegion>
  );
}
