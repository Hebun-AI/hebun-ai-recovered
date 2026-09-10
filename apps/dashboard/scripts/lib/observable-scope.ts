/*
 * scripts/lib/observable-scope.ts — WHICH SCOPE AN OPERATOR CEREMONY IS TALKING ABOUT.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * The standing-observation ceremonies were written when Hebun had one observable provider, and they
 * named it in their source. A second provider arrived and the ceremonies could not reach it: not
 * because the authority refused — it is provider-agnostic and always was — but because the operator
 * seam had no way to say which scope was meant.
 *
 * This module is that seam and NOTHING else. It resolves names to a scope and reads two tables to
 * find the subject a provider already confirmed.
 *
 * ── WHAT IT IS FORBIDDEN TO BE ──────────────────────────────────────────────
 *
 * It is not an authority. It writes nothing — no INSERT, no UPDATE, no DELETE. It does not decide
 * whether an observation may recur (the standing authorization does), does not decide whether one
 * may happen now (the revalidator does), does not touch a connection's lifecycle, does not open a
 * credential and does not contact a provider. A ceremony that used this to *do* anything would be
 * the second authority this repository keeps refusing to grow.
 *
 * ── IT INVENTS NO VOCABULARY ────────────────────────────────────────────────
 *
 * Every name it resolves comes from a released registry: the scope from `OBSERVABLE_CAPABILITIES`,
 * the identity shape from the provider catalog's own `accountIdentity`, the subject prefix from the
 * provider that owns it. Adding a third provider is a code change in those owners, and this file
 * follows them rather than restating them.
 */
import type { Client } from "pg";
import { OBSERVABLE_CAPABILITIES } from "../../src/features/standing-observation-authority/contracts";
import { findProviderDefinition } from "../../src/features/provider-catalog/catalog";
import { INSTAGRAM_ACCOUNT_SUBJECT_KIND, INSTAGRAM_SUBJECT_PREFIX } from "../../src/features/provider-instagram/contracts";

export interface ObservableScope {
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectKind: string;
}

export type ScopeResolution =
  | { readonly ok: true; readonly scope: ObservableScope }
  | { readonly ok: false; readonly reason: string };

/**
 * The observable scope a ceremony is talking about.
 *
 * ── RESOLVING IS NOT AUTHORIZING ────────────────────────────────────────────
 *
 * This function turns names into a triple the released authority already declared eligible. It
 * grants nothing, widens nothing and writes nothing: naming a capability here is how an operator
 * says WHICH scope they are about to ask Governance to approve, not a way to approve it.
 *
 * ── WITHOUT AN EXPLICIT CAPABILITY ──────────────────────────────────────────
 *
 * One eligible scope resolves; none refuses; MORE THAN ONE REFUSES. A ceremony must never pick a
 * scope on an operator's behalf, and the refusal now names the candidates so the operator can see
 * exactly what there is to choose between rather than reading source to find out.
 *
 * A single-capability provider therefore keeps working exactly as it did. That is deliberate: a
 * provider offering one scope has no ambiguity to resolve, and demanding a flag to restate the only
 * possible answer would be ceremony for its own sake.
 *
 * ── WITH ONE ──────────────────────────────────────────────────────────────
 *
 * The triple must be declared eligible for THIS provider. Every other case is refused, and each
 * refusal says which kind of wrong it was — a capability belonging to another provider, a
 * capability the catalog declares but the authority never made observable, and a name nothing knows
 * are three different mistakes, and collapsing them would send an operator hunting the wrong one.
 */
