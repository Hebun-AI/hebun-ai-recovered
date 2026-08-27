import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { AgentRegistryWorkspace } from "@/components/agents/agent-registry-workspace";
import { AgentRegistry } from "@/features/agent-runtime";

/*
 * Agent Registry (director surface) — the SIMULATION, and nothing else.
 *
 * AGENT-ID-0.1 corrected what this page claimed. It renders exactly the same workspace it always
 * has, over exactly the same in-memory Command Bus registry — but it used to describe that registry
 * as "first-class agent definitions" and count them under a green `N active` badge, with no mention
 * anywhere on the page that nothing here reaches a database.
 *
 * That was survivable while it was the only agent surface in the product. It stopped being
 * survivable the moment a DURABLE agent identity authority existed on `/agents`, because a reader
 * moving between the two surfaces would have had no way to tell which registry was real.
 *
 * So this page now says what it is. No capability was removed and no control was hidden — the
 * simulation is genuinely useful and is retained in full. What changed is that it no longer presents
 * itself as organizational truth. The durable authority lives on `/agents`, and this page points at
 * it rather than competing with it.
 */

export default function AgentRegistryPage() {
  const definitions = AgentRegistry.listAgents().length;

  return (
    <>
      <PageHeader
        title="Agent Registry"
        context="Simulated agent definitions managed through the Command Bus over the in-memory persistence adapter. Nothing on this page writes a database row, and nothing here creates a durable agent identity."
        action={<Badge variant="warning">{definitions} simulated definitions</Badge>}
      />
      <div className="flex flex-col gap-4">
        <p className="text-xs leading-5 text-fg-muted">
          These definitions are per-process and offline: they are not this organization&rsquo;s
          agents, they hold no credential or session, and they are not visible to anybody else. The
          durable, human-owned agent identity authority lives on the Agents surface.
        </p>
        <AgentRegistryWorkspace />
      </div>
    </>
  );
}
