/*
 * Global provider connectivity — the R5.1 ceremony, separated from the CLI so a real database can
 * prove its semantics without driving an interactive prompt.
 *
 * ── WHAT THIS IS, AND WHY IT MOVED HERE ──────────────────────────────────────
 *
 * `provider_connectivity_controls` is a ROOT-SCOPED table: it spreads `rootColumns`, it has no
 * `tenant_id`, and `provider_connectivity_controls_provider_key_uq` makes exactly one row exist per
 * provider key for the whole deployment. One row governs every tenant.
 *
 * Until R5.1 the only writer was a server action gated by `resolveProviderControlAuthority`, which
 * resolved the actor's role with `and(eq(roles.id, roleId), eq(roles.tenantId, tenantId))`. That
 * predicate is deliberately tenant-confining — it exists so a client cannot claim a role in another
 * tenant — and `roles.tenant_id` is NOT NULL, so the authority it produces is tenant-scoped by
 * construction. A tenant-confined authority was therefore gating an unconfined write: an `owner` of
 * one tenant could stop, or start, every other tenant's provider connectivity. Canonical carried the
 * evidence rather than the hypothesis — the live row's `updated_by` belonged to a human whose only
 * membership was in Globex, and the row it had moved 29 times governed Acme too.
 *
 * The global SCOPE is correct: one deployment holds one provider account, one credential and one
 * runtime, so there is exactly one thing to turn off. What was wrong was the authority. R5.1 moves
 * the write to the same root R4A, R4B, G2.1 and D1.1 already rest on, and leaves the read exactly
 * where it was.
 *
 * ── THE ROOT OF TRUST ────────────────────────────────────────────────────────
 *
 * Authority is POSSESSION OF THE LOCAL DEPLOYMENT. Hebun cannot cryptographically identify the human
 * at the terminal and does not pretend to. This is NOT a platform admin, NOT a platform operator,
 * NOT a Governance authority, NOT a tenant owner or director, and NOT an authenticated Hebun
 * principal of any kind. No such actor exists yet, and R5.1 does not invent one.
 *
 * That is also why `updated_by` is written as NULL. The column is nullable, and there is no verified
 * actor to name — so it says so. The previous writer recorded a session user id because a session
 * user was the (wrong) authority; recording one here would be a claim no human made.
 *
 * ── WHAT IT DELIBERATELY CANNOT DO ───────────────────────────────────────────
 *
 *   - reach any provider key outside the closed vocabulary below
 *   - touch a credential: it neither reads, prints, writes, rotates nor accepts one
 *   - CREATE a control row for a `disable` — an absent row already reads as disabled everywhere, so
 *     writing one would add a row and change nothing (see `setProviderConnectivity`)
 *   - arm external send without deployment configuration — R3B's refusal moves with the write
 *   - write `audit_log` — a terminal has no actor to attribute, and R5.2 owns that repair
 *   - write any column but `director_enabled`, `updated_at`, `updated_by` and `version`
 *   - touch tenants, users, memberships, roles, sessions, permits, attempts or requests
 *   - run in production, or against a non-local database (the CLI refuses; see the sibling file)
 */
import type { Client } from "pg";
import { CLAUDE_PROVIDER_KEY } from "../../src/features/heby-provider-ops/provider-connectivity-control.server";
import { EXTERNAL_SEND_PROVIDER_KEY } from "../../src/features/action-execution/contracts";
import { isExternalSendConfigured } from "../../src/features/action-execution/execution-arming-projection.server";

/**
 * The closed provider vocabulary.
 *
 * Both values are IMPORTED, never re-declared. They are the only two provider-key constants the
 * repository defines, and each already pins one blast radius: `claude` governs Hebun→Anthropic model
 * generation, `external-send` governs outbound sending. A third key has no constant to come from, so
 * an unknown key is refused rather than silently minting a control row for a provider that does not
 * exist.
 */
export const PROVIDER_KEYS: readonly string[] = Object.freeze([
  CLAUDE_PROVIDER_KEY,
  EXTERNAL_SEND_PROVIDER_KEY,
]);

/** The closed set of transitions. A third verb has no representation here. */
export type ConnectivityTransition = "enable" | "disable";

export const CONNECTIVITY_TRANSITIONS: readonly ConnectivityTransition[] = Object.freeze([
  "enable",
  "disable",
]);

export interface ProviderControlSummary {
  readonly providerKey: string;
  readonly directorEnabled: boolean;
  readonly version: number;
  readonly updatedAt: string;
  /** Null whenever this ceremony wrote the row: deployment possession has no verified actor. */
  readonly updatedBy: string | null;
}

export type ConnectivityRefusal =
  /** The provider key is not one of the two the repository defines. */
  | "unknown-provider-key"
  /**
   * The control already holds the requested state. An ABSENT row counts as disabled, so `disable`
   * on a provider that has no row is refused here rather than creating one — the state is already
   * what the operator asked for, and a row that changes no reader's answer is not worth minting.
   */
  | "already-in-that-state"
  /**
   * Enabling `external-send` without a credential, sender and subject. R3B refused this at the
   * server action; the refusal belongs to whoever holds the write, so it moved with it. Arming a
   * deployment that cannot send produces a switch reading "on" whose only function is to mislead
   * the next reader. Disabling is never refused for this reason.
   */
  | "configuration-incomplete";

