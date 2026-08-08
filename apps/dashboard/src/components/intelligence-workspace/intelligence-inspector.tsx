import { Eye, FileSearch, GitBranch, HelpCircle, Fingerprint } from "lucide-react";
import { WorkspaceRegion, AdvisoryMarker } from "./workspace-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Intelligence Inspector (Phase 8 §10) — the contextual lens.
 *
 * The mental model: Observation → Evidence → Reasoning → Uncertainty → Provenance.
 * With no intelligence item selected (and none surfaced to select), the inspector
 * shows its honest instructional state — describing the lens that WILL apply — and
 * never pretends to inspect something that is not there. It makes intelligence
 * inspectable, not magically authoritative.
 */

const LENS: readonly { icon: typeof Eye; facet: string; question: string }[] = [
  { icon: Eye, facet: "Observation", question: "What changed?" },
  { icon: FileSearch, facet: "Evidence", question: "What supports this?" },
  { icon: GitBranch, facet: "Reasoning", question: "Why might these facts be related?" },
  { icon: HelpCircle, facet: "Uncertainty", question: "What remains unknown?" },
  { icon: Fingerprint, facet: "Provenance", question: "Where did this come from?" },
];

export function IntelligenceInspector() {
  return (
    <WorkspaceRegion
      eyebrow="Inspect"
      title="Intelligence Inspector"
      className="h-full"
      action={<AdvisoryMarker label="Nothing selected" />}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-5 text-fg-secondary">
          Select an intelligence item to inspect it through five lenses. No item is surfaced yet, so there is
          nothing to inspect — the inspector never invents an observation to fill this space.
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
          <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Want the model explained?</span>
          <HebyWhy label="Ask Heby" variant="text" />
        </div>
      </div>
    </WorkspaceRegion>
  );
}
