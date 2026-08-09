import { PageHeader } from "@/components/layout/page-header";
import { AgentsTruthSurface } from "@/components/agents/agents-truth-surface";
import { getAgentsTruthModel } from "@/features/workforce/agents-truth-model";

export const metadata = { title: "Agents — Hebun AI" };

/*
 * Agents — the authoritative Workforce surface (UI Phase 25B truth pass).
 *
 * Workforce = WHO can perform work. This surface presents agent DEFINITIONS honestly:
 * a seeded, in-memory registry over the "memory" persistence provider, runtime "simulation".
 * It does NOT present seeded activity (tasks / cost / last-active / live status) as live
 * organizational truth, renders no pulsing "online" indicator, and implies no execution.
 * Neighbouring authority is not absorbed: execution → Operations, human authority → Decisions,
 * providers/models → Platform, memory → Knowledge. The real in-memory definition CRUD
 * (Command Bus, no database write) remains, explicitly framed inside the surface.
 *
 * Phase 25B removed the four live-activity panels (Context / Reasoning / Task Planning /
 * Execution Queue) and the pulsing AgentCard roster from the authoritative surface — they
 * presented seeded/derived activity as if live. The components are unchanged and still used
 * by their own (non-authoritative) surfaces; they are simply no longer rendered here.
 */

export default function AgentsPage() {
  const model = getAgentsTruthModel();

  return (
    <>
      <PageHeader
        title="Agents"
        context={`${model.seededDefinitionCount} seeded agent definitions · in-memory registry · runtime ${model.runtimeMode}`}
      />
      <AgentsTruthSurface model={model} />
    </>
  );
}
