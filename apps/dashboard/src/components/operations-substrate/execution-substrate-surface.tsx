/*
 * execution-substrate-surface.tsx — read-only Execution Substrate readiness (Hebun UI Phase 22C).
 *
 * An architectural/runtime readiness surface — NOT an execution console, terminal, or Computer
 * Use. It renders the real execution stack (each layer marked connected / contract-only / missing),
 * the gate model, the Computer Use and terminal reality (from real contracts), and what would have
 * to become true to execute. NO terminal emulator, command box, Run/Execute button, fake session,
 * fake receipt, or invented "AUTHORIZED" state.
 *
 * Server component — no client state, no mutation affordance.
 */

import type { LucideIcon } from "lucide-react";
import { CircleSlash, Cpu, Layers, ListChecks, ShieldOff, TerminalSquare } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getSubstrateModel,
  type GateStatus,
  type LayerState,
} from "@/features/operations-substrate";

const LAYER_META: Record<LayerState, { label: string; variant: BadgeVariant }> = {
  connected: { label: "Connected", variant: "success" },
  "contract-only": { label: "Contract-only", variant: "info" },
  "in-memory": { label: "In-memory", variant: "neutral" },
  "not-connected": { label: "Not connected", variant: "neutral" },
  restricted: { label: "Restricted", variant: "warning" },
  "simulation-only": { label: "Simulation only", variant: "warning" },
  "human-gated": { label: "Human-gated", variant: "info" },
};

const GATE_META: Record<GateStatus, { label: string; variant: BadgeVariant }> = {
  satisfied: { label: "Satisfied", variant: "success" },
  unmet: { label: "Unmet", variant: "warning" },
  "not-connected": { label: "Not connected", variant: "neutral" },
  "not-required": { label: "Not required", variant: "neutral" },
  "requires-human-review": { label: "Requires human review", variant: "warning" },
  restricted: { label: "Restricted", variant: "error" },
};

function Section({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-fg-muted" aria-hidden="true" />
          {title}
        </CardTitle>
        {subtitle && <span className="text-xs text-fg-muted">{subtitle}</span>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function ExecutionSubstrateSurface() {
  const model = getSubstrateModel();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* Substrate state */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-sunken">
            <CircleSlash className="size-4 text-fg-secondary" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-fg">{model.state.headline}</h2>
              <Badge variant="neutral">Not connected</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-fg-secondary">{model.state.detail}</p>
          </div>
        </CardContent>
      </Card>

      {/* Execution layers (the stack) */}
      <Section icon={Layers} title="Execution stack" subtitle="Each layer marked connected, contract-only, or missing — from disk truth.">
        <ol className="flex flex-col gap-2">
          {model.layers.map((layer, index) => {
            const meta = LAYER_META[layer.state];
            return (
              <li key={layer.layer} className="flex items-start gap-3 rounded-md border border-border bg-surface-sunken p-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[0.7rem] font-semibold tabular-nums text-fg-muted">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-fg">{layer.layer}</span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">{layer.owner}</span>
                    {!layer.implemented && <span className="text-[0.7rem] font-medium uppercase tracking-wide text-warning">missing</span>}
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-fg-muted">{layer.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      {/* Gate model */}
      <Section icon={ListChecks} title="Why nothing executes" subtitle="The real gates between a prepared action and execution.">
        <div className="flex flex-col gap-2">
          {model.gates.map((gate) => {
            const meta = GATE_META[gate.status];
            return (
              <div key={gate.gate} className="flex flex-col gap-1 rounded-md border border-border bg-surface-sunken p-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="sm:w-44 sm:shrink-0">
                  <p className="text-sm font-semibold text-fg">{gate.gate}</p>
                </div>
                <p className="min-w-0 flex-1 text-xs leading-5 text-fg-muted">{gate.detail}</p>
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Computer Use + Terminal reality */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={Cpu} title="Computer Use">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">Simulation only</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-fg-secondary">{model.computerUse.detail}</p>
        </Section>
        <Section icon={TerminalSquare} title="Terminal">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-fg-muted">{model.terminal.capability}</span>
            <Badge variant="warning">{model.terminal.state}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-fg-secondary">{model.terminal.detail}</p>
        </Section>
      </div>

      {/* What must become true */}
      <Section icon={ListChecks} title="What would have to become true to execute">
        <ul className="flex flex-col gap-2">
          {model.requiredToExecute.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm leading-6 text-fg-secondary">
              <CircleSlash className="mt-1 size-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-md border border-dashed border-border bg-surface-sunken p-3 text-xs leading-5 text-fg-muted">{model.receiptBoundary}</p>
      </Section>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Execution Substrate is read-only. It describes the execution architecture; it does not activate it, and it opens no terminal, browser, or device.
      </p>
    </div>
  );
}
