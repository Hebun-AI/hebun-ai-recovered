import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { MemoryRegistryWorkspace } from "@/components/memory/memory-registry-workspace";
import { MemoryRuntimeService } from "@/features/memory-runtime";

/*
 * Memory Registry — L1 TRUTH-1.
 *
 * "N active" in success green, over an in-memory Command Bus registry seeded from compiled-in
 * mocks. The context line named the in-memory adapter, which described the BACKING while the badge
 * still asserted a live count. Relabelled to the AGENT-ID-0.1 wording released on the sibling
 * registry page; the governed durable authority remains Company Memory.
 */

export default function MemoryRegistryPage() {
  const active = MemoryRuntimeService.getActiveCount();

  return (
    <>
      <PageHeader
        title="Memory Registry"
        context="Simulated memory definitions managed through the Command Bus over the in-memory persistence adapter. Nothing on this page writes a database row, and nothing here is this organization's memory. Governed durable memory lives on Company Memory."
        action={<Badge variant="warning">{active} simulated definitions</Badge>}
      />
      <MemoryRegistryWorkspace />
    </>
  );
}
