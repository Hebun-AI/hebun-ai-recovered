/*
 * execution-surface.tsx — read-only Execution inspection (Hebun UI Phase 22B).
 *
 * Distinguishes execution ACTIVITY (nothing has run) from execution CAPABILITY (only
 * READ_ONLY is invokable; everything else is non-executable). It renders NO execution/mock,
 * NO fabricated run / receipt / timestamp / status, NO fake progress, and NO run / retry /
 * kill / execute / approve controls. Capability facts come from the real Phase 17 action
 * registry and Phase 18 device runtime. Simulation is visibly distinct from execution.
 *
 * Server component — no client state, no mutation affordance.
 */

import { Activity, Ban, Cpu, ListChecks, ScrollText, ShieldOff } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getExecutionSurfaceModel,
  type ExecutionCapabilityStatus,
} from "@/features/operations-execution";

const CAP_STATUS: Record<ExecutionCapabilityStatus, { label: string; variant: BadgeVariant }> = {
  available: { label: "Available", variant: "success" },
  "prepared-only": { label: "Prepared only", variant: "info" },
  "not-connected": { label: "Not connected", variant: "neutral" },
  "requires-human-review": { label: "Requires human review", variant: "warning" },
  restricted: { label: "Restricted", variant: "error" },
};

function deviceStateVariant(state: string): BadgeVariant {
  if (state === "restricted") return "warning";
  if (state === "available") return "success";
  return "neutral";
}

export function ExecutionSurface() {
  const model = getExecutionSurfaceModel();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* Execution state banner (honest) */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-sunken">
            <ShieldOff className="size-4 text-fg-secondary" aria-hidden="true" />
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

      {/* Execution activity — honest empty */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4 text-fg-muted" aria-hidden="true" />
            Execution activity
          </CardTitle>
          <span className="text-xs text-fg-muted">What has actually run.</span>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-surface-sunken p-4 text-sm text-fg-secondary">
            <Ban className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            {model.activity.note}
          </div>
        </CardContent>
      </Card>

      {/* Capability matrix — by side-effect class (real registry) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-4 text-fg-muted" aria-hidden="true" />
            Execution capability
          </CardTitle>
          <span className="text-xs text-fg-muted">What could run — from the Phase 17 action registry. Only READ_ONLY is invokable.</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {model.capabilities.map((row) => {
            const meta = CAP_STATUS[row.status];
            return (
              <div key={row.sideEffect} className="flex flex-col gap-1 rounded-md border border-border bg-surface-sunken p-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 sm:w-56 sm:shrink-0">
                  <p className="text-sm font-semibold text-fg">{row.label}</p>
                  <p className="font-mono text-[0.7rem] text-fg-muted">{row.sideEffect}</p>
                </div>
                <p className="min-w-0 flex-1 text-xs leading-5 text-fg-muted">{row.detail}</p>
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Device capabilities + Computer Use (real Phase 18) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="size-4 text-fg-muted" aria-hidden="true" />
            Device & Computer Use
          </CardTitle>
          <span className="text-xs text-fg-muted">{model.computerUse.detail}</span>
        </CardHeader>
        <CardContent>
          <div className="ui-table-wrap">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-fg-muted">
                  <th className="px-3 py-2 font-medium">Capability</th>
                  <th className="px-3 py-2 font-medium">Side effect</th>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 font-medium">Describes</th>
                </tr>
              </thead>
              <tbody>
                {model.deviceCapabilities.map((row) => (
                  <tr key={row.capability} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-fg">{row.capability}</td>
                    <td className="px-3 py-2 font-mono text-[0.7rem] text-fg-muted">{row.sideEffect}</td>
                    <td className="px-3 py-2"><Badge variant={deviceStateVariant(row.state)}>{row.state}</Badge></td>
                    <td className="px-3 py-2 text-xs text-fg-muted">{row.describes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Authority chain — the real separation */}
      <Card>
        <CardHeader>
          <CardTitle>Authority chain</CardTitle>
          <span className="text-xs text-fg-muted">Prepared ≠ authorized ≠ executed ≠ successful. There is no runtime “authorized” state — authorization is a human act.</span>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-2">
            {model.authorityChain.map((stage, index) => (
              <li key={stage.stage} className="flex items-start gap-3 rounded-md border border-border bg-surface-sunken p-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[0.7rem] font-semibold tabular-nums text-fg-muted">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-fg">{stage.stage}</span>
                    <Badge variant="neutral">{stage.owner}</Badge>
                    {!stage.sideEffectOccurred && (
                      <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">no side effect</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-fg-muted">{stage.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Receipts — honest empty */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="size-4 text-fg-muted" aria-hidden="true" />
            Receipts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-surface-sunken p-4 text-sm text-fg-secondary">
            <Ban className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            {model.receipts.note}
          </div>
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Execution is read-only. It reports what has run and what could run; it never runs, retries, approves, authorizes, or opens a terminal, browser, or device.
      </p>
    </div>
  );
}
