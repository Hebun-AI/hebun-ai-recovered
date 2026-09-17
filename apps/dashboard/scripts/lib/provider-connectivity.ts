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
 * Stated as doctrine (R5.2 Gate A): this root is a SOURCE, not an ACTOR. A trust root can be
 * authoritative for CAUSING an operation without identifying the human who operated it. `updated_by`
 * and `updated_by_type` are therefore left NULL TOGETHER — an actor type without an actor id is
 * false attribution under Hebun's both-or-neither invariant, not partial attribution.
 *
 * ── WHAT IT DELIBERATELY CANNOT DO ───────────────────────────────────────────
 *
 *   - reach any provider key outside the closed vocabulary below
 *   - touch a credential: it neither reads, prints, writes, rotates nor accepts one
 *   - CREATE a control row for a `disable` — an absent row already reads as disabled everywhere, so
 *     writing one would add a row and change nothing (see `setProviderConnectivity`)
 *   - arm external send without deployment configuration — R3B's refusal moves with the write
 *   - write `audit_log` — `actor_id` and `actor_type` are NOT NULL and a terminal has no actor to
 *     attribute. Blocked on a real platform principal, not on an audit-hardening phase
 *   - write any column but `director_enabled`, `updated_at`, `updated_by` and `version`
 *   - touch tenants, users, memberships, roles, sessions, permits, attempts or requests
 *   - run in production, or against a non-local database (the CLI refuses; see the sibling file)
 */
import type { Client } from "pg";
import { CLAUDE_PROVIDER_KEY } from "../../src/features/heby-provider-ops/provider-connectivity-control.server";
import { EXTERNAL_SEND_PROVIDER_KEY } from "../../src/features/action-execution/contracts";
import { isExternalSendConfigured } from "../../src/features/action-execution/execution-arming-projection.server";
import { OBSERVATION_READ_CONTROL_KEY } from "../../src/features/standing-observation-authority/contracts";
import { MACHINE_INTERNAL_EXECUTION_CONTROL_KEY } from "../../src/features/governed-machine-execution/machine-execution-control.server";
import { OPENAI_IMAGE_GENERATION_CONTROL_KEY } from "../../src/features/media-generation-live/openai-image-control";
/*
 * The ceremony-source vocabulary, imported rather than restated. `CeremonySource` is the released
 * closed union G4 already defines for postures, and its two values are byte-identical to the
 * schema's `PROVIDER_CONTROL_SOURCE_*` constants and to `companies.provisioning_source`. There is
 * exactly one spelling of these roots in the repository and this file adds none.
 */
import {
  CEREMONY_SOURCE_LOCAL,
  CEREMONY_SOURCE_PRODUCTION,
  type CeremonySource,
} from "./production-possession";

/**
 * The closed control vocabulary.
 *
 * Every value is IMPORTED, never re-declared. Each pins ONE blast radius: `claude` governs
 * Hebun→Anthropic model generation, `external-send` governs outbound sending,
 * `provider-observation-read` governs machine-principal provider READS, and
 * `machine-internal-execution` governs machine TRIGGERING of an already human/Governance-authorized
 * internal organizational mutation. A key with no constant to come from is refused rather than
 * silently minting a control row for a permission that does not exist.
 *
 * EVERY KEY IS A ROW, NOT A TABLE — R3B's decision, applied unchanged. Four permissions, four
 * rows, one ceremony — because two ceremonies is how somebody flips the wrong switch and believes
 * the system is off.
 *
 * ── MEMBERSHIP HERE IS EXPRESSIBILITY, NOT PRODUCTION REACH ─────────────────────
 *
 * This list answers "does a control row for this permission exist at all", and it has to contain
 * `machine-internal-execution` for the same reason it contains `external-send`: the writer refuses
 * every key outside it, so a permission absent from here has no disarm either. What it does NOT
 * answer is whether the GENERIC ceremony may reach a key in a PRODUCTION posture. That question has
 * its own answer, immediately below, and it is answered fail-closed — see
 * `resolveGenericProductionReach`.
 */
export const PROVIDER_KEYS: readonly string[] = Object.freeze([
  CLAUDE_PROVIDER_KEY,
  EXTERNAL_SEND_PROVIDER_KEY,
  OBSERVATION_READ_CONTROL_KEY,
  MACHINE_INTERNAL_EXECUTION_CONTROL_KEY,
  /*
   * MEDIA-2A: OpenAI image generation (paid, text-to-image). MEDIA-2B took the production decision
   * and enumerated it in `GENERIC_PRODUCTION_REACHABLE_KEYS` below, so the generic ceremony now
   * reaches it in both directions. With no row it still reads as OFF — the decision made it
   * ARMABLE, not armed.
   */
  OPENAI_IMAGE_GENERATION_CONTROL_KEY,
]);

