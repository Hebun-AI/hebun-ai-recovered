import { Lock } from "lucide-react";
import type { SecurityCenterModel } from "@/features/security-center";
import { SecurityRegion, SecurityStatusPill } from "./security-region";

/*
 * Device Security (UI refinement) — the real, disconnected Phase 18 boundary. Shows Runtime Not
 * connected, 0 registered, 0 trusted, Computer Use Not enabled, sensitive capabilities Restricted.
 * No fabricated device, hostname, IP, OS, device id, or connection. "0 devices" is infrastructure
 * state, not a security warning.
 */

export function SecurityDevice({ model }: { model: SecurityCenterModel }) {
  const d = model.deviceSecurity;
  return (
    <SecurityRegion eyebrow="Endpoint posture (Phase 18)" title="Device Security" action={<SecurityStatusPill label="Not connected" />}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-fg-muted">Device Runtime</dt>
        <dd className="font-semibold text-fg">{d.runtimeConnected ? "Connected" : "Not connected"}</dd>
        <dt className="text-fg-muted">Registered</dt>
        <dd className="font-semibold text-fg">{d.registeredDevices}</dd>
        <dt className="text-fg-muted">Trusted</dt>
        <dd className="font-semibold text-fg">{d.trustedDevices}</dd>
        <dt className="text-fg-muted">Computer Use</dt>
        <dd className="font-semibold text-fg">Not enabled</dd>
        <dt className="text-fg-muted">Sensitive capabilities</dt>
        <dd className="font-semibold text-warning">{d.sensitiveCapabilitiesRestricted ? "Restricted" : "—"}</dd>
      </dl>
      <p className="mt-2 flex items-start gap-1.5 text-[0.7rem] leading-5 text-fg-muted">
        <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        No device, hostname, IP, or OS is fabricated. Zero devices is infrastructure state, not a warning.
      </p>
    </SecurityRegion>
  );
}
