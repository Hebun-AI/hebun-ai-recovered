import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { AgentRegistryWorkspace } from "@/components/agents/agent-registry-workspace";
import { AgentRegistry } from "@/features/agent-runtime";

export default function AgentRegistryPage() {
  const active = AgentRegistry.listAgents().length;

  return (
    <>
      <PageHeader
        title="Agent Registry"
        context="First-class agent definitions managed through the Command Bus and the in-memory persistence adapter."
        action={<Badge variant="success">{active} active</Badge>}
      />
      <AgentRegistryWorkspace />
    </>
  );
}