export type ConnectivityOutcome =
  | { readonly status: "changed"; readonly control: ProviderControlSummary }
  | { readonly status: "refused"; readonly reason: ConnectivityRefusal };

export function isProviderKey(value: string | undefined): boolean {
  return PROVIDER_KEYS.includes((value ?? "").trim());
}

export function isTransition(value: string | undefined): value is ConnectivityTransition {
  return CONNECTIVITY_TRANSITIONS.includes((value ?? "").trim() as ConnectivityTransition);
}

type ControlRow = {
  provider_key: string;
  director_enabled: boolean;
  version: number;
  updated_at: Date | string;
  updated_by: string | null;
};

function summarize(row: ControlRow): ProviderControlSummary {
  return {
    providerKey: row.provider_key,
    directorEnabled: row.director_enabled,
    version: row.version,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
    updatedBy: row.updated_by,
  };
}

/**
 * Read one control by provider key, or `undefined` when no row exists.
 *
 * `undefined` and `directorEnabled: false` are DIFFERENT facts here even though every runtime reader
 * collapses them to "disabled": the CLI shows the operator which one they are looking at, because
 * "no row yet" and "explicitly turned off" are different things to have done.
 */
export async function readProviderControl(
  client: Client,
  providerKey: string,
): Promise<ProviderControlSummary | undefined> {
  const result = await client.query<ControlRow>(
    `select provider_key, director_enabled, version, updated_at, updated_by
       from provider_connectivity_controls
      where provider_key = $1
      limit 1`,
    [(providerKey ?? "").trim()],
  );
  const row = result.rows[0];
  return row ? summarize(row) : undefined;
}

/**
 * Set the global Director permission for one provider.
 *
 * ── WHY THE PREDICATE IS ON THE UPDATE ───────────────────────────────────────
 *
 * `where provider_connectivity_controls.director_enabled is distinct from $2` sits inside the
 * `on conflict do update`, not in a read-then-write. Two concurrent operators asking for the same
 * state therefore cannot both report success: the loser updates zero rows, returns nothing, and
 * refuses. The same shape `suspendTenant` and `retireExternalRecipient` already use.
 *
 * ── WHY `disable` NEVER CREATES A ROW ────────────────────────────────────────
 *
 * `resolveDirectorEnabled` treats a missing row and `false` identically — both are disabled, and
 * both fail closed. So inserting a `false` row would change no reader's answer while adding a row
 * that did not exist. The absent case is refused as `already-in-that-state` BEFORE any statement
 * runs, which is also what keeps this ceremony from silently minting an `external-send` control row
 * as a side effect of an unrelated command.
 *
 * ── WHAT IS WRITTEN ──────────────────────────────────────────────────────────
 *
 * Exactly four columns move, and the set is the whole contract: the permission, when it changed,
 * who changed it (NULL — see the header), and the optimistic version. `created_by`,
 * `created_by_type`, `updated_by_type`, `lifecycle_status` and every deletion column stay as they
 * were. `updated_by_type` in particular is left alone deliberately: R5.2 owns actor-type provenance
 * and the human-only constraint that would rest on it, and writing a type here without an actor
 * would be the fabrication that gate exists to prevent.
 */
export async function setProviderConnectivity(
  client: Client,
  input: {
    readonly providerKey: string;
    readonly enabled: boolean;
    readonly env?: Readonly<Record<string, string | undefined>>;
  },
): Promise<ConnectivityOutcome> {
  const providerKey = (input?.providerKey ?? "").trim();
  const enabled = input?.enabled === true;
  const env = input?.env ?? process.env;

  if (!isProviderKey(providerKey)) return { status: "refused", reason: "unknown-provider-key" };

  const existing = await readProviderControl(client, providerKey);

  /* An absent row is already disabled. Refuse rather than mint a row that changes nothing. */
  if (!existing && !enabled) return { status: "refused", reason: "already-in-that-state" };
  if (existing && existing.directorEnabled === enabled) {
    return { status: "refused", reason: "already-in-that-state" };
  }

  /*
   * R3B's configuration gate, moved with the write. Only ENABLING is gated: a kill switch that
   * could not be turned off under a degraded configuration would be the wrong failure direction.
   */
  if (enabled && providerKey === EXTERNAL_SEND_PROVIDER_KEY && !isExternalSendConfigured(env)) {
    return { status: "refused", reason: "configuration-incomplete" };
  }

  const updated = await client.query<ControlRow>(
    `insert into provider_connectivity_controls (provider_key, director_enabled)
          values ($1, $2)
     on conflict (provider_key) do update
            set director_enabled = $2,
                updated_at = now(),
                updated_by = null,
                version = provider_connectivity_controls.version + 1
          where provider_connectivity_controls.director_enabled is distinct from $2
      returning provider_key, director_enabled, version, updated_at, updated_by`,
    [providerKey, enabled],
  );

  const row = updated.rows[0];
  /* Zero rows means a concurrent operator reached the desired state first. Nothing was changed. */
  if (!row) return { status: "refused", reason: "already-in-that-state" };
  return { status: "changed", control: summarize(row) };
}
