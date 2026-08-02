import { Brain, CircleAlert, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WorkspaceCard } from "@/components/director-workspace/workspace-card";
import type { DecisionIntelligenceSignal, DecisionRelationship } from "@/features/decision-domain/mock";

const stateVariant = { Healthy: "success", Watch: "warning", Attention: "error" } as const;

export function DecisionIntelligence({ items }: { items: DecisionIntelligenceSignal[] }) {
  return <WorkspaceCard title="Decision intelligence" description="Executive signals that affect review quality, timing, ownership, and confidence." action={<CircleAlert className="size-5 text-warning" aria-hidden="true" />}><ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <li key={item.type} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[0.65rem] font-semibold uppercase tracking-wider text-primary">{item.type}</p><p className="mt-1 text-xs font-semibold text-fg">{item.label}</p></div><Badge variant={stateVariant[item.state]}>{item.state}</Badge></div><p className="mt-3 text-lg font-semibold text-fg tabular-nums">{item.value}</p><p className="mt-1 text-[0.7rem] leading-4 text-fg-secondary">{item.detail}</p></li>)}</ul></WorkspaceCard>;
}

export function DecisionRelationships({ items }: { items: DecisionRelationship[] }) {
  return <WorkspaceCard title="Cross-domain decision relationships" description="How enterprise context can inform decisions without transferring authority." action={<Network className="size-5 text-primary" aria-hidden="true" />}><ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <li key={item.kind} className="rounded-lg border border-border bg-surface-sunken/35 p-3"><p className="text-[0.65rem] font-semibold uppercase tracking-wider text-primary">{item.kind}</p><p className="mt-1 text-xs font-semibold text-fg">{item.label}</p><p className="mt-1 text-[0.7rem] leading-4 text-fg-secondary">{item.relationship}</p></li>)}</ul><p className="mt-3 text-xs text-fg-muted">Conceptual relationships only · no graph, workflow, or Runtime infrastructure</p></WorkspaceCard>;
}

export function HebyDecisionContext({ prompts }: { prompts: readonly string[] }) {
  return <WorkspaceCard title="Heby decision context" description="Simulated advisory prompts for Director-led review. Heby cannot decide or act." action={<Badge variant="info">Advisory only</Badge>}><div className="flex items-center gap-2 text-xs text-fg-secondary"><Brain className="size-4 text-primary" aria-hidden="true" />Bounded decision conversation starters</div><ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{prompts.map((prompt) => <li key={prompt}><button type="button" disabled className="flex min-h-11 w-full cursor-not-allowed items-center rounded-lg border border-border bg-surface-sunken/35 px-3 text-left text-xs font-medium text-fg opacity-80">{prompt}</button></li>)}</ul><p className="mt-3 text-[0.7rem] text-fg-muted">Simulation only · Director authority remains absolute · no execution</p></WorkspaceCard>;
}
