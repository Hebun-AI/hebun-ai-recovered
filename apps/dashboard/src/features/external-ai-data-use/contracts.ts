/*
 * external-ai-data-use/contracts.ts — the closed vocabularies of EXTERNAL AI DATA USE
 * (EXTERNAL-AI-DATA-USE-1A).
 *
 * ── THE PROTECTED ACT ────────────────────────────────────────────────────────
 *
 *     Disclosure of tenant-controlled organizational data across Hebun's trust boundary to an
 *     external AI processor, for a declared processing purpose.
 *
 * Three authorities answer three different questions about that act, and this release keeps them
 * apart rather than merging them:
 *
 *     PLATFORM POLICY        may Hebun offer this kind of processing at all?   reviewed code
 *     PROCESSOR ATTESTATION  what boundary did Hebun review, under what treatment?   root rows
 *     TENANT AUTHORIZATION   did THIS organization's Governance agree to it?   tenant rows
 *
 * R2E (`provider_connectivity_controls`) stays operational enablement only, the model transport
 * stays transport only, and Action Authorization is not consulted at all. None of them is a
 * data-use authority, and nothing here makes them one.
 *
 * ── WHY EVERY LIST IS CLOSED ─────────────────────────────────────────────────
 *
 * A widening that arrives through a free-text value is a widening nobody decided. Each list below
 * is also spelled out in a CHECK constraint in the schema, so adding a member is a reviewed code
 * change AND a reviewed migration.
 *
 * ── WHAT THE ORDERED LISTS MEAN ──────────────────────────────────────────────
 *
 * `TRAINING_TREATMENTS`, `RETENTION_CLASSES`, `ZDR_STATES` and `IDENTITY_STATUSES` are ordered
 * from the NARROWEST disclosure risk to the widest. The order is itself a reviewed decision: it is
 * the only thing `classifyAttestationChange` may use to call a change narrowing or widening.
 * Nothing here is a legal conclusion about any provider.
 */

/* ── Governance vocabulary ───────────────────────────────────────────────────────────────── */

/** The Governance domain, its own concern: not `external-send`, not `action-authorization`. */
export const EXTERNAL_AI_DATA_USE_DOMAIN = "external-ai-data-use" as const;
export const TENANT_EXTERNAL_AI_DATA_USE_SUBJECT_TYPE = "tenant_external_ai_data_use_authorization" as const;
export const TENANT_EXTERNAL_AI_DATA_USE_AUTHORIZE_DECISION_TYPE = "approve" as const;
export const TENANT_EXTERNAL_AI_DATA_USE_WITHDRAW_DECISION_TYPE = "revoke" as const;
/*
 * The ledger words. Never `approved` / `revoked`: `approve` would otherwise be filed as a person
 * joining the organization and `revoke` as Governance authority being taken away. Neither happened.
 */
export const TENANT_EXTERNAL_AI_DATA_USE_AUTHORIZED_OUTCOME = "external-ai-data-use-authorized" as const;
export const TENANT_EXTERNAL_AI_DATA_USE_WITHDRAWN_OUTCOME = "external-ai-data-use-withdrawn" as const;

/* ── Processing boundary vocabulary ──────────────────────────────────────────────────────── */

/**
 * The external processing boundaries Hebun's runtime actually reaches. Not every endpoint a
 * provider offers — only the ones a Hebun code path calls today. The downstream vendor is part of
 * the name where it changes who receives the data (Higgsfield forwards to PixVerse).
 *
 * `higgsfield/minimax-hailuo-2.3/…` is absent on purpose: that profile exists only for MV-6
 * acceptance and production cannot select it.
 */
export const SERVICE_SCOPES = [
  "anthropic/messages",
  "openai/images.generations",
  "openai/images.edits",
  "higgsfield/pixverse-v6/text-to-video",
  "higgsfield/pixverse-v6/image-to-video",
] as const;
export type ServiceScope = (typeof SERVICE_SCOPES)[number];

/** Why the data crosses the boundary. Not one giant "AI" purpose, not one per implementation. */
export const PURPOSES = ["assistance", "relevance-selection", "agent-origination", "media-generation"] as const;
export type Purpose = (typeof PURPOSES)[number];

