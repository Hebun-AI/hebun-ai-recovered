/*
 * governed-machine-execution/machine-execution-control.server.ts — the Director's kill switch for
 * machine-triggered governed internal execution (RUNG 1).
 *
 * ── IT IS A KEY, NOT A SUBSYSTEM ─────────────────────────────────────────────
 *
 * `provider_connectivity_controls` already carries one row per controllable capability, and
 * `resolveDirectorEnabled` already reads it fail-closed. This module adds a KEY and nothing else:
 * no table, no migration, no writer, no schedule, no quota, no tenant policy and no allowlist
 * infrastructure. Inventing controls before the capability they control has run once would be
 * building governance out of imagination rather than evidence.
 *
 * ── WHY ITS OWN KEY AND NOT AN EXISTING ONE ──────────────────────────────────
 *
 * Sharing `external-send`'s switch would mean a Director stopping unattended internal execution
 * also stops human-authorized email, and a Director arming email silently arms unattended
 * execution. Sharing `provider-observation-read` would tie a WRITE to a READ control. Neither
 * coupling was ever decided by anybody; it would simply be a consequence of reusing a string.
 *
 *     ONE CONTROL, ONE CAPABILITY.
 *
 * ── FAIL CLOSED, INCLUDING ON ABSENCE ────────────────────────────────────────
 *
 * There is no row for this key in any deployment today, and `resolveDirectorEnabled` answers
 * `false` for a missing row, an unreachable control plane and any error alike. So the released
 * default is DISARMED, and it is disarmed by the absence of a decision rather than by a decision to
 * disarm — which is the correct direction for a capability that acts without a human present.
 *
 * ── THERE IS NO WRITER HERE, ON PURPOSE ──────────────────────────────────────
 *
 * R5.1 removed the generic arming writer because it resolved authority through a role scoped to the
 * wrong tenant. Arming is changed by the deployment-possession ceremony, and this module does not
 * reintroduce a way around it.
 *
 * Server-only.
 */
import {
  resolveDirectorEnabled,
  type ProviderConnectivityControlRepository,
} from "@/features/heby-provider-ops/provider-connectivity-control.server";

/** The control-plane row that arms machine-triggered governed internal execution. */
export const MACHINE_INTERNAL_EXECUTION_CONTROL_KEY = "machine-internal-execution" as const;

export interface MachineExecutionControlDeps {
  /** Injectable for tests. `null` means "no durable authority", which fails closed. */
  readonly repo?: ProviderConnectivityControlRepository | null;
}

/**
 * The fail-closed arming read, performed BEFORE a principal is minted and before any permit is
 * touched — so a disarmed deployment never burns an authorization to discover it is disarmed.
 *
 * Read once rather than twice, unlike external send. That seam reads again immediately before the
 * adapter call because a provider dispatch leaves the process and cannot be rolled back; here the
 * whole act lives inside one transaction, so a Director who flips the switch mid-execution either
 * flipped it before this read or after a commit that was atomic anyway.
 */
export function resolveMachineInternalExecutionEnabled(
  deps: MachineExecutionControlDeps = {},
): Promise<boolean> {
  return resolveDirectorEnabled(MACHINE_INTERNAL_EXECUTION_CONTROL_KEY, deps);
}
