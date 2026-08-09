import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Operations — Hebun AI" };

/*
 * Legacy Workflows — retired in Hebun UI Phase 22D.
 *
 * Workflow state is a seeded, non-authoritative projection with no authoritative surface of its
 * own; Operations Overview honestly reports its availability. A neutral redirect to Overview is
 * preferred over a false equivalence. No loop, no chain.
 */

export default function WorkflowsPage(): never {
  permanentRedirect("/operations");
}
