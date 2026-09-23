/*
 * resolve-external-send-reachability.server.ts — THE COMPOSITION, AND NOTHING ELSE.
 *
 * ── IT COMPOSES; IT DOES NOT OWN ────────────────────────────────────────────
 *
 * Two authorities exist and both keep their state exactly where it is:
 *
 *   TENANT ARMING     `tenant_external_send_authorizations`, written only under a tenant
 *                     Governance decision by a named human.
 *   DEPLOYMENT REACH  `provider_connectivity_controls` ('external-send'), root-scoped, written
 *                     only by the possession ceremony, read by `resolveExternalSendEnabled`.
 *
 * This module reads both and returns one answer. It stores nothing, writes nothing and caches
 * nothing, so it cannot become a third source of truth — which is the failure mode a convenience
 * facade invites and the reason this file is as small as it is.
 *
 *     effective external-send arming = tenant arming active AND root control enabled
 *
 * NOTHING ELSE IS CONSULTED HERE, AND THAT IS DELIBERATE. A credential does not appear. A provider
 * connection does not appear. A capability descriptor does not appear. Another tenant's state
 * cannot appear — the read seam has no code path that returns a row for a tenant other than the
 * one asked for. Being able to send is never inferred from being able to connect.
 *
 * ── THE ORDER IS PART OF THE CONTRACT ───────────────────────────────────────
 *
 * The machine sibling recorded the rule, inherited from TRH-25: "'You took this away' and 'an
 * operator paused everything' are different facts and the more specific one must win — a disabled
 * switch must never be able to disguise a withdrawal."
 *
 * So the tenant's own state is resolved FIRST. If an organization's arming was withdrawn, that is
 * what a reader is told, whether or not an operator also happens to have stopped the world. The
 * reverse order would make every withdrawal look like an outage for as long as the root switch
 * stayed off, and the audit question "did they take it back, or was it never on?" would become
 * unanswerable at exactly the moment somebody needed to ask it.
 *
 * ── FAIL CLOSED AT EVERY BRANCH ─────────────────────────────────────────────
 *
 * There is no value of any input, and no failure of either authority, that yields `reachable`.
 * An empty tenant id, a malformed tenant id, an absent tenant row, a withdrawn tenant row, an
 * unreadable control plane, an absent root row and a disabled root row ALL refuse — and
 * `director_enabled` defaults to false in the schema, so an unarmed deployment is closed by its
 * own column default rather than by this file.
 *
 * LEGACY GLOBAL STATE CANNOT AUTHORIZE A TENANT. The root row existing and saying `true` is the
 * SECOND conjunct, never the first and never sufficient. Every deployment that was globally armed
 * before this phase now has zero armed tenants until a named human arms each one through
 * Governance — which is the fail-closed direction, and is the whole point.
 *
 * ── WHAT IT STILL DOES NOT PROVE ────────────────────────────────────────────
 *
 *     ARMED != CONFIGURED != AUTHORIZED != EXECUTED != ACCEPTED != DELIVERED
 *
 * Reachable says the control plane permits this organization's sends to be CONSIDERED. It says
 * nothing about whether the deployment is configured to send, whether an exact permit exists,
 * whether a human authorized that act, or whether anything ran. Those remain owned by the
 * environment, `action_permits`, its Governance decision, and the executor's own atomic spend —
 * all of which still apply in full afterwards.
 *
 * Server-only.
 */
import {
  resolveExternalSendEnabled,
  type ExecutionControlDeps,
} from "@/features/action-execution/execution-control.server";
import {
  readEffectiveTenantExternalSend,
  type TenantExternalSendReadDeps,
} from "./read-tenant-external-send.server";
import type { ExternalSendReachability } from "./contracts";

export interface ExternalSendReachabilityDeps
  extends TenantExternalSendReadDeps,
    ExecutionControlDeps {
  /** Injectable so the composition is provable without a control-plane database. */
  readonly rootEnabled?: (deps: ExecutionControlDeps) => Promise<boolean>;
  readonly readTenant?: typeof readEffectiveTenantExternalSend;
}

/**
 * Is outbound external sending reachable for THIS TENANT right now?
 *
 * The tenant id must be one the caller READ off an authenticated `TenantContext` — never one it
 * chose, and never one accepted from a request body. See the read seam's header for why that
 * distinction is what makes a bare tenant id safe here.
 */
export async function resolveExternalSendReachability(
  tenantId: string,
  deps: ExternalSendReachabilityDeps = {},
): Promise<ExternalSendReachability> {
  /* 1 · THE TENANT'S OWN STATE, FIRST — see the header for why specificity wins. */
  const tenant = await (deps.readTenant ?? readEffectiveTenantExternalSend)(
    tenantId,
    deps.getDb ? { getDb: deps.getDb } : {},
  );

  if (tenant.status === "unavailable") {
    return { status: "refused", reason: "persistence-unavailable" };
  }
  if (tenant.status === "absent") {
    return { status: "refused", reason: "tenant-not-armed" };
  }
  if (tenant.effective.state !== "active") {
    return { status: "refused", reason: "tenant-arming-withdrawn" };
  }

  /*
   * 2 · THE DEPLOYMENT'S MASTER STOP, SECOND.
   *
   * `resolveExternalSendEnabled` answers `false` for an absent row, an unreachable control plane
   * and any error alike, so an unreadable switch stops sending rather than permitting it. Its
   * ownership is untouched: this module calls the released reader and adds no second way to change
   * or interpret that state.
   */
  const rootEnabled = await (deps.rootEnabled ?? resolveExternalSendEnabled)(
    deps.repo !== undefined ? { repo: deps.repo } : {},
  );
  if (!rootEnabled) return { status: "refused", reason: "root-control-disabled" };

  return { status: "reachable" };
}