/**
 * WHAT crosses, by the authority that owns it — never by a claimed sensitivity. Hebun has no
 * classification authority, so no member here says public, confidential or personal.
 *
 * `external-recipient` is the DISPLAY NAME of a recorded outside party. Origination sends that
 * label to the model; the address has no field to travel in and never will.
 */
export const DATA_CLASSES = [
  "conversation",
  "knowledge",
  "work-artifact",
  "organization",
  "governance-record",
  "operational-record",
  "provider-observation",
  "external-recipient",
  "media-generated",
  "media-supplied",
] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

/** The contract a processor's traffic is governed by, as reviewed. Unordered: a change is UNKNOWN. */
export const CONTRACT_SURFACES = [
  "anthropic-commercial-terms",
  "openai-services-agreement",
  "higgsfield-terms-of-use",
  "higgsfield-enterprise-agreement",
] as const;
export type ContractSurface = (typeof CONTRACT_SURFACES)[number];

/** Narrowest first. */
export const TRAINING_TREATMENTS = ["none", "customer-opt-in", "provider-default"] as const;
export type TrainingTreatment = (typeof TRAINING_TREATMENTS)[number];

/** Narrowest first. Trust-and-safety exceptions are part of each class's reviewed meaning. */
export const RETENTION_CLASSES = ["zero-data-retention", "bounded-30-days", "extended"] as const;
export type RetentionClass = (typeof RETENTION_CLASSES)[number];

/** Narrowest first. */
export const ZDR_STATES = ["enabled", "not-enabled"] as const;
export type ZdrState = (typeof ZDR_STATES)[number];

/**
 * Narrowest RISK first: `verified` (a runtime observation a human admitted) carries more
 * assurance than `attested` (a human's reviewed statement). "Unverified" is not a state — it is
 * the absence of any attestation.
 */
export const IDENTITY_STATUSES = ["verified", "attested"] as const;
export type IdentityStatus = (typeof IDENTITY_STATUSES)[number];

/** Where a root attestation row came from. The same two sources the root control records. */
export const ATTESTATION_CONTROL_SOURCES = ["local-operator-ceremony", "production-operator-ceremony"] as const;
export type AttestationControlSource = (typeof ATTESTATION_CONTROL_SOURCES)[number];

/** The lifecycle words, shared by both lineages and stored in two SEPARATE enums. */
export type ExternalAiRevisionState = "active" | "withdrawn";

/** At most every (purpose, data class) pair once. */
export const MAX_SCOPE_PAIRS = PURPOSES.length * DATA_CLASSES.length;

function member<T extends string>(list: readonly T[]) {
  return (value: unknown): value is T => typeof value === "string" && (list as readonly string[]).includes(value);
}
export const isServiceScope = member(SERVICE_SCOPES);
export const isPurpose = member(PURPOSES);
export const isDataClass = member(DATA_CLASSES);

/** Position in an ordered list — lower is narrower. */
export function rankOf<T extends string>(list: readonly T[], value: T): number {
  return list.indexOf(value);
}

/* ── Results ─────────────────────────────────────────────────────────────────────────────── */

export interface ScopePair {
  readonly purpose: Purpose;
  readonly dataClass: DataClass;
}

export type TenantExternalAiDataUseWriteRefusal =
  | "unauthenticated"
  | "justification-required"
  | "no-governance-authority"
  | "not-the-governance-authority"
  | "invalid-scope"
  | "attestation-unknown"
  | "attestation-not-current"
  | "platform-not-allowed"
  | "unchanged"
  | "no-active-authorization"
  | "stale-authorization-revision"
  | "persistence-unavailable";

/**
 * The resolver's answer. Never a boolean: each word is a different fact a reader may need, in the
 * order the resolver reports them (see `compose-external-ai-disclosure.ts`).
 */
export type ExternalAiDisclosureDisposition =
  | "unavailable"
  | "tenant-withdrawn"
  | "platform-denied"
  | "platform-unknown"
  | "tenant-not-authorized"
  | "authorization-stale"
  | "operator-paused"
  | "provider-unavailable"
  | "authorized";
