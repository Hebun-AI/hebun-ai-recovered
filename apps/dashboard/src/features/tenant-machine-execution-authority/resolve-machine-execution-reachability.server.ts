/*
 * resolve-machine-execution-reachability.server.ts — THE COMPOSITION, AND NOTHING ELSE.
 *
 * ── IT COMPOSES; IT DOES NOT OWN ────────────────────────────────────────────
 *
 * Two authorities already exist and both keep their state exactly where it is:
 *
 *   TENANT PARTICIPATION   `tenant_machine_execution_authorizations`, written only under a tenant
 *                          Governance decision by a named human.
 *   DEPLOYMENT REACH       `provider_connectivity_controls`, root-scoped, written only by the
 *                          possession ceremony, read by `resolveDirectorEnabled`.
 *
 * This module reads both and returns one answer. It stores nothing, writes nothing and caches
 * nothing, so it cannot become a third source of truth — which is the failure mode a convenience
 * facade invites and the reason this file is as small as it is.
 *
 *     effective reachability = supported capability
 *                              AND tenant (organization) active          — APF-1
 *                              AND tenant authorization active
 *                              AND root control enabled
 *
 * ── THE ORDER IS PART OF THE CONTRACT ───────────────────────────────────────
 *
 * TRH-25's revalidator recorded the rule this follows: "'You took this away' and 'an operator
 * paused everything' are different facts and the more specific one must win — a disabled switch
 * must never be able to disguise a withdrawal."
 *
 * So the tenant's own state is resolved FIRST. If an organization withdrew its participation, that
 * is what a reader is told, whether or not an operator also happens to have stopped the world. The
 * reverse order would make every withdrawal look like an outage for as long as the root switch
 * stayed off, and the audit question "did they take it back, or was it never on?" would become
 * unanswerable at exactly the moment somebody needed to ask it.
 *
 * The capability check comes before both, because an unsupported capability is not a question
 * about anybody's permission.
 *
 * ── FAIL CLOSED AT EVERY BRANCH ─────────────────────────────────────────────
 *
 * There is no value of any input, and no failure of either authority, that yields `reachable`.
 * Absent tenant row, withdrawn tenant row, unreadable control plane, absent root row, disabled root
 * row and unknown capability all refuse — and `director_enabled` defaults to false in the schema,
 * so an unarmed deployment is closed by its own column default rather than by this file.
 *
 * ── WHAT IT STILL DOES NOT PROVE ────────────────────────────────────────────
 *
 *     REACHABLE != ELIGIBLE != AUTHORIZED != EXECUTED
 *
 * Reachable says the control plane permits the capability to be CONSIDERED for this tenant. It says
 * nothing about whether an exact permit exists, whether a human authorized that act, or whether
 * anything ran. Those remain owned by `action_permits`, its Governance decision, and the executor's
 * own atomic spend — all of which still apply in full afterwards.
 *
 * Server-only.
 */
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "@/features/governed-machine-execution/contracts";
import { resolveMachineInternalExecutionEnabled } from "@/features/governed-machine-execution/machine-execution-control.server";
import type { MachineExecutionControlDeps } from "@/features/governed-machine-execution/machine-execution-control.server";
import {
  readEffectiveTenantMachineExecution,
  type TenantMachineExecutionReadDeps,
} from "./read-tenant-machine-execution.server";
import type { MachineExecutionReachability } from "./contracts";
import { getControlPlaneDb } from "@/db/client.server";
import { isTenantOnboardingEligible } from "@/features/auth-runtime/identity-repository.server";

export interface MachineExecutionReachabilityDeps
  extends TenantMachineExecutionReadDeps,
    MachineExecutionControlDeps {
  /** Injectable so the composition is provable without a control-plane database. */
  readonly rootEnabled?: (deps: MachineExecutionControlDeps) => Promise<boolean>;
  readonly readTenant?: typeof readEffectiveTenantMachineExecution;
  /** Injectable so tenant lifecycle is provable without a control-plane database. */
  readonly tenantActive?: (tenantId: string) => Promise<boolean>;
}

