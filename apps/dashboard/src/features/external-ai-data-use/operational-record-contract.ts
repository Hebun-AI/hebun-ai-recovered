/*
 * external-ai-data-use/operational-record-contract.ts — what `operational-record` MEANS, and the most
 * of it a model could ever be shown (EAI-OPERATIONAL-RECORD-1).
 *
 * ── THE CLASS ────────────────────────────────────────────────────────────────
 *
 * `operational-record` names records owned by the Organizational Work Authority — the `work_items`
 * register an authorized human writes — and every value DERIVED from them: a count, a flag, an age, a
 * presence. Derived is not anonymous and not harmless. A derived value travels under the class of the
 * records it came from, under the same authorization, or not at all.
 *
 *     OPERATIONAL-RECORD != DISCLOSABLE
 *
 * Naming a value's class decides nothing about disclosure. Whether a class may cross is the platform
 * policy × processor attestation × tenant authorization × operator control, composed fail-closed by
 * `compose-external-ai-disclosure.ts`. Today NO purpose has a platform cell for this class, so every
 * request declaring it is refused `platform-unknown` before any model call. This module changes that
 * for no one: it is read by nothing at runtime.
 *
 * ── THE PROJECTION ───────────────────────────────────────────────────────────
 *
 * `OPERATIONAL_RECORD_FIELDS` is the single table of every field considered, with its source authority,
 * provenance, class, sensitivity and model visibility. Only the `candidate` rows may appear in a
 * planning projection, and only as the closed values below. Everything else is DENIED — by name when
 * it was considered, and by absence when it was not: the validator is closed-world, so an unlisted key
 * is refused exactly like a denied one. Free text has no field to travel in, so a title, a name, a
 * description, an identifier or a secret cannot reach a model through this shape.
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────
 *
 * Not an authorization (it grants nothing), not a policy cell, not a purpose, not a writer, not a
 * persistence path. The projection it accepts is never stored; the disclosure decision's audit evidence
 * records classes and revisions, never content. Tenant isolation is the caller's: the projection
 * carries no tenant, and the declaration's tenant comes from the authenticated context only.
 */
import type { DataClass } from "./contracts";

/** The authority whose records this class names. */
export const OPERATIONAL_RECORD_OWNER = "organizational-work" as const;

/** `work_contracts.ts` declared states, restated so the authority imports no runtime module; a test pins the two equal. */
export const OPERATIONAL_DECLARED_STATES = ["planned", "active", "blocked", "complete"] as const;

/** Above this the projection is refused, never truncated silently. */
export const OPERATIONAL_PLANNING_MAX_ITEMS = 40;

export interface OperationalFieldRule {
  readonly field: string;
  readonly sourceAuthority: "organizational-work" | "organization-authority" | "identity" | "platform" | "none";
  readonly provenance: "authoritative" | "derived" | "invocation-local" | "none";
  readonly disclosureClass: DataClass | "not-disclosable";
  readonly sensitivity:
    | "operational-state"
    | "indirectly-identifying"
    | "organizational-free-text"
    | "personal"
    | "internal-identifier"
    | "secret";
  readonly modelVisibility: "candidate" | "denied";
  /** How a projection is checked for it. */
  readonly validation: string;
}

const rule = (r: OperationalFieldRule): OperationalFieldRule => Object.freeze(r);
const DENY_BY_NAME = "refused by name: field-not-disclosable";

