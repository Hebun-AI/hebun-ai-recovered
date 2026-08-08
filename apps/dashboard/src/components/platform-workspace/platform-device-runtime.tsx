import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeDeviceRuntimeBoundary } from "@/features/device-runtime";
import { PlatformRegion, PlatformEmptyState } from "./platform-region";

/*
 * Device Runtime (UI Phase 18) — Platform owns device registration and technical capability.
 *
 * An honest, read-only transparency surface: the Device Runtime is Not connected, Computer Use is
 * Not enabled, and NO device is listed — no fabricated machine, no online status. Each declared
 * capability is shown with its risk and honest state (restricted or unavailable); every one is
 * non-executable. This is not a device manager: it connects nothing, lists no real device, and
 * exposes no credential. Camera, microphone, terminal, external browser control, and file write
 * remain restricted; credential surfaces are never a capability.
 */

export function PlatformDeviceRuntime() {
  const boundary = describeDeviceRuntimeBoundary();

  return (
    <PlatformRegion
      variant="card"
      eyebrow="External device capability"
      title="Device Runtime"
      action={
        <span className="inline-flex items-center rounded-full border border-border-strong bg-surface-sunken px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
          {boundary.runtimeStatusLabel}
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        <PlatformEmptyState
          title="Device Runtime is not connected"
          detail={boundary.detail}
          tone="blocked"
          compact
        />

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-fg-muted">Computer Use</dt>
          <dd className="font-medium text-fg">{boundary.computerUseLabel}</dd>
          <dt className="text-fg-muted">Registered devices</dt>
          <dd className="font-medium text-fg">{boundary.deviceCount} (none registered)</dd>
        </dl>

        <div>
          <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">
            Declared capabilities — none executable
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {boundary.capabilities.map((row) => (
              <li
                key={row.capability}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.65rem]",
                  row.state === "restricted"
                    ? "border-warning/40 text-warning"
                    : "border-border text-fg-muted",
                )}
              >
                <span className="font-medium">{row.label}</span>
                <span aria-hidden="true">·</span>
                <span className="uppercase tracking-wide">{row.state}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="flex items-start gap-1.5 text-[0.7rem] leading-5 text-fg-muted">
          <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          {boundary.credentialNote} A device action would pass Phase 17 preparation, governance, human
          authority, and a validated session before any runtime could ever execute it.
        </p>
      </div>
    </PlatformRegion>
  );
}
