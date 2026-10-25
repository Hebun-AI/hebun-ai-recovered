/*
 * WORK-UPDATE V1 (Option A) — the work item a person brought to Heby from the Work register.
 *
 * A server component. It receives the item already resolved for the session's tenant by the page,
 * shows the person which item they chose, and renders the existing state-change affordance — the only
 * place in the product that asks an agent about a work item's declared state — and, since
 * AGENT-EXECUTION-1, the place a person assigns a responsible agent a draft for it. The title is for the
 * person; neither agent path shows it to the model.
 */
import type { WorkStateSelection } from "@/features/heby-action-inlet/work-state-proposal.server";
import Link from "next/link";
import { HebyWorkStateAffordance } from "./heby-work-state-affordance";
import { HebyWorkDraftAffordance } from "./heby-work-draft-affordance";

export function HebyWorkStateSelection({ selection }: { readonly selection: WorkStateSelection }) {
  return (
    <section
      aria-label="Selected work item"
      data-heby-work-selection={selection.status}
      className="rounded-md border border-border bg-surface p-3 text-xs leading-5"
    >
      {selection.status === "selected" ? (
        <>
          <p className="text-fg">
            Work item from the Work register: <span className="font-medium">{selection.title}</span> · currently{" "}
            {selection.declaredState}
          </p>
          {!selection.inService ? (
            <p className="mt-1 text-fg-secondary">This work item is retired, so no state change can be proposed.</p>
          ) : !selection.domainScoped ? (
            <p className="mt-1 text-fg-secondary">
              This work item was recorded without a work scope, so no agent responsibility can be checked and no
              state change can be proposed.
            </p>
          ) : (
            <>
              <HebyWorkStateAffordance workItemId={selection.workItemId} declaredState={selection.declaredState} />
              {/* AGENT-EXECUTION-1 — assign a responsible agent one draft for this work, and follow it. */}
              <HebyWorkDraftAffordance workItemId={selection.workItemId} />
            </>
          )}
        </>
      ) : (
        <p className="text-fg-secondary">
          {selection.status === "unresolved"
            ? "That work item could not be found in your organization."
            : "Hebun could not read that work item right now."}{" "}
          Nothing was asked and nothing was changed.
        </p>
      )}
      {/* ENTERPRISE-OPERATIONS-1 — the way back to where this item came from, and where its state lives. */}
      <Link href="/director/work" className="mt-2 inline-block underline">
        Back to the work register
      </Link>
    </section>
  );
}