export const OPERATIONAL_RECORD_FIELDS: readonly OperationalFieldRule[] = Object.freeze([
  /* ── Candidates: the whole visible shape. ── */
  rule({ field: "alias", sourceAuthority: "none", provenance: "invocation-local", disclosureClass: "operational-record", sensitivity: "operational-state", modelVisibility: "candidate", validation: "W1..Wn, contiguous from W1, mapped back on the server only" }),
  rule({ field: "state", sourceAuthority: "organizational-work", provenance: "authoritative", disclosureClass: "operational-record", sensitivity: "operational-state", modelVisibility: "candidate", validation: "one of OPERATIONAL_DECLARED_STATES" }),
  rule({ field: "accountable", sourceAuthority: "organizational-work", provenance: "derived", disclosureClass: "operational-record", sensitivity: "indirectly-identifying", modelVisibility: "candidate", validation: "boolean: an accountable human is recorded; never who" }),
  rule({ field: "stale", sourceAuthority: "organizational-work", provenance: "derived", disclosureClass: "operational-record", sensitivity: "indirectly-identifying", modelVisibility: "candidate", validation: "boolean: no change for 30 days or more; never the time" }),
  rule({ field: "evidenceDeclared", sourceAuthority: "organizational-work", provenance: "derived", disclosureClass: "operational-record", sensitivity: "operational-state", modelVisibility: "candidate", validation: "boolean: the work declares a WEV-1 reference; never the referent, its id or its title" }),
  /* ── Denied: considered and refused. ── */
  rule({ field: "title", sourceAuthority: "organizational-work", provenance: "authoritative", disclosureClass: "operational-record", sensitivity: "organizational-free-text", modelVisibility: "denied", validation: `${DENY_BY_NAME}; human free text, not claimed free of personal or sensitive data; DENY until a Director decision admits it` }),
  rule({ field: "description", sourceAuthority: "none", provenance: "none", disclosureClass: "not-disclosable", sensitivity: "organizational-free-text", modelVisibility: "denied", validation: `${DENY_BY_NAME}; raw descriptions and comments are never projected` }),
  rule({ field: "comments", sourceAuthority: "none", provenance: "none", disclosureClass: "not-disclosable", sensitivity: "organizational-free-text", modelVisibility: "denied", validation: DENY_BY_NAME }),
  rule({ field: "workItemId", sourceAuthority: "organizational-work", provenance: "authoritative", disclosureClass: "not-disclosable", sensitivity: "internal-identifier", modelVisibility: "denied", validation: `${DENY_BY_NAME}; replaced by alias` }),
  rule({ field: "accountableActorId", sourceAuthority: "identity", provenance: "authoritative", disclosureClass: "not-disclosable", sensitivity: "personal", modelVisibility: "denied", validation: `${DENY_BY_NAME}; replaced by the accountable boolean` }),
  rule({ field: "accountableName", sourceAuthority: "identity", provenance: "authoritative", disclosureClass: "not-disclosable", sensitivity: "personal", modelVisibility: "denied", validation: DENY_BY_NAME }),
  rule({ field: "accountableCurrentlyActiveMember", sourceAuthority: "identity", provenance: "derived", disclosureClass: "not-disclosable", sensitivity: "personal", modelVisibility: "denied", validation: `${DENY_BY_NAME}; a fact about a person's membership` }),
  rule({ field: "department", sourceAuthority: "organization-authority", provenance: "authoritative", disclosureClass: "organization", sensitivity: "organizational-free-text", modelVisibility: "denied", validation: `${DENY_BY_NAME}; the server resolves and filters the scope, so the model never needs it` }),
  rule({ field: "departmentId", sourceAuthority: "organization-authority", provenance: "authoritative", disclosureClass: "not-disclosable", sensitivity: "internal-identifier", modelVisibility: "denied", validation: DENY_BY_NAME }),
  rule({ field: "tenantId", sourceAuthority: "platform", provenance: "authoritative", disclosureClass: "not-disclosable", sensitivity: "internal-identifier", modelVisibility: "denied", validation: `${DENY_BY_NAME}; the tenant is the declaration's, from the authenticated context` }),
  rule({ field: "recordedAt", sourceAuthority: "organizational-work", provenance: "authoritative", disclosureClass: "not-disclosable", sensitivity: "indirectly-identifying", modelVisibility: "denied", validation: DENY_BY_NAME }),
  rule({ field: "updatedAt", sourceAuthority: "organizational-work", provenance: "authoritative", disclosureClass: "not-disclosable", sensitivity: "indirectly-identifying", modelVisibility: "denied", validation: `${DENY_BY_NAME}; replaced by the stale boolean` }),
  rule({ field: "lifecycleStatus", sourceAuthority: "organizational-work", provenance: "authoritative", disclosureClass: "not-disclosable", sensitivity: "operational-state", modelVisibility: "denied", validation: `${DENY_BY_NAME}; retired items are excluded before projection` }),
  rule({ field: "evidenceReferences", sourceAuthority: "organizational-work", provenance: "authoritative", disclosureClass: "not-disclosable", sensitivity: "internal-identifier", modelVisibility: "denied", validation: `${DENY_BY_NAME}; referents are Knowledge or Work Artifacts — other classes; only evidenceDeclared crosses` }),
  rule({ field: "dependsOn", sourceAuthority: "none", provenance: "none", disclosureClass: "not-disclosable", sensitivity: "operational-state", modelVisibility: "denied", validation: `${DENY_BY_NAME}; no authority records work-to-work dependencies, so none can be verified` }),
  rule({ field: "dueAt", sourceAuthority: "none", provenance: "none", disclosureClass: "not-disclosable", sensitivity: "operational-state", modelVisibility: "denied", validation: `${DENY_BY_NAME}; Work records no deadlines` }),
  rule({ field: "providerMetadata", sourceAuthority: "platform", provenance: "none", disclosureClass: "not-disclosable", sensitivity: "internal-identifier", modelVisibility: "denied", validation: DENY_BY_NAME }),
  rule({ field: "credential", sourceAuthority: "platform", provenance: "none", disclosureClass: "not-disclosable", sensitivity: "secret", modelVisibility: "denied", validation: DENY_BY_NAME }),
]);

