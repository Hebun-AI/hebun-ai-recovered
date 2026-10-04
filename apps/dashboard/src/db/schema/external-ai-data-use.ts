/*
 * schema/external-ai-data-use.ts — PROCESSOR ATTESTATIONS (root) and TENANT EXTERNAL-AI DATA-USE
 * AUTHORIZATIONS (Governance) — EXTERNAL-AI-DATA-USE-1A.
 *
 * ── TWO AUTHORITIES, TWO QUESTIONS, NEVER ONE TABLE ─────────────────────────
 *
 *     processor_attestations
 *         "What external processing boundary has Hebun reviewed — this service scope, on this
 *          account — and under what attested or verified treatment?"
 *         ROOT. No tenant. A platform fact, not anybody's consent.
 *
 *     tenant_ai_data_use_authorizations (+ _scopes)
 *         "Has this organization's Governance agreed that THESE purposes and data classes may cross
 *          to THAT reviewed boundary?"
 *         TENANT. Written only under a Governance decision, by a named human.
 *
 * Neither is R2E (`provider_connectivity_controls`, operational enablement), neither is a transport,
 * and neither authorizes an act. Platform ACCEPTABILITY is a third authority again: reviewed code in
 * `features/external-ai-data-use/platform-disclosure-policy.ts`.
 *
 * ── RELEASE A IS INERT BY THE DATABASE ──────────────────────────────────────
 *
 * An ACTIVE tenant revision must name the exact attestation revision it was granted against
 * (`bound_attestation_chk`), through a composite foreign key that also pins the scope and account
 * (`bound_attestation_fk`). Release A ships no attestation writer anywhere — the admission ceremony
 * is B1 — so in a Release A deployment there is nothing an active revision could name, and an
 * active authorization is unrepresentable rather than merely unwritten.
 *
 * ── REVISIONS, NOT EDITS ────────────────────────────────────────────────────
 *
 * Both lineages are append-only, exactly as their siblings are: no update writer exists, a
 * withdrawal is a new revision, `superseded` is derived, and the CHECKs below refuse a lineage that
 * opens with a withdrawal or forks.
 *
 * ── THE VOCABULARIES ARE SPELLED HERE AND IN THE CONTRACTS ──────────────────
 *
 * Each closed list below is a CHECK, so widening one is a reviewed migration as well as a reviewed
 * code change. A test asserts these literals equal `features/external-ai-data-use/contracts.ts`.
 */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { rootColumns, tenantColumns } from "./_base";
import { actorTypeEnum, processorAttestationStateEnum, tenantExternalAiDataUseStateEnum } from "./_enums";
import { decisionRecords, governanceSessions } from "./governance";

