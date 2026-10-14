/*
 * WORK-UPDATE V1 (Option A) — the work item a person brought to Heby from the Work register.
 *
 * A server component. It receives the item already resolved for the session's tenant by the page,
 * shows the person which item they chose, and renders the existing state-change affordance — the only
 * place in the product that asks an agent about a work item's declared state. The title is for the
 * person; Heby is never shown it (the affordance's origination sends only a fixed sentence).
 */
import type { WorkStateSelection } from "@/features/heby-action-inlet/work-state-proposal.server";
import { HebyWorkStateAffordance } from "./heby-work-state-affordance";

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
              This work item is not recorded in a work domain, so no agent responsibility can be checked and no
              state change can be proposed.
            </p>
          ) : (
            <HebyWorkStateAffordance workItemId={selection.workItemId} declaredState={selection.declaredState} />
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
    </section>
  );
}