/*
 * ═══ WHICH KEYS THE GENERIC CEREMONY MAY REACH IN A PRODUCTION POSTURE ════════════
 *
 * ── WHAT WAS WRONG, STATED PLAINLY ────────────────────────────────────
 *
 * The released CLI narrowed production with ONE EQUALITY:
 *
 *     if (posture.mode === "production" && providerKey === EXTERNAL_SEND_PROVIDER_KEY)
 *
 * That is an ALLOW-BY-DEFAULT rule wearing a refusal's clothes. It names the single key that must
 * not pass and lets every other key through, so the production reach of a permission was decided by
 * whether somebody had remembered to add a second clause — which means a key added to
 * `PROVIDER_KEYS` becomes PRODUCTION-ARMABLE MERELY BY BEING A NEW STRING. For `claude` and
 * `provider-observation-read` that outcome happened to be the decision that was actually taken. For
 * a capability that performs unattended organizational mutation it would be an accident.
 *
 * ── WHAT REPLACES IT ─────────────────────────────────────────────
 *
 * The same decision, inverted so that SILENCE REFUSES. A key reaches production through the generic
 * ceremony only by being enumerated in `GENERIC_PRODUCTION_REACHABLE_KEYS`, and every other key —
 * the two that hold dedicated gates, and any key a later phase adds — is refused there.
 *
 * THE RELEASED OUTCOMES ARE PRESERVED EXACTLY, and that is the point of listing them as values:
 *
 *   claude                     → reachable   (R2H made model connectivity production-capable)
 *   provider-observation-read  → reachable   (TRH-25: a read spends quota and changes nothing
 *                                             outside Hebun; and its kill switch must be pullable
 *                                             in production above all)
 *   external-send              → refused     (ESA's gate owns it — unchanged, by value)
 *   machine-internal-execution → refused     (RUNG 1's gate owns it)
 *   anything else              → refused     (no decision has been taken, so none is inferred)
 *
 * ── THIS IS NOT A SECOND AUTHORITY, AND NOT A POLICY FRAMEWORK ─────────────────
 *
 * No table, no row, no environment variable, no token and no persisted state. It is a pure function
 * over a constant, in the file that already owns the control vocabulary, replacing a conditional
 * that already existed. `provider_connectivity_controls` remains the ONE authoritative state, and
 * `setProviderConnectivity` remains the ONE writer — the dedicated gates call it too.
 *
 * ── IT GOVERNS BOTH DIRECTIONS, AND THAT IS DELIBERATE ───────────────────────
 *
 * A refused key is refused for `enable` AND `disable`, exactly as the released `external-send`
 * narrowing already was. That does not strand the kill switch: the dedicated gate owns the whole
 * switch and disarms WITHOUT the preconditions arming has to satisfy. One ceremony per switch is
 * R3B's rule; a key whose OFF lived in one command and whose ON lived in another is how somebody
 * flips the wrong one and believes the system is stopped.
 */

/**
 * The keys the generic ceremony may mutate in a PRODUCTION posture. Enumerated by value — a fifth
 * key does not join this list by existing, it joins by somebody writing it here in a diff.
 */
export const GENERIC_PRODUCTION_REACHABLE_KEYS: readonly string[] = Object.freeze([
  CLAUDE_PROVIDER_KEY,
  OBSERVATION_READ_CONTROL_KEY,
  /*
   * MEDIA-2B. Written here in a diff, which is the only way a key joins this list.
   *
   * WHY THE GENERIC GATE IS THE RIGHT ONE, AND NOT A DEDICATED CEREMONY. The two keys that hold
   * dedicated gates do so because arming them has PRECONDITIONS the generic path cannot check:
   * external-send must have a configured sender, machine-internal-execution must have an armed
   * trigger. Image generation has none — the control is a single boolean, and the other two things
   * a live call needs (`HEBUN_MEDIA_GENERATION_TRANSPORT=live` and a credential-shaped
   * `HEBUN_OPENAI_IMAGE_API_KEY`) are checked INDEPENDENTLY by the released resolver on every
   * single call, fail-closed. A dedicated ceremony would re-ask what the resolver already refuses.
   *
   * WHAT ARMING THIS ACTUALLY PERMITS. One authenticated human, on one content-draft revision, one
   * paid text-to-image call per idempotency key, bounded by the shared per-process live spend
   * budget. It authorizes no agent, no batch, no retry and no publication.
   */
  OPENAI_IMAGE_GENERATION_CONTROL_KEY,
]);