export function resolveObservableScope(
  providerKey: string,
  capabilityKey?: string | null,
): ScopeResolution {
  const matches = OBSERVABLE_CAPABILITIES.filter((c) => c.providerKey === providerKey);
  if (matches.length === 0) {
    const offered = [...new Set(OBSERVABLE_CAPABILITIES.map((c) => c.providerKey))].sort();
    return {
      ok: false,
      reason: `"${providerKey}" has no observable capability. Observable providers: ${offered.join(", ")}`,
    };
  }

  const named = typeof capabilityKey === "string" ? capabilityKey.trim() : "";

  if (named.length === 0) {
    if (matches.length > 1) {
      const candidates = matches.map((c) => c.capabilityKey).sort();
      return {
        ok: false,
        reason:
          `"${providerKey}" offers ${matches.length} observable capabilities — name the scope explicitly ` +
          `rather than letting a ceremony choose. Use --capability=<key>, one of: ${candidates.join(", ")}`,
      };
    }
    const only = matches[0]!;
    return {
      ok: true,
      scope: { providerKey: only.providerKey, capabilityKey: only.capabilityKey, subjectKind: only.subjectKind },
    };
  }

  const exact = matches.filter((c) => c.capabilityKey === named);

  if (exact.length === 0) {
    /*
     * WHICH KIND OF WRONG, ANSWERED FROM THE REGISTRIES RATHER THAN GUESSED.
     *
     * A capability that belongs to a DIFFERENT provider is the dangerous mistake — an operator one
     * word away from authorizing the wrong provider's scope — so it is named as such. A capability
     * the provider DECLARES but the authority never made observable is a different fact entirely:
     * the catalog knowing about it does not make it authorizable, and saying "unknown" there would
     * send someone looking for a typo that is not there.
     */
    const elsewhere = OBSERVABLE_CAPABILITIES.find((c) => c.capabilityKey === named);
    if (elsewhere) {
      return {
        ok: false,
        reason: `"${named}" is observable for provider "${elsewhere.providerKey}", not for "${providerKey}"`,
      };
    }
    const definition = findProviderDefinition(providerKey);
    if (definition && Object.prototype.hasOwnProperty.call(definition.capabilityScopes, named)) {
      return {
        ok: false,
        reason:
          `"${named}" is declared by provider "${providerKey}" but is NOT observable — ` +
          `the authority has not made it eligible for standing observation`,
      };
    }
    const candidates = matches.map((c) => c.capabilityKey).sort();
    return {
      ok: false,
      reason: `"${named}" is not an observable capability. For "${providerKey}", one of: ${candidates.join(", ")}`,
    };
  }

  if (exact.length > 1) {
    /*
     * TWO ELIGIBILITY ROWS FOR ONE TRIPLE. Unreachable today and refused anyway: if the authority
     * ever declared the same capability twice with different subject kinds, picking either would be
     * a ceremony deciding what a human meant.
     */
    return {
      ok: false,
      reason: `"${named}" is declared ${exact.length} times for "${providerKey}" — the authority's eligibility list is ambiguous`,
    };
  }

  const only = exact[0]!;
  return {
    ok: true,
    scope: { providerKey: only.providerKey, capabilityKey: only.capabilityKey, subjectKind: only.subjectKind },
  };
}

/**
 * The canonical subject prefix for a subject kind whose subject IS the connected account.
 *
 * Declared by the provider that owns the reference, never spelled here. A subject kind that reaches
 * this map without an entry is refused rather than guessed — see `subjectFromConnection`.
 */
const ACCOUNT_SUBJECT_PREFIXES: Readonly<Record<string, string>> = Object.freeze({
  [INSTAGRAM_ACCOUNT_SUBJECT_KIND]: INSTAGRAM_SUBJECT_PREFIX,
});

export interface ConnectionRow {
  readonly id: string;
  readonly connection_state: string | null;
  readonly health: string | null;
  readonly external_account_id: string | null;
}

export type SubjectResolution =
  | { readonly ok: true; readonly subjectRef: string; readonly connectionId: string }
  | { readonly ok: false; readonly reason: string };

/**
 * The tenant's connection for a provider — exactly one, or a refusal.
 *
 * READ ONLY. The connection authority owns this row; this reads it and forms an opinion about
 * nothing except whether a ceremony may proceed.
 */
