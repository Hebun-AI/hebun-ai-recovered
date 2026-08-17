/*
 * action-execution/execution-control.server.ts — the durable Director ON/OFF authority for
 * OUTBOUND EXTERNAL SENDS (R3B).
 *
 * ── A ROW, NOT A TABLE ───────────────────────────────────────────────────────
 *
 * `provider_connectivity_controls` is already keyed by `provider_key` with a unique constraint,
 * already has a durable Director-owned writer, and already fails closed on a missing row, a
 * missing database, or any read error. Building a second kill-switch table would create two places
 * that answer "may Hebun reach the outside" — and the failure mode of two switches is that
 * somebody flips the wrong one and believes the system is off.
 *
 * ── WHY NOT THE `claude` ROW ─────────────────────────────────────────────────
 *
 * Model connectivity and outbound sending are different permissions with different blast radii.
 * Enabling Hebun to THINK must never thereby have enabled it to ACT. The two rows are independent,
 * and nothing here reads, writes or touches `claude`.
 *
 * ── GLOBAL, AND HONESTLY SO ──────────────────────────────────────────────────
 *
 * The row has no tenant column, matching a system-owned credential: one switch, one sender, all
 * tenants. That is coherent for generation one and wrong for a customer product — pausing one
 * tenant pauses everyone. It is recorded as a limitation rather than hidden behind a per-tenant
 * shape the credential model cannot honour.
 *
 * Server-only.
 */
import {
  getProviderConnectivityControlRepository,
  resolveDirectorEnabled,
  type ProviderConnectivityControl,
  type ProviderConnectivityControlRepository,
  type ProviderControlActor,
} from "@/features/heby-provider-ops/provider-connectivity-control.server";
import { EXTERNAL_SEND_PROVIDER_KEY } from "./contracts";

export interface ExecutionControlDeps {
  /** Injectable for tests. `null` means "no durable authority", which fails closed. */
  readonly repo?: ProviderConnectivityControlRepository | null;
}

/**
 * The fail-closed execution kill-switch read.
 *
 * Called TWICE per execution, deliberately:
 *   1. before the permit is spent — so a disabled switch never burns an authorization;
 *   2. immediately before the adapter call — so a Director who flips it mid-execution is obeyed.
 *
 * Two reads rather than one cached value: caching it would mean the window between commit and
 * dispatch is governed by a fact that was true earlier, which is exactly when someone reaching for
 * the switch most needs it to work.
 */
export function resolveExternalSendEnabled(deps: ExecutionControlDeps = {}): Promise<boolean> {
  return resolveDirectorEnabled(EXTERNAL_SEND_PROVIDER_KEY, deps);
}

/**
 * THE ARMING WRITER — the only way an `external-send` control row can come into existence.
 *
 * ── WHY THIS EXISTS, AND WHY IT IS NOT A GENERALIZATION ──────────────────────
 *
 * R3B shipped the external-send kill-switch READ (`resolveExternalSendEnabled`) without a writer,
 * so the switch could only ever be flipped by hand-written SQL — which carries no authority check,
 * no actor attribution, and no server-side refusal. That is the gap this closes.
 *
 * The underlying repository operation has always been generic: `setDirectorEnabled(providerKey, …)`
 * takes any key. What was missing was a SECOND TYPED WRAPPER beside `setClaudeDirectorEnabled`,
 * and that is deliberately what this is. The provider key is a frozen module constant, so no
 * caller — and no client — can mint a control row for an arbitrary provider string. Two named
 * wrappers over one generic repository is the same shape R2E established; widening the seam to
 * accept a caller-supplied key would turn a closed vocabulary into an open one for no benefit.
 *
 * It does NOT decide whether arming is ALLOWED. Configuration completeness and actor authority are
 * the caller's gates (see the platform server action): this function is the durable write, and a
 * write that also adjudicated policy would be two authorities in one place.
 *
 * Server-only.
 */
export function setExternalSendDirectorEnabled(
  enabled: boolean,
  actor?: ProviderControlActor,
): Promise<ProviderConnectivityControl> {
  return getProviderConnectivityControlRepository().setDirectorEnabled(
    EXTERNAL_SEND_PROVIDER_KEY,
    enabled,
    actor,
  );
}
