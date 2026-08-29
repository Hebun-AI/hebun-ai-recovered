import { BrainCircuit } from "lucide-react";
import { AgentContextOverview } from "@/components/agent-context/agent-context-overview";
import { ExecutiveReasoningOverview } from "@/components/agent-reasoning/executive-reasoning-overview";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { AgentRegistry } from "@/features/agent-runtime";

/*
 * Agent Context — L1 TRUTH-1.
 *
 * The header counted `AgentRegistry.listAgents()` under a green "N active agents" badge. That
 * registry is seeded from `features/agents/mock.ts`, so the badge stated a live headcount for the
 * reader's organization that no authority owns — the same defect AGENT-ID-0.1 corrected one route
 * away, on `/director/registries/agents`, and the same fiction the mock-surface gate exists to keep
 * out of the Director dashboard.
 *
 * Same treatment, same words: the simulation is kept in full and stops presenting itself as
 * organizational truth. The durable agent identity authority remains `/agents`.
 */

export default function DirectorAgentsPage() {
  const active = AgentRegistry.listAgents().length;

  return (
    <>
      <PageHeader
        title="Agent Context"
        context="Read-only view of every agent's deterministic Context Package, sourced from the Memory Engine. The agents below are simulated definitions in an in-memory registry — not this organization's workforce."
        action={<Badge variant="warning">{active} simulated definitions</Badge>}
      />

      <div className="mb-6 flex items-center gap-2 text-sm text-fg-secondary">
        <BrainCircuit className="size-4 text-primary" />
        Each agent requests context through the Memory Engine — no direct memory access, no LLM.
        These definitions are per-process and offline; the durable agent identity authority lives
        on the Agents surface.
      </div>

      <div className="flex flex-col gap-6">
        <ExecutiveReasoningOverview />
        <AgentContextOverview />
      </div>
    </>
  );
}