export async function readSoleConnection(
  client: Client,
  tenantId: string,
  providerKey: string,
): Promise<{ ok: true; connection: ConnectionRow } | { ok: false; reason: string }> {
  const found = await client.query<ConnectionRow>(
    `select id, connection_state, health, external_account_id
       from integrations
      where tenant_id = $1 and provider_key = $2 and deleted_at is null
      order by created_at
      limit 2`,
    [tenantId, providerKey],
  );
  if (found.rows.length === 0) return { ok: false, reason: `no ${providerKey} connection` };
  if (found.rows.length > 1) {
    return {
      ok: false,
      reason: `more than one ${providerKey} connection — this ceremony will not choose between them`,
    };
  }
  return { ok: true, connection: found.rows[0]! };
}

/**
 * The subject of an account-identity provider: the account the PROVIDER confirmed.
 *
 * ── WHY NOT A PRIOR OBSERVATION ─────────────────────────────────────────────
 *
 * The released ceremony took YouTube's subject from a stored observation, because a YouTube
 * connection binds no account and the channel is only known once one has been read. An Instagram
 * connection is the opposite: the account IS the connection, written by the verifier from a real
 * provider answer at `/me`. Requiring a prior observation there would demand an observation before
 * the authorization that permits it.
 *
 * ── AND ONLY A CONNECTION THAT IS ACTUALLY WORKING ──────────────────────────
 *
 * `connected` AND `healthy` AND an external account id. A draft, an unverified, an expired or a
 * degraded connection is refused: authorizing recurring reads against a connection Hebun has not
 * just proved is exactly the claim this repository refuses to make.
 */
export function subjectFromConnection(
  subjectKind: string,
  connection: ConnectionRow,
): SubjectResolution {
  const prefix = ACCOUNT_SUBJECT_PREFIXES[subjectKind];
  if (!prefix) {
    return {
      ok: false,
      reason: `no canonical subject prefix is declared for subject kind "${subjectKind}"`,
    };
  }
  if (connection.connection_state !== "connected") {
    return {
      ok: false,
      reason: `the connection is "${connection.connection_state ?? "unknown"}", not connected — nothing may be authorized against it`,
    };
  }
  if (connection.health !== "healthy") {
    return {
      ok: false,
      reason: `the connection is "${connection.health ?? "unknown"}", not healthy — nothing may be authorized against it`,
    };
  }
  const account = connection.external_account_id;
  if (!account) {
    return { ok: false, reason: "the connection names no external account — the provider confirmed none" };
  }
  return { ok: true, subjectRef: `${prefix}${account}`, connectionId: connection.id };
}

/**
 * The subject of a provider whose connection binds no account: the last one a provider confirmed.
 *
 * This is the RELEASED YouTube semantics, moved rather than changed — the same query, the same
 * ordering, the same refusal when nothing has been observed yet.
 */
export async function subjectFromLatestObservation(
  client: Client,
  tenantId: string,
  scope: ObservableScope,
): Promise<{ ok: true; subjectKind: string; subjectRef: string } | { ok: false; reason: string }> {
  const observed = await client.query<{ subject_kind: string; subject_ref: string }>(
    `select subject_kind, subject_ref
       from provider_observations
      where tenant_id = $1 and provider_key = $2 and capability_key = $3
      order by observed_at desc
      limit 1`,
    [tenantId, scope.providerKey, scope.capabilityKey],
  );
  const row = observed.rows[0];
  if (!row) {
    return {
      ok: false,
      reason:
        "no stored provider observation to take a canonical subject from. Authorize nothing until " +
        "the provider has confirmed which subject this is",
    };
  }
  return { ok: true, subjectKind: row.subject_kind, subjectRef: row.subject_ref };
}

/**
 * Which of the two shapes a provider uses — READ OFF THE RELEASED CATALOG, not decided here.
 *
 * `accountIdentity` already distinguishes exactly this: a connection that binds one account
 * (`"account"`) from one that binds none (`"none"`). Reusing it means a third provider gets the
 * right shape by declaring what it is, rather than by being added to a list in a ceremony.
 */
export function subjectSourceFor(providerKey: string): "connection" | "observation" | null {
  const definition = findProviderDefinition(providerKey);
  if (!definition) return null;
  return definition.accountIdentity === "account" ? "connection" : "observation";
}
