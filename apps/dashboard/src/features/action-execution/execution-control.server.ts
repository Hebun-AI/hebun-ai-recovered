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
 * ── READ-ONLY SINCE R5.1 ─────────────────────────────────────────────────────
 *
 * `setExternalSendDirectorEnabled` is gone. R3B added it because the switch could otherwise only be
 * flipped by hand-written SQL, and that reasoning still holds — but the authority it was given was
 * wrong. It shared R2E's `resolveProviderControlAuthority`, which resolves a role through
 * `roles.tenant_id` (NOT NULL) against the session's tenant, so one tenant's owner could arm or
 * disarm outbound sending for every tenant. R5.1 moved the write to the deployment-possession
 * ceremony (`npm run provider:connectivity`) rather than widening the authority to match the row.
 *
 * ARMING'S CONFIGURATION GATE MOVED WITH THE WRITE, and did not weaken. The ceremony refuses to
 * enable `external-send` unless credential, sender and subject are all present, using this feature's
 * own `isExternalSendConfigured` — not a second copy of it. Disarming stays unconditional, for the
 * same reason it always was: a kill switch that could not be turned off under a degraded
 * configuration would be the wrong failure direction.
 *
 * Server-only.
 */
import {
  resolveDirectorEnabled,
  type ProviderConnectivityControlRepository,
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

/*
 * THE ARMING WRITER IS GONE (R5.1) — and so is the generic repository write it stood on.
 *
 * R3B's reason for having a writer was sound: the switch could otherwise only be flipped by
 * hand-written SQL, with no refusal and no confirmation. What was wrong was WHERE it lived. It was
 * reachable from a server action gated by a tenant-scoped role, so one tenant's owner could arm
 * outbound sending for every tenant on the deployment.
 *
 * The write now lives in `scripts/lib/provider-connectivity.ts` under deployment possession, which
 * keeps every property R3B wanted — a refusal, an explicit confirmation, a closed provider
 * vocabulary, and the configuration gate — while removing the one it should never have had.
 * Nothing under `src/` can write the row at all, so this module is a pure READ of the switch,
 * exactly as the execution runtime always treated it.
 */