export const OPERATIONAL_PLANNING_FIELDS: readonly string[] = Object.freeze(
  OPERATIONAL_RECORD_FIELDS.filter((r) => r.modelVisibility === "candidate").map((r) => r.field),
);

export type OperationalProjectionRefusal =
  | { readonly reason: "not-a-projection" }
  | { readonly reason: "empty" }
  | { readonly reason: "too-many-items"; readonly count: number }
  | { readonly reason: "field-not-disclosable"; readonly field: string }
  | { readonly reason: "invalid-value"; readonly field: string; readonly index: number }
  | { readonly reason: "alias-sequence"; readonly index: number };

export type OperationalProjectionVerdict =
  | { readonly ok: true; readonly dataClasses: readonly ["operational-record"]; readonly itemCount: number }
  | { readonly ok: false; readonly refusal: OperationalProjectionRefusal };

const VALUE_CHECKS: Readonly<Record<string, (value: unknown, index: number) => boolean>> = Object.freeze({
  alias: (v, i) => v === `W${i + 1}`,
  state: (v) => (OPERATIONAL_DECLARED_STATES as readonly unknown[]).includes(v),
  accountable: (v) => typeof v === "boolean",
  stale: (v) => typeof v === "boolean",
  evidenceDeclared: (v) => typeof v === "boolean",
});

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/**
 * Closed-world check of a planning projection: `{ items: [{ alias, state, accountable, stale,
 * evidenceDeclared }, …] }` and nothing else. Every field is required, every value closed. The first
 * defect refuses the whole projection — nothing is dropped, repaired or truncated. An accepted
 * projection declares exactly `operational-record`, derived fields included.
 */
export function validateOperationalPlanningProjection(input: unknown): OperationalProjectionVerdict {
  const refuse = (refusal: OperationalProjectionRefusal): OperationalProjectionVerdict => ({ ok: false, refusal });
  if (!isPlainObject(input)) return refuse({ reason: "not-a-projection" });
  for (const key of Object.keys(input)) if (key !== "items") return refuse({ reason: "field-not-disclosable", field: key });
  const items = input.items;
  if (!Array.isArray(items)) return refuse({ reason: "not-a-projection" });
  if (items.length === 0) return refuse({ reason: "empty" });
  if (items.length > OPERATIONAL_PLANNING_MAX_ITEMS) return refuse({ reason: "too-many-items", count: items.length });

  for (const [index, item] of items.entries()) {
    if (!isPlainObject(item)) return refuse({ reason: "not-a-projection" });
    for (const key of Object.keys(item)) {
      if (!OPERATIONAL_PLANNING_FIELDS.includes(key)) return refuse({ reason: "field-not-disclosable", field: key });
    }
    for (const field of OPERATIONAL_PLANNING_FIELDS) {
      if (!VALUE_CHECKS[field]!(item[field], index)) {
        return refuse(field === "alias" ? { reason: "alias-sequence", index } : { reason: "invalid-value", field, index });
      }
    }
  }
  return { ok: true, dataClasses: ["operational-record"], itemCount: items.length };
}