/*
 * IS THE ORGANIZATION ITSELF ACTIVE? Read through `isTenantOnboardingEligible`, the ONE predicate
 * over `companies` lifecycle that the session gate and the pre-tenant flows already share (R4B):
 * only `active` (or the legacy NULL) admits activity. Its name says onboarding; its question is
 * "may this tenant accept activity right now", which is exactly this one. Reusing it is the point —
 * a second copy of "which statuses count" is how a machine would act for a suspended tenant that
 * no human can sign in to.
 */
async function defaultTenantActive(
  tenantId: string,
  getDb: TenantMachineExecutionReadDeps["getDb"],
): Promise<boolean> {
  const db = getDb ? getDb() : getControlPlaneDb();
  if (!db) throw new Error("tenant lifecycle unreadable");
  return isTenantOnboardingEligible(db, tenantId);
}

/**
 * Is machine execution reachable for this tenant and capability RIGHT NOW?
 *
 * The tenant id must be one the caller READ off an authoritative row — a permit — never one it
 * chose or accepted from a request. See the read seam's header for why that distinction is what
 * makes a bare tenant id safe here.
 */
export async function resolveMachineExecutionReachability(
  tenantId: string,
  capabilityKey: string,
  deps: MachineExecutionReachabilityDeps = {},
): Promise<MachineExecutionReachability> {
  /*
   * 1 · IS THIS A CAPABILITY ANY MACHINE MAY EXECUTE?
   *
   * The released frozen set is the authority, consulted rather than restated. A capability outside
   * it is refused before either permission is read — no organization's grant and no operator's
   * switch can widen what a machine may do.
   */
  const capability = (capabilityKey ?? "").trim();
  if (!MACHINE_EXECUTABLE_ACTION_KINDS.has(capability)) {
    return { status: "refused", reason: "unsupported-machine-capability" };
  }

  /*
   * 2 · IS THE ORGANIZATION ACTIVE AT ALL? (APF-1)
   *
   * Before its machine-execution grant, because a suspended organization's grant is moot — and a
   * suspension is the most specific thing a reader can be told. An unreadable lifecycle refuses as
   * `persistence-unavailable`, never as "not active": an outage is not a suspension.
   */
  let active: boolean;
  try {
    active = await (deps.tenantActive ?? ((id: string) => defaultTenantActive(id, deps.getDb)))(tenantId);
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
  if (!active) return { status: "refused", reason: "tenant-not-active" };

  /* 3 · THE TENANT'S OWN GRANT — see the header for why specificity wins. */
  const tenant = await (deps.readTenant ?? readEffectiveTenantMachineExecution)(
    tenantId,
    capability,
    deps.getDb ? { getDb: deps.getDb } : {},
  );

  if (tenant.status === "unavailable") {
    return { status: "refused", reason: "persistence-unavailable" };
  }
  if (tenant.status === "absent") {
    return { status: "refused", reason: "tenant-not-authorized" };
  }
  if (tenant.effective.state !== "active") {
    return { status: "refused", reason: "tenant-authorization-withdrawn" };
  }

  /*
   * 4 · THE DEPLOYMENT'S MASTER STOP, LAST.
   *
   * `resolveMachineInternalExecutionEnabled` answers `false` for an absent row, an unreachable
   * control plane and any error alike, so an unreadable switch stops execution rather than
   * permitting it. Its ownership is untouched: this module calls the released reader and adds no
   * second way to change or interpret that state.
   */
  const rootEnabled = await (deps.rootEnabled ?? resolveMachineInternalExecutionEnabled)(
    deps.repo !== undefined ? { repo: deps.repo } : {},
  );
  if (!rootEnabled) return { status: "refused", reason: "root-control-disabled" };

  return { status: "reachable" };
}
