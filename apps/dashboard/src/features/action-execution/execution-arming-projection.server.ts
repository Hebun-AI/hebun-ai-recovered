/*
 * action-execution/execution-arming-projection.server.ts — the truthful, secret-free read model for
 * the external-send arming boundary (Providers & Models → Resend).
 *
 * ── THE STATES THIS SURFACE REFUSES TO COLLAPSE ──────────────────────────────
 *
 *   MAPPED ≠ CONFIGURED ≠ ARMED ≠ AUTHORIZED ≠ EXECUTED ≠ ACCEPTED ≠ DELIVERED
 *
 * This projection answers only the first three. Authorization is a permit, execution is an attempt,
 * acceptance is a provider response, and delivery is unprovable — none of them belong here, and
 * none is inferred from an enabled switch.
 *
 * ── WHAT IS PERSISTED, AND WHAT IS DERIVED ───────────────────────────────────
 *
 *   PERSISTED   the Director's arming permission — one row in `provider_connectivity_controls`,
 *               the SAME authority R2E established for Claude. There is no second table, no second
 *               kill switch, and no mirrored copy of it anywhere.
 *   DERIVED     configuration completeness, read from server environment at request time.
 *
 * Configuration is deliberately NOT persisted. A database mirror of what the environment says is a
 * second source of truth that goes stale the moment a deployment changes, and the stale copy is the
 * one a surface would show. Deriving it costs three string reads and cannot drift.
 *
 * ── WHAT HEBUN REFUSES TO CLAIM ──────────────────────────────────────────────
 *
 * `senderDomainVerification` is a constant: Resend is the authority on whether a sending domain is
 * verified, Hebun performs no check, and inventing a "Verified" badge from the presence of a
 * configured address would be a fabricated fact. Same reasoning as R2E's `connectivity:
 * "not-recorded"`, and the same wording discipline.
 *
 * Server-only. Reads are inert: no I/O beyond the durable control read, and no transport is built.
 */
import {
  RESEND_ADAPTER_ID,
  RESEND_SEND_ENDPOINT,
  isExternalSendCredentialPresent,
  resolveExternalSendSender,
  resolveExternalSendSubject,
} from "@/features/action-execution-live/resend-email-transport.server";
import {
  resolveExternalSendReachability,
  type ExternalSendReachabilityDeps,
} from "@/features/tenant-external-send-authority/resolve-external-send-reachability.server";
import { EXTERNAL_SEND_PROVIDER_KEY } from "./contracts";
import { resolveExternalSendEnabled, type ExecutionControlDeps } from "./execution-control.server";

/**
 * The three states this phase exists to keep apart.
 *
 * `unconfigured` wins over the Director permission on purpose: a switch that is ON while the
 * deployment cannot send is NOT armed, and showing "Armed" there would be the exact collapse this
 * surface prevents. The raw permission stays visible alongside it as `directorEnabled`, so an
 * enabled-but-unconfigured deployment is legible rather than hidden.
 */
export type ExternalSendArmingState = "unconfigured" | "configured-disarmed" | "armed";

/**
 * TENANT-ARM-1 — WHAT THIS ORGANIZATION HOLDS, beside what the deployment holds.
 *
 * `not-established` is NOT "not armed". It is the honest answer when this surface was rendered
 * without an authenticated tenant context, or when the arming authority could not be read. An
 * outage and an absence of context must never be shown as a decision somebody made.
 */
export type TenantExternalSendArming =
  | "armed"
  | "never-armed"
  | "withdrawn"
  | "not-established";