export const EXTERNAL_AI_SERVICE_SCOPES_SQL = [
  "anthropic/messages",
  "openai/images.generations",
  "openai/images.edits",
  "higgsfield/pixverse-v6/text-to-video",
  "higgsfield/pixverse-v6/image-to-video",
] as const;
export const EXTERNAL_AI_PURPOSES_SQL = ["assistance", "relevance-selection", "agent-origination", "media-generation"] as const;
export const EXTERNAL_AI_DATA_CLASSES_SQL = [
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
export const EXTERNAL_AI_CONTRACT_SURFACES_SQL = [
  "anthropic-commercial-terms",
  "openai-services-agreement",
  "higgsfield-terms-of-use",
  "higgsfield-enterprise-agreement",
] as const;
export const EXTERNAL_AI_TRAINING_SQL = ["none", "customer-opt-in", "provider-default"] as const;
export const EXTERNAL_AI_RETENTION_SQL = ["zero-data-retention", "bounded-30-days", "extended"] as const;
export const EXTERNAL_AI_ZDR_SQL = ["enabled", "not-enabled"] as const;
export const EXTERNAL_AI_IDENTITY_SQL = ["verified", "attested"] as const;
export const EXTERNAL_AI_CONTROL_SOURCES_SQL = ["local-operator-ceremony", "production-operator-ceremony"] as const;

/** `'a', 'b', 'c'` — for a CHECK over a closed list written in this file. */
function inList(values: readonly string[]) {
  return sql.raw(values.map((v) => `'${v}'`).join(", "));
}

export const processorAttestations = pgTable(
  "processor_attestations",
  {
    /** ROOT: no tenant. One deployment holds one account per provider; this row describes it. */
    ...rootColumns,

    /* ── IDENTITY ── */
    serviceScope: text("service_scope").notNull(),
    /** The provider's own account / organization / workspace identifier, or an attested label. */
    accountRef: text("account_ref").notNull(),
    attestationRevision: integer("attestation_revision").notNull(),
    state: processorAttestationStateEnum("state").notNull(),
    identityStatus: text("identity_status").notNull(),

    /* ── TREATMENT ── */
    contractSurface: text("contract_surface").notNull(),
    training: text("training").notNull(),
    retentionClass: text("retention_class").notNull(),
    zdr: text("zdr").notNull(),
    /** Where a provider treats models differently (covered vs not, ZDR-eligible vs not). */
    modelTreatmentClass: text("model_treatment_class").notNull(),
    /** The model ids reviewed within that class. Runtime evidence, never an identity. */
    modelIds: text("model_ids").array().notNull(),
    /** Compliance metadata only; never an authorization input in this release. */
    region: text("region"),

    /* ── EVIDENCE ── */
    evidenceRefs: text("evidence_refs").array().notNull(),
    /** The Director-gated repository record this revision was admitted from, `path@sha`. */
    reviewedRecordRef: text("reviewed_record_ref").notNull(),
    attestedAt: timestamp("attested_at", { withTimezone: true }).notNull(),
    /** Possession is a SOURCE, not an actor — the same honesty the root control keeps. */
    controlSource: text("control_source").notNull(),

    supersedesAttestationId: uuid("supersedes_attestation_id").references(
      (): AnyPgColumn => processorAttestations.id,
    ),
  },
  (t) => [
    uniqueIndex("processor_attestations_lineage_revision_uq").on(t.serviceScope, t.accountRef, t.attestationRevision),
    uniqueIndex("processor_attestations_supersedes_uq")
      .on(t.supersedesAttestationId)
      .where(sql`${t.supersedesAttestationId} is not null`),
    /** The target a tenant revision binds to: id AND the lineage it claims, as one key. */
    uniqueIndex("processor_attestations_id_lineage_uq").on(t.id, t.serviceScope, t.accountRef),
    check("processor_attestations_revision_chk", sql`${t.attestationRevision} >= 1`),
    check(
      "processor_attestations_lineage_chk",
      sql`(${t.attestationRevision} = 1) = (${t.supersedesAttestationId} is null)`,
    ),
    check(
      "processor_attestations_supersedes_not_self_chk",
      sql`${t.supersedesAttestationId} is null or ${t.supersedesAttestationId} <> ${t.id}`,
    ),
    check(
      "processor_attestations_first_revision_active_chk",
      sql`${t.attestationRevision} > 1 or ${t.state} = 'active'`,
    ),
    check("processor_attestations_service_scope_chk", sql`${t.serviceScope} in (${inList(EXTERNAL_AI_SERVICE_SCOPES_SQL)})`),
    check(
      "processor_attestations_account_ref_chk",
      sql`char_length(btrim(${t.accountRef})) between 1 and 200`,
    ),
    check("processor_attestations_identity_chk", sql`${t.identityStatus} in (${inList(EXTERNAL_AI_IDENTITY_SQL)})`),
    check(
      "processor_attestations_contract_chk",
      sql`${t.contractSurface} in (${inList(EXTERNAL_AI_CONTRACT_SURFACES_SQL)})`,
    ),
    check("processor_attestations_training_chk", sql`${t.training} in (${inList(EXTERNAL_AI_TRAINING_SQL)})`),
    check("processor_attestations_retention_chk", sql`${t.retentionClass} in (${inList(EXTERNAL_AI_RETENTION_SQL)})`),
    check("processor_attestations_zdr_chk", sql`${t.zdr} in (${inList(EXTERNAL_AI_ZDR_SQL)})`),
    check(
      "processor_attestations_model_chk",
      sql`char_length(btrim(${t.modelTreatmentClass})) > 0 and cardinality(${t.modelIds}) >= 1`,
    ),
    check(
      "processor_attestations_evidence_chk",
      sql`cardinality(${t.evidenceRefs}) >= 1 and char_length(btrim(${t.reviewedRecordRef})) > 0`,
    ),
    check(
      "processor_attestations_control_source_chk",
      sql`${t.controlSource} in (${inList(EXTERNAL_AI_CONTROL_SOURCES_SQL)})`,
    ),
  ],
);

export const tenantExternalAiDataUseAuthorizations = pgTable(
  "tenant_ai_data_use_authorizations",
  {
    ...tenantColumns,

    authorizationRevision: integer("authorization_revision").notNull(),
    state: tenantExternalAiDataUseStateEnum("state").notNull(),

    /* ── THE LINEAGE: this organization × one reviewed boundary (scope + account). ── */
    serviceScope: text("service_scope").notNull(),
    accountRef: text("account_ref").notNull(),

    /**
     * THE EXACT ATTESTATION REVISION the human authorized against. NOT NULL exactly when active.
     * A later attestation revision never silently inherits this agreement: the resolver classifies
     * the change, and only an equivalent or narrowing one preserves it.
     */
    boundProcessorAttestationId: uuid("bound_processor_attestation_id"),

    governanceDecisionId: uuid("governance_decision_id")
      .notNull()
      .references(() => decisionRecords.id, { onDelete: "restrict" }),
    governanceSessionId: uuid("governance_session_id")
      .notNull()
      .references(() => governanceSessions.id, { onDelete: "restrict" }),

    authorizedByActorType: actorTypeEnum("authorized_by_actor_type").notNull(),
    authorizedByActorId: uuid("authorized_by_actor_id").notNull(),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull(),

    supersedesAuthorizationId: uuid("supersedes_authorization_id").references(
      (): AnyPgColumn => tenantExternalAiDataUseAuthorizations.id,
    ),
  },
  (t) => [
    uniqueIndex("tenant_ai_data_use_authorizations_lineage_revision_uq").on(
      t.tenantId,
      t.serviceScope,
      t.accountRef,
      t.authorizationRevision,
    ),
    uniqueIndex("tenant_ai_data_use_authorizations_decision_uq").on(t.governanceDecisionId),
    uniqueIndex("tenant_ai_data_use_authorizations_supersedes_uq")
      .on(t.supersedesAuthorizationId)
      .where(sql`${t.supersedesAuthorizationId} is not null`),
    uniqueIndex("tenant_ai_data_use_authorizations_id_tenant_uq").on(t.id, t.tenantId),
    index("tenant_ai_data_use_authorizations_tenant_state_idx").on(t.tenantId, t.state),
    /** The bound attestation must exist AND belong to the lineage this revision claims. */
    foreignKey({
      name: "tenant_ai_data_use_authorizations_bound_attestation_fk",
      columns: [t.boundProcessorAttestationId, t.serviceScope, t.accountRef],
      foreignColumns: [processorAttestations.id, processorAttestations.serviceScope, processorAttestations.accountRef],
    }).onDelete("restrict"),
    /** RELEASE A'S INERTNESS, AT THE DATABASE: active ⇔ an attestation is named. */
    check(
      "tenant_ai_data_use_authorizations_bound_attestation_chk",
      sql`(${t.state} = 'active') = (${t.boundProcessorAttestationId} is not null)`,
    ),
    /** AN AGENT MAY NEVER AUTHORIZE ITS ORGANIZATION'S EXTERNAL DISCLOSURE. Enforced by PostgreSQL. */
    check(
      "tenant_ai_data_use_authorizations_human_authorizer_chk",
      sql`${t.authorizedByActorType} = 'human'`,
    ),
    check("tenant_ai_data_use_authorizations_revision_chk", sql`${t.authorizationRevision} >= 1`),
    check(
      "tenant_ai_data_use_authorizations_lineage_chk",
      sql`(${t.authorizationRevision} = 1) = (${t.supersedesAuthorizationId} is null)`,
    ),
    check(
      "tenant_ai_data_use_authorizations_supersedes_not_self_chk",
      sql`${t.supersedesAuthorizationId} is null or ${t.supersedesAuthorizationId} <> ${t.id}`,
    ),
    check(
      "tenant_ai_data_use_authorizations_first_revision_active_chk",
      sql`${t.authorizationRevision} > 1 or ${t.state} = 'active'`,
    ),
    check(
      "tenant_ai_data_use_authorizations_service_scope_chk",
      sql`${t.serviceScope} in (${inList(EXTERNAL_AI_SERVICE_SCOPES_SQL)})`,
    ),
    check(
      "tenant_ai_data_use_authorizations_account_ref_chk",
      sql`char_length(btrim(${t.accountRef})) between 1 and 200`,
    ),
  ],
);

/**
 * The explicit (purpose, data class) snapshot one ACTIVE revision granted. Immutable: written in the
 * same transaction as its revision and never again. A withdrawn revision has none.
 */
export const tenantExternalAiDataUseAuthorizationScopes = pgTable(
  "tenant_ai_data_use_scopes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    authorizationId: uuid("authorization_id").notNull(),
    purpose: text("purpose").notNull(),
    dataClass: text("data_class").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** A scope row can never sit under another tenant's revision. */
    foreignKey({
      name: "tenant_ai_data_use_scopes_authorization_fk",
      columns: [t.authorizationId, t.tenantId],
      foreignColumns: [tenantExternalAiDataUseAuthorizations.id, tenantExternalAiDataUseAuthorizations.tenantId],
    }).onDelete("restrict"),
    uniqueIndex("tenant_ai_data_use_scopes_pair_uq").on(t.authorizationId, t.purpose, t.dataClass),
    check(
      "tenant_ai_data_use_scopes_purpose_chk",
      sql`${t.purpose} in (${inList(EXTERNAL_AI_PURPOSES_SQL)})`,
    ),
    check(
      "tenant_ai_data_use_scopes_data_class_chk",
      sql`${t.dataClass} in (${inList(EXTERNAL_AI_DATA_CLASSES_SQL)})`,
    ),
  ],
);