/**
 * The dedicated production ceremony that owns each refused key, so a refusal can send the operator
 * somewhere instead of merely stopping them. A key with no entry is still refused — absence here
 * means "nobody has built that gate yet", never "use the generic one".
 */
export const DEDICATED_PRODUCTION_CEREMONIES: Readonly<Record<string, string>> = Object.freeze({
  [EXTERNAL_SEND_PROVIDER_KEY]: "npm run platform:external-send -- arm",
  [MACHINE_INTERNAL_EXECUTION_CONTROL_KEY]: "npm run platform:machine-execution -- arm",
});

export type GenericProductionReach =
  /** The generic ceremony may mutate this key in production. */
  | { readonly status: "reachable" }
  /**
   * It may not. `dedicatedCommand` is the gate that owns the key, or `null` when no gate exists
   * yet — which is a refusal with no alternative, not a fallback to the generic path.
   */
  | { readonly status: "refused"; readonly dedicatedCommand: string | null };

/**
 * May the GENERIC connectivity ceremony mutate this key under a PRODUCTION posture?
 *
 * PURE. No clock, no connection, no environment. FAIL-CLOSED: everything that is not enumerated as
 * reachable is refused, including a key that is not in `PROVIDER_KEYS` at all.
 */
export function resolveGenericProductionReach(providerKey: string | undefined): GenericProductionReach {
  const key = (providerKey ?? "").trim();
  if (GENERIC_PRODUCTION_REACHABLE_KEYS.includes(key)) return { status: "reachable" };
  return { status: "refused", dedicatedCommand: DEDICATED_PRODUCTION_CEREMONIES[key] ?? null };
}

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
  /**
   * Which ceremony root produced the state this row now holds. NULL only for rows written before
   * the column existed — never a synonym for "local".
   */
  readonly controlSource: string | null;
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
  | "configuration-incomplete"
  /**
   * The caller did not name a root from the released ceremony vocabulary. Unreachable from
   * TypeScript; the runtime guard exists so an untyped caller is refused rather than defaulted.
   */
  | "unknown-control-source";

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
  control_source: string | null;
};

function summarize(row: ControlRow): ProviderControlSummary {
  return {
    providerKey: row.provider_key,
    directorEnabled: row.director_enabled,
    version: row.version,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
    updatedBy: row.updated_by,
    controlSource: row.control_source,
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
    `select provider_key, director_enabled, version, updated_at, updated_by, control_source
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
 * were. `updated_by_type` in particular is left alone permanently, not pending a later phase:
 * writing a type without an actor is false provenance, and the human-only constraint that would
 * have rested on it is cancelled. See the header, and the schema file.
 */
export async function setProviderConnectivity(
  client: Client,
  input: {
    readonly providerKey: string;
    readonly enabled: boolean;
    /**
     * WHICH ROOT IS CAUSING THIS TRANSITION. Required, and typed to the released closed
     * vocabulary — there is no string a caller could invent, and no default. A default would be
     * the dangerous shape here: whichever root it named would be silently attributed to ceremonies
     * that never ran under it.
     */
    readonly controlSource: CeremonySource;
    readonly env?: Readonly<Record<string, string | undefined>>;
  },
): Promise<ConnectivityOutcome> {
  const providerKey = (input?.providerKey ?? "").trim();
  const enabled = input?.enabled === true;
  const env = input?.env ?? process.env;
  const controlSource = input?.controlSource;

  /*
   * Belt and braces over the type. `CeremonySource` is compile-time; this is the runtime refusal
   * for a caller that reached here from untyped JavaScript. It is a REFUSAL, never a substitution:
   * writing a root nobody proved would be exactly the false provenance this column exists to
   * prevent.
   */
  if (controlSource !== CEREMONY_SOURCE_LOCAL && controlSource !== CEREMONY_SOURCE_PRODUCTION) {
    return { status: "refused", reason: "unknown-control-source" };
  }

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
    `insert into provider_connectivity_controls (provider_key, director_enabled, control_source)
          values ($1, $2, $3)
     on conflict (provider_key) do update
            set director_enabled = $2,
                updated_at = now(),
                updated_by = null,
                control_source = $3,
                version = provider_connectivity_controls.version + 1
          where provider_connectivity_controls.director_enabled is distinct from $2
      returning provider_key, director_enabled, version, updated_at, updated_by, control_source`,
    [providerKey, enabled, controlSource],
  );

  const row = updated.rows[0];
  /* Zero rows means a concurrent operator reached the desired state first. Nothing was changed. */
  if (!row) return { status: "refused", reason: "already-in-that-state" };
  return { status: "changed", control: summarize(row) };
}
