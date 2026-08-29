import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { WorkflowRegistryWorkspace } from "@/components/workflows/workflow-registry-workspace";
import { WorkflowRegistry } from "@/features/workflow-runtime";

/*
 * Workflow Registry — L1 TRUTH-1.
 *
 * "N active" in success green, over an in-memory Command Bus registry seeded from
 * `features/workflows/mock.ts`. Relabelled to the AGENT-ID-0.1 wording released on the sibling
 * registry page. No workflow here has ever run for any organization, and the page now says so.
 */

export default function WorkflowRegistryPage() {
  const active = WorkflowRegistry.listWorkflows().length;

  return (
    <>
      <PageHeader
        title="Workflow Registry"
        context="Simulated workflow definitions managed through the Command Bus over the in-memory persistence adapter. Nothing on this page writes a database row, and no workflow here has ever run for this organization."
        action={<Badge variant="warning">{active} simulated definitions</Badge>}
      />
      <WorkflowRegistryWorkspace showCards={false} />
    </>
  );
}