export interface ExternalSendOpsView {
  readonly providerLabel: string;
  readonly providerKey: string;
  /** The frozen provider host. Configuration cannot move it; shown so the surface is auditable. */
  readonly providerEndpoint: string;
  readonly adapterId: string;
  /** The Director's durable permission, exactly as stored. */
  readonly directorEnabled: boolean;
  readonly directorControl: "enabled" | "disabled";
  /** PRESENCE only of the API key — never the value, prefix, or length. */
  readonly credential: "present" | "missing";
  /** PRESENCE only. The address itself is deployment configuration and is not surfaced. */
  readonly sender: "configured" | "missing";
  /** PRESENCE only, for symmetry — the subject is not secret but is not this surface's business. */
  readonly subject: "configured" | "missing";
  /** All three present, or not. */
  readonly configuration: "configured" | "needs-configuration";
  /**
   * THE DEPLOYMENT HALF ONLY: root permission AND configuration.
   *
   * SINCE TENANT-ARM-1 THIS IS NO LONGER SUFFICIENT FOR ANY SEND. `armed` here means the
   * deployment could send for SOME organization, never that it may send for THIS one. The field
   * keeps its name and its meaning so no released reader silently changes behaviour; the tenant
   * half is a separate field and the composite is `effectiveSend`.
   */
  readonly armingState: ExternalSendArmingState;
  /** THE TENANT HALF: what THIS organization's Governance has decided. Never another tenant's. */
  readonly tenantArming: TenantExternalSendArming;
  /**
   * THE CONJUNCTION THE RUNTIME ACTUALLY BEHAVES AS, for this organization:
   * tenant armed AND root enabled AND deployment configured.
   *
   * `blocked` whenever any half is missing, unknown or off — this field never resolves an
   * uncertainty in the permissive direction.
   */
  readonly effectiveSend: "reachable" | "blocked";
  /** Resend owns this fact. Hebun performs no check and invents no badge. */
  readonly senderDomainVerification: "not-established-by-hebun";
  /** No live check is performed here, so no health is claimed. */
  readonly connectivity: "not-recorded";
  /** No send has been performed by this surface, ever. */
  readonly lastSend: null;
}

export interface ExternalSendOpsViewDeps
  extends ExecutionControlDeps,
    ExternalSendReachabilityDeps {
  readonly env?: Readonly<Record<string, string | undefined>>;
  /**
   * The tenant whose arming to report — read SERVER-SIDE off an authenticated context by the
   * caller, never accepted from a request. `null`/absent yields `not-established`, which blocks.
   */
  readonly tenantId?: string | null;
}

/**
 * Whether deployment has supplied everything the adapter needs.
 *
 * Kept as its own exported predicate because the arming server action needs exactly this question
 * — "could a send even be dispatched?" — and it must be answered by the same code the surface
 * shows, not by a second reimplementation that could disagree with it.
 */
export function isExternalSendConfigured(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    isExternalSendCredentialPresent(env) &&
    resolveExternalSendSender(env) !== null &&
    resolveExternalSendSubject(env) !== null
  );
}

/** Build the truthful arming view. Every field is derived from an authoritative source. */
export async function readExternalSendOpsView(
  deps: ExternalSendOpsViewDeps = {},
): Promise<ExternalSendOpsView> {
  const env = deps.env ?? process.env;
  const directorEnabled = await resolveExternalSendEnabled(deps);
  const configured = isExternalSendConfigured(env);

  /*
   * THE TENANT HALF. Resolved through the SAME composition the executor uses, so this surface
   * cannot drift from the runtime it describes. With no tenant context there is nothing truthful
   * to report, and `not-established` blocks — a surface must not guess a permission.
   */
  const tenantId = (deps.tenantId ?? "").trim();
  let tenantArming: TenantExternalSendArming = "not-established";
  if (tenantId.length > 0) {
    const reach = await resolveExternalSendReachability(tenantId, deps);
    if (reach.status === "reachable") tenantArming = "armed";
    else if (reach.reason === "tenant-not-armed") tenantArming = "never-armed";
    else if (reach.reason === "tenant-arming-withdrawn") tenantArming = "withdrawn";
    /*
     * The composition refuses TENANT-FIRST, so reaching a root refusal PROVES the tenant half was
     * active. Reporting `armed` here is therefore a fact this surface read, not an assumption —
     * and `effectiveSend` below still blocks, because the root half is off.
     */
    else if (reach.reason === "root-control-disabled") tenantArming = "armed";
    else tenantArming = "not-established";
  }

  const armingState: ExternalSendArmingState = !configured
    ? "unconfigured"
    : directorEnabled
      ? "armed"
      : "configured-disarmed";

  return {
    providerLabel: "Resend",
    providerKey: EXTERNAL_SEND_PROVIDER_KEY,
    providerEndpoint: RESEND_SEND_ENDPOINT,
    adapterId: RESEND_ADAPTER_ID,
    directorEnabled,
    directorControl: directorEnabled ? "enabled" : "disabled",
    credential: isExternalSendCredentialPresent(env) ? "present" : "missing",
    sender: resolveExternalSendSender(env) !== null ? "configured" : "missing",
    subject: resolveExternalSendSubject(env) !== null ? "configured" : "missing",
    configuration: configured ? "configured" : "needs-configuration",
    armingState,
    tenantArming,
    effectiveSend:
      armingState === "armed" && tenantArming === "armed" ? "reachable" : "blocked",
    senderDomainVerification: "not-established-by-hebun",
    connectivity: "not-recorded",
    lastSend: null,
  };
}
