import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { AgentRegistryWorkspace } from "@/components/agents/agent-registry-workspace";
import type {
  AgentsTruthModel,
  AgentDefinitionView,
  ExecutionLadderStage,
  LadderState,
  ProvenanceClass,
} from "@/features/workforce/agents-truth-model";

/*
 * Agents Truth Surface (UI Phase 25B).
 *
 * The authoritative Agents presentation. Workforce = WHO can perform work, so this surface
 * presents agent DEFINITIONS — not a running workforce. It never renders seeded activity
 * (tasksToday / costToday / lastActive / live status / workload / queue) as live truth, and
 * it never renders a pulsing "online" indicator. Every region is provenance-labeled. The
 * real in-memory definition CRUD (Command Bus, no database write) is retained below,
 * explicitly framed as offline simulation. No execution, no live provider, no Computer Use,
 * no durable persistence, no secret field, no new mutation capability is introduced here.
 */

const PROVENANCE_VARIANT: Record<ProvenanceClass, BadgeVariant> = {
  structural: "success",
  seeded: "info",
  "derived-from-seeded": "primary",
  simulated: "warning",
  unavailable: "neutral",
};

const LADDER_VARIANT: Record<LadderState, BadgeVariant> = {
  reached: "success",
  "not-reached": "neutral",
  "not-applicable": "neutral",
};

const LADDER_LABEL: Record<LadderState, string> = {
  reached: "reached",
  "not-reached": "not reached",
  "not-applicable": "n/a",
};

function TruthCell({ label, value, tone }: { label: string; value: string; tone?: BadgeVariant }) {
  return (
    <div className="rounded-md border bg-surface-sunken p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-fg">
        {tone ? <Badge variant={tone}>{value}</Badge> : <span className="tabular-nums">{value}</span>}
      </p>
    </div>
  );
}

export function AgentsTruthSurface({ model }: { model: AgentsTruthModel }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Substrate truth — recomputed from the live persistence layer and the definitions. */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Agent Definitions — Substrate Truth</CardTitle>
            <span className="text-xs text-fg-muted">
              Workforce = who can perform work. These are definitions, not a running workforce.
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          <TruthCell label="Seeded definitions" value={String(model.seededDefinitionCount)} />
          <TruthCell label="User-defined" value={String(model.userDefinedCount)} />
          <TruthCell label="Active" value={String(model.activeDefinitionCount)} />
          <TruthCell label="Persistence" value={`${model.persistenceProvider} · not durable`} tone="warning" />
          <TruthCell label="Runtime mode" value={model.runtimeMode} tone="warning" />
          <TruthCell label="Live execution" value="not connected" tone="neutral" />
          <TruthCell label="Live provider" value="not connected" tone="neutral" />
          <TruthCell label="Computer Use" value="not available" tone="neutral" />
        </CardContent>
      </Card>

      {/* Provenance legend — concise product language for how to read every value. */}
      <Card>
        <CardHeader>
          <CardTitle>How to read this surface</CardTitle>
          <span className="text-xs text-fg-muted">Provenance of every value</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {model.provenanceLegend.map((entry) => (
            <div key={entry.provenance} className="flex items-start gap-3">
              <Badge variant={PROVENANCE_VARIANT[entry.provenance]} className="mt-0.5 shrink-0">
                {entry.label}
              </Badge>
              <p className="text-sm leading-6 text-fg-secondary">{entry.describes}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Definition → execution ladder — a definition is not an execution. */}
      <Card>
        <CardHeader>
          <CardTitle>Definition is not execution</CardTitle>
          <span className="text-xs text-fg-muted">
            Creating a definition ≠ activating a runtime. Execution is owned by Operations.
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {model.executionLadder.map((stage: ExecutionLadderStage) => (
            <div key={stage.key} className="flex items-start justify-between gap-3 border-b py-2 last:border-0">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                  {stage.label}
                  <Badge variant={PROVENANCE_VARIANT[stage.provenance]}>{stage.provenance}</Badge>
                </p>
                <p className="text-xs leading-5 text-fg-muted">{stage.detail}</p>
              </div>
              <Badge variant={LADDER_VARIANT[stage.state]} className="shrink-0">
                {LADDER_LABEL[stage.state]}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Definitions — declared structure only. No live activity, no pulsing status. */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Agent Definitions</CardTitle>
            <span className="text-xs text-fg-muted">
              Declared identity, role, capabilities, and referenced provider/model. Status is a
              seeded definition attribute — not a live signal.
            </span>
          </div>
          <Badge variant="info">seeded · in-memory</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="ui-table-wrap">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-fg-muted">
                  <th className="px-4 py-3 font-medium">Definition</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Provider (ref)</th>
                  <th className="px-4 py-3 font-medium">Model (ref)</th>
                  <th className="px-4 py-3 font-medium">Capabilities</th>
                  <th className="px-4 py-3 font-medium">Origin</th>
                  <th className="px-4 py-3 font-medium">Seeded status</th>
                </tr>
              </thead>
              <tbody>
                {model.definitions.map((agent: AgentDefinitionView) => (
                  <tr key={agent.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-fg">{agent.name}</span>
                        <span className="font-mono text-xs text-fg-muted">{agent.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-fg-secondary">{agent.role}</td>
                    <td className="px-4 py-3 text-fg-secondary">{agent.department}</td>
                    <td className="px-4 py-3 font-mono text-xs text-fg-secondary">{agent.referencedProvider}</td>
                    <td className="px-4 py-3 font-mono text-xs text-fg-secondary">{agent.referencedModel}</td>
                    <td className="px-4 py-3 text-fg-secondary">{agent.declaredCapabilities.length}</td>
                    <td className="px-4 py-3">
                      <Badge variant={agent.origin === "seeded" ? "info" : "primary"}>{agent.origin}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-fg-muted">{agent.seededStatus} (seeded)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Real in-memory definition CRUD — retained, explicitly framed. Cards (with live-looking
          activity) are suppressed; the workspace already discloses in-memory / offline / no DB. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-fg">Definition Registry — in-memory CRUD</h2>
          <Badge variant="warning">offline simulation</Badge>
          <Badge variant="neutral">no database write</Badge>
        </div>
        <p className="text-xs leading-5 text-fg-muted">
          Create, edit, archive, restore, and soft-delete run through the Command Bus and mutate
          the in-memory definition registry only. A definition mutation is not an execution.
        </p>
        <AgentRegistryWorkspace />
      </div>
    </div>
  );
}
