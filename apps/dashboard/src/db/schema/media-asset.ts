/*
 * media_generation_invocations + media_assets — the Media Asset authority (MEDIA-1).
 *
 * TWO FACTS, DELIBERATELY TWO TABLES:
 *
 *   media_generation_invocations   "a human asked for an image from THIS draft revision, a durable
 *                                   agent was named, this transport ran, and this is how far it got"
 *   media_assets                   "Hebun admitted THESE exact image bytes, verified, and holds them
 *                                   under THIS storage identity"
 *
 * One table cannot hold both. A refused or failed generation produces NO asset, yet the attempt —
 * its request key, its provider job id, its failure — must stay durable. Folding the two together
 * would either make the asset row mutable (state transitions) or make "an attempt exists" and "an
 * asset exists" the same question. Same reasoning `heby_origination_invocations` records for why a
 * model call is not an entity.
 *
 * ── WHAT THIS AUTHORITY DOES NOT OWN ─────────────────────────────────────────
 *
 * It does NOT own the draft. The invocation REFERENCES one exact revision through the revision
 * table's own unique key (tenant_id, artifact_id, revision_no); nothing is copied from it and nothing
 * is written to it. It does NOT own review: acceptance lives in `decision_records` (subject
 * `media_asset`), and there is no `accepted` column here. It does NOT own publication: no column
 * here is read by any permit, action or execution path. It is NOT Knowledge.
 *
 * It does NOT hold bytes. Bytes live behind the storage port; this row holds their verified identity
 * (SHA-256, size, MIME, dimensions) and the key they were written under.
 *
 * ── MEDIA-1 IS IMAGE-ONLY, AND THE SCHEMA SAYS SO ────────────────────────────
 *
 * There is no media kind column and no duration column: the MIME allowlist is the kind, and nothing
 * that is not a PNG, JPEG or WebP image is representable. Video is a future migration, not a
 * nullable column waiting for it.
 *
 * ── TRANSPORT KINDS: `fake` AND, SINCE MEDIA-2A, `live` ─────────────────────────
 *
 * MEDIA-1 CHECKed `transport` to `'fake'`, so a live row was unwritable. MEDIA-2A widens it to exactly
 * `fake | live` — the one live transport being OpenAI GPT Image, text-to-image. Widening the CHECK
 * authorizes nothing: a live transport is only ever resolved when its configuration is complete AND
 * the Director connectivity control `openai-image-generation` is ON (default OFF).
 *
 * ── MEDIA-2A: WHY A FAILURE CODE AND TWO TOKEN COUNTS, AND NOTHING ELSE ───────────
 *
 * `provider_failure`: MEDIA-1 finalized `dispatch-failed` / `provider-failed` with no reason, and
 * `admission_failure` may not carry one. Against a real provider "blocked by moderation", "rate
 * limited", "quota exhausted", "authentication failed" and "timed out" are different facts with
 * different remedies; recording them as one would be false legibility. Closed set, CHECKed.
 *
 * `provider_input_tokens` / `provider_output_tokens`: OpenAI prices GPT Image per token, not per
 * image. Without them a paid call's spend is unmeasurable. Same two facts the live Claude path
 * already records on `messages`. Nullable: a fake transport and a failed call report none.
 *
 * The provider's request identity reuses `provider_job_id` (OpenAI's `x-request-id`). No column added.
 *
 * ── NO PROVIDER URL IS EVER STORED ───────────────────────────────────────────
 *
 * There is no URL column on either table. A provider's download URL is an ephemeral, often signed,
 * credential-shaped string — the same doctrine that keeps Instagram `media_url` out of observation
 * facts.
 */
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  char,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { actorTypeEnum } from "./_enums";
import { agents } from "./agent";
import { companies } from "./company";
import { workArtifactRevisions } from "./work-artifact";

/*
 * ── A TYPED FORWARD REFERENCE TO `media_assets`, AND WHY IT EXISTS ───────────
 *
 * MEDIA-5 makes the two tables reference each other: an asset names the invocation that produced it,
 * and a reference-edit invocation names the asset it was performed on. At RUNTIME that is fine —
 * drizzle evaluates a table's config lazily, and the generated SQL carries both constraints.
 *
 * TypeScript is the problem: inferring either table's type would require inferring the other's, and
 * it stops with "implicitly has type any ... referenced directly or indirectly in its own
 * initializer". The getters below carry an EXPLICIT return type, so inference has something to trust
 * and never recurses. Nothing the constraint depends on is weakened — the columns, the target table
 * and the ON DELETE behaviour are all still declared at the constraint itself, and drizzle-kit emits
 * exactly the foreign key it would have emitted without this indirection.
 *
 * This is the two-table form of the escape hatch drizzle already prescribes for a self-referencing
 * column (`(): AnyPgColumn => table.column`).
 */
const mediaAssetsForwardRef = {
  get tenantId(): AnyPgColumn {
    return mediaAssets.tenantId;
  },
  get id(): AnyPgColumn {
    return mediaAssets.id;
  },
};

/**
 * One generation attempt. Written ONCE as `registered` before any transport call, then finalized
 * exactly once. Never deleted.
 */
export const mediaGenerationInvocations = pgTable(
  "media_generation_invocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id),

    /**
     * The caller-supplied idempotency key. Unique per tenant, so a second submission of the same
     * request cannot register a second attempt and therefore cannot reach the transport twice.
     */
    requestKey: uuid("request_key").notNull(),

    /** The human who asked. CHECKed to `human`: no agent or system may originate a generation. */
    requestedByActorType: actorTypeEnum("requested_by_actor_type").notNull(),
    requestedByActorId: uuid("requested_by_actor_id").notNull(),

    /** The durable agent recorded as the generating author. Never null: no agent, no attempt. */
    agentId: uuid("agent_id").notNull(),

    /** The exact draft revision the prompt was prepared from — a reference, never a copy. */
    sourceArtifactId: uuid("source_artifact_id").notNull(),
    sourceRevisionNo: integer("source_revision_no").notNull(),

    /**
     * MEDIA-5 — the admitted image this attempt was performed ON, when there was one.
     *
     * NULL means text-to-image, which is every invocation MEDIA-1 through MEDIA-4A ever wrote. The
     * column is nullable for that reason and for no other: absence is a real, permanent kind of
     * request, not a backfill gap.
     *
     * IT SITS BESIDE THE DRAFT PROVENANCE, NOT INSTEAD OF IT. A reference edit is still asked from a
     * draft revision, so `source_artifact_id` / `source_revision_no` stay NOT NULL. The two facts
     * answer different questions — "which draft asked for this" and "which image was edited" — and
     * collapsing them would lose one.
     *
     * ── WHY A COLUMN, AND NOT A RELATION TABLE ──────────────────────────────
     *
     * The relation is 0..1 and the input is SINGULAR: the provider's edit contract has one
     * distinguished image. MEDIA-1 already models this invocation's other singular provenance as
     * columns on this row, and `work_evidence_references` settled the general principle that a typed
     * column with a composite foreign key beats a polymorphic pair no constraint can enforce. If
     * additional reference images are ever admitted, "the other references" is a DIFFERENT fact and
     * deserves its own table — not a retrofit of this one.
     *
     * ── LINEAGE IS NOT OWNERSHIP ────────────────────────────────────────────
     *
     * Naming an asset here changes nothing about it. It does not select it, attach it, approve it,
     * retire it or extend its lifecycle, and no writer reads this column to decide any of those. A
     * chain A → B → C is walkable one hop at a time because `media_assets_invocation_uq` keeps one
     * asset per invocation, so each hop is unambiguous without a graph.
     */
    sourceMediaAssetId: uuid("source_media_asset_id"),

    /** The bounded prompt, verbatim. Data, never executed. */
    promptText: text("prompt_text").notNull(),
    /** SHA-256 over the canonical generation input (see `media-assets/input-digest.ts`). */
    inputDigest: char("input_digest", { length: 64 }).notNull(),

    /* ── Transport identity, recorded on the attempt and ONLY here ─────────── */
    transport: text("transport").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    /**
     * The provider's own identity for this request or job — for OpenAI the `x-request-id` response
     * header. Null until and unless the provider returned one.
     */
    providerJobId: text("provider_job_id"),
    /** A closed provider failure code; non-null exactly when the state is a dispatch/provider failure. */
    providerFailure: text("provider_failure"),
    /** Provider-reported usage, when it reported any. Both or neither. */
    providerInputTokens: integer("provider_input_tokens"),
    providerOutputTokens: integer("provider_output_tokens"),

    /** registered → dispatch-failed | provider-failed | provider-succeeded */
    state: text("state").notNull(),
    /** not-attempted → admitted | refused | failed. Orthogonal to `state` on purpose. */
    admissionOutcome: text("admission_outcome").notNull().default("not-attempted"),
    /** A closed refusal/failure code; null unless the admission outcome is refused or failed. */
    admissionFailure: text("admission_failure"),

    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  },
  (t) => [
    /*
     * A table CONSTRAINT, not a unique index, on purpose: drizzle-kit emits foreign keys before
     * indexes, and `media_assets` references this pair in the same migration. Inline, it exists first.
     */
    unique("media_generation_invocations_id_tenant_uq").on(t.tenantId, t.id),
    uniqueIndex("media_generation_invocations_request_key_uq").on(t.tenantId, t.requestKey),
    index("media_generation_invocations_source_idx").on(
      t.tenantId,
      t.sourceArtifactId,
      t.sourceRevisionNo,
    ),

    foreignKey({
      name: "media_generation_invocations_tenant_agent_fk",
      columns: [t.tenantId, t.agentId],
      foreignColumns: [agents.tenantId, agents.id],
    }).onDelete("restrict"),

    /*
     * Structural tenant containment: the source revision must be THIS tenant's revision. Targets the
     * revision table's existing unique index, so R3W gains no index and no column.
     */
    foreignKey({
      name: "media_generation_invocations_source_revision_fk",
      columns: [t.tenantId, t.sourceArtifactId, t.sourceRevisionNo],
      foreignColumns: [
        workArtifactRevisions.tenantId,
        workArtifactRevisions.artifactId,
        workArtifactRevisions.revisionNo,
      ],
    }).onDelete("restrict"),

    /*
     * MEDIA-5 — structural tenant containment for the image input, exactly as the source revision
     * already has. The target is the `media_assets_id_tenant_uq` constraint MEDIA-1 already declared,
     * so no index and no column is added to `media_assets`.
     *
     * MATCH SIMPLE (PostgreSQL's default) lets a NULL satisfy the constraint, so a text-to-image
     * invocation passes untouched while a supplied asset id is forced to be THIS tenant's. Borrowing
     * another tenant's image is unrepresentable, not merely refused in code.
     *
     * `restrict` on delete for the same reason every other media foreign key uses it: lineage is
     * history, and history is not deleted out from under a row that cites it.
     */
    /*
     * ── WHY THE REFERENCED COLUMNS ARE ANNOTATED ────────────────────────────
     *
     * `media_assets` already references THIS table, so naming it here closes a circle. At runtime
     * that is fine — drizzle evaluates this config lazily — but TypeScript must infer each table's
     * type from the other's and gives up with "implicitly has type any ... referenced directly or
     * indirectly in its own initializer".
     *
     * `mediaAssetsForwardRef` above is the way out; its header explains why. The generated SQL is
     * unchanged and the constraint is real.
     */
    foreignKey({
      name: "media_generation_invocations_source_asset_fk",
      columns: [t.tenantId, t.sourceMediaAssetId],
      foreignColumns: [mediaAssetsForwardRef.tenantId, mediaAssetsForwardRef.id],
    }).onDelete("restrict"),

    check(
      "media_generation_invocations_human_requester_chk",
      sql`${t.requestedByActorType} = 'human'`,
    ),
    check("media_generation_invocations_revision_no_chk", sql`${t.sourceRevisionNo} >= 1`),
    check(
      "media_generation_invocations_prompt_chk",
      sql`char_length(${t.promptText}) between 1 and 4000`,
    ),
    check(
      "media_generation_invocations_input_digest_chk",
      sql`${t.inputDigest} ~ '^[0-9a-f]{64}$'`,
    ),
    check("media_generation_invocations_transport_chk", sql`${t.transport} in ('fake','live')`),
    check(
      "media_generation_invocations_provider_failure_chk",
      sql`${t.providerFailure} is null or ${t.providerFailure} in ('authentication-failed','request-rejected','moderation-blocked','rate-limited','quota-exhausted','timeout','provider-unavailable','malformed-response','budget-exhausted','dispatch-error')`,
    ),
    check(
      "media_generation_invocations_provider_failure_state_chk",
      sql`(${t.providerFailure} is not null) = (${t.state} in ('dispatch-failed','provider-failed'))`,
    ),
    check(
      "media_generation_invocations_provider_usage_chk",
      sql`(${t.providerInputTokens} is null) = (${t.providerOutputTokens} is null) and (${t.providerInputTokens} is null or (${t.providerInputTokens} >= 0 and ${t.providerOutputTokens} >= 0))`,
    ),
    check(
      "media_generation_invocations_state_chk",
      sql`${t.state} in ('registered','dispatch-failed','provider-failed','provider-succeeded')`,
    ),
    check(
      "media_generation_invocations_admission_outcome_chk",
      sql`${t.admissionOutcome} in ('not-attempted','admitted','refused','failed')`,
    ),
    /* Admission is only ever attempted on a provider success. */
    check(
      "media_generation_invocations_admission_requires_success_chk",
      sql`${t.admissionOutcome} = 'not-attempted' or ${t.state} = 'provider-succeeded'`,
    ),
    check(
      "media_generation_invocations_admission_failure_chk",
      sql`(${t.admissionFailure} is not null) = (${t.admissionOutcome} in ('refused','failed'))`,
    ),
    /* Finalized exactly when it left `registered`. */
    check(
      "media_generation_invocations_finalized_chk",
      sql`(${t.finalizedAt} is null) = (${t.state} = 'registered')`,
    ),
  ],
);

/**
 * One admitted image. The byte identity (digest, size, MIME, dimensions, storage key) is immutable;
 * the only transition is `admitted → retired`, which keeps the bytes.
 */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id),

    /**
     * The attempt that produced these bytes. One asset per invocation in MEDIA-1.
     *
     * PUBLISH-0 — NULL exactly when the asset is a DERIVED asset (below). A derivative was produced
     * by no generation attempt, so naming one would be a false provenance; `media_assets_origin_chk`
     * makes "generated" (invocation set) and "derived" (lineage set) mutually exclusive and
     * exhaustive, so every row is exactly one of the two.
     */
    invocationId: uuid("invocation_id"),

    /*
     * ── PUBLISH-0: DETERMINISTIC DERIVED ASSETS ─────────────────────────────
     *
     * A derived asset is a deterministic transform of ONE generated asset of the SAME tenant — today
     * only `jpeg-publish-v1`, the JPEG Instagram's publish API requires. It is a Media Asset like any
     * other (verified bytes, immutable identity, storage key under its own id), and it is NOT new
     * creative work: normal gallery / composer / review reads join through the invocation and so
     * never see it.
     *
     *   derived_from_asset_id   the original, by composite FK on (tenant_id, id) — cross-tenant
     *                           lineage is unrepresentable
     *   derivation              the closed transform name; CHECKed; one row per source + derivation
     *
     * Derivation grants NOTHING. No permit, action or execution path reads these columns as
     * authority; a publish still needs proposal → human approval → permit → execution.
     */
    derivedFromAssetId: uuid("derived_from_asset_id"),
    derivation: text("derivation"),

    /*
     * ── MEDIA-SUPPLIED: IMAGES A HUMAN SUPPLIED, NOT IMAGES A MODEL MADE ────────
     *
     * A supplied asset is bytes a named human chose from the tenant's own Google Drive and asked
     * Hebun to admit for ONE exact content-draft revision. It is the third origin, beside generated
     * and derived, and like them it is a row of THIS authority — same verification, same storage
     * port, same key shape, same lifecycle. It is not a second media system.
     *
     * WHY COLUMNS HERE AND NOT AN INVOCATION ROW. `media_generation_invocations` records a GENERATION:
     * its agent, prompt, transport, provider and model are NOT NULL, and each would be a lie for a
     * photograph a human supplied. PUBLISH-0 settled the precedent for derived assets: singular
     * provenance of a non-generated asset is typed columns on the asset, CHECKed exclusive with the
     * other origins. The asset row is written once and never transitions, so no attempt table is
     * needed — a refused supply writes nothing.
     *
     *   supplied_by_actor_type / _id   the human, from the trusted session — CHECKed to `human`
     *   supplied_source                closed: `google-drive`
     *   supplied_source_file_id        Drive's opaque file id — an IDENTITY, never a URL
     *   supplied_source_capability     the Drive content capability the read actually ran under
     *   supplied_artifact_id / _rev    the exact draft revision it was supplied for, by composite FK
     *
     * A Drive file is NEVER media because it exists in Drive. Only the bytes Hebun read, verified,
     * stored and re-verified become an asset, and the file id is kept as where they came from — not
     * as a live pointer anything reads again.
     *
     * Supplying grants NOTHING. It is not a review, not an approval, not a permit.
     */
    suppliedByActorType: actorTypeEnum("supplied_by_actor_type"),
    suppliedByActorId: uuid("supplied_by_actor_id"),
    suppliedSource: text("supplied_source"),
    suppliedSourceFileId: text("supplied_source_file_id"),
    suppliedSourceCapability: text("supplied_source_capability"),
    suppliedArtifactId: uuid("supplied_artifact_id"),
    suppliedRevisionNo: integer("supplied_revision_no"),

    /** Detected from magic bytes by Hebun — never taken from the provider. */
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    /** SHA-256 over the exact admitted bytes, lowercase hex, computed by Hebun. */
    byteDigest: char("byte_digest", { length: 64 }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),

    /** Which storage port implementation holds the bytes. Named by the port, not by this row. */
    storageBackend: text("storage_backend").notNull(),
    /** `tenants/<tenant_id>/media/<id>` — CHECKed below, so the key can never name another tenant. */
    storageKey: text("storage_key").notNull(),

    admittedAt: timestamp("admitted_at", { withTimezone: true }).notNull(),

    assetLifecycleStatus: text("asset_lifecycle_status").notNull().default("admitted"),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    retiredByActorId: uuid("retired_by_actor_id"),
  },
  (t) => [
    unique("media_assets_id_tenant_uq").on(t.tenantId, t.id),
    uniqueIndex("media_assets_invocation_uq").on(t.invocationId),
    uniqueIndex("media_assets_storage_key_uq").on(t.storageKey),

    foreignKey({
      name: "media_assets_tenant_invocation_fk",
      columns: [t.tenantId, t.invocationId],
      foreignColumns: [mediaGenerationInvocations.tenantId, mediaGenerationInvocations.id],
    }).onDelete("restrict"),

    /*
     * PUBLISH-0 — lineage is THIS tenant's asset, structurally. The target is the table's own
     * (tenant_id, id) constraint; MATCH SIMPLE lets a generated row's NULL pass.
     */
    foreignKey({
      name: "media_assets_tenant_derived_from_fk",
      columns: [t.tenantId, t.derivedFromAssetId],
      foreignColumns: [t.tenantId, t.id],
    }).onDelete("restrict"),
    /* One derivative per source + derivation. NULLs are distinct, so generated rows are untouched. */
    uniqueIndex("media_assets_derivation_uq").on(t.derivedFromAssetId, t.derivation),
    /*
     * Generated XOR derived XOR supplied — exclusive and exhaustive. A supplied row carries ALL of its
     * provenance or it is not representable; a generated or derived row carries none of it.
     */
    check(
      "media_assets_origin_chk",
      sql`(${t.invocationId} is not null and ${t.derivedFromAssetId} is null and ${t.derivation} is null
          and ${t.suppliedByActorType} is null and ${t.suppliedByActorId} is null and ${t.suppliedSource} is null
          and ${t.suppliedSourceFileId} is null and ${t.suppliedSourceCapability} is null
          and ${t.suppliedArtifactId} is null and ${t.suppliedRevisionNo} is null)
        or (${t.invocationId} is null and ${t.derivedFromAssetId} is not null and ${t.derivation} is not null
          and ${t.suppliedByActorType} is null and ${t.suppliedByActorId} is null and ${t.suppliedSource} is null
          and ${t.suppliedSourceFileId} is null and ${t.suppliedSourceCapability} is null
          and ${t.suppliedArtifactId} is null and ${t.suppliedRevisionNo} is null)
        or (${t.invocationId} is null and ${t.derivedFromAssetId} is null and ${t.derivation} is null
          and ${t.suppliedByActorType} is not null and ${t.suppliedByActorId} is not null and ${t.suppliedSource} is not null
          and ${t.suppliedSourceFileId} is not null and ${t.suppliedSourceCapability} is not null
          and ${t.suppliedArtifactId} is not null and ${t.suppliedRevisionNo} is not null)`,
    ),

    /* MEDIA-SUPPLIED — the draft revision is THIS tenant's, structurally. MATCH SIMPLE passes NULLs. */
    foreignKey({
      name: "media_assets_supplied_revision_fk",
      columns: [t.tenantId, t.suppliedArtifactId, t.suppliedRevisionNo],
      foreignColumns: [
        workArtifactRevisions.tenantId,
        workArtifactRevisions.artifactId,
        workArtifactRevisions.revisionNo,
      ],
    }).onDelete("restrict"),
    index("media_assets_supplied_source_idx").on(t.tenantId, t.suppliedArtifactId, t.suppliedRevisionNo),
    /*
     * Idempotent supply: the same bytes from the same Drive file for the same revision are ONE asset.
     * NULLs are distinct, so generated and derived rows are untouched.
     */
    uniqueIndex("media_assets_supplied_uq").on(
      t.tenantId,
      t.suppliedArtifactId,
      t.suppliedRevisionNo,
      t.suppliedSource,
      t.suppliedSourceFileId,
      t.byteDigest,
    ),
    check(
      "media_assets_supplied_human_chk",
      sql`${t.suppliedByActorType} is null or ${t.suppliedByActorType} = 'human'`,
    ),
    check(
      "media_assets_supplied_source_chk",
      sql`${t.suppliedSource} is null or ${t.suppliedSource} in ('google-drive')`,
    ),
    check(
      "media_assets_supplied_file_id_chk",
      /* PostgreSQL caps a regex bound at 255, so the length is its own predicate. */
      sql`${t.suppliedSourceFileId} is null or (${t.suppliedSourceFileId} ~ '^[A-Za-z0-9_-]+$' and char_length(${t.suppliedSourceFileId}) between 1 and 256)`,
    ),
    check(
      "media_assets_supplied_capability_chk",
      sql`${t.suppliedSourceCapability} is null or ${t.suppliedSourceCapability} in ('google.drive.content.read','google.drive.file.content.read')`,
    ),
    check(
      "media_assets_supplied_revision_no_chk",
      sql`${t.suppliedRevisionNo} is null or ${t.suppliedRevisionNo} >= 1`,
    ),
    check(
      "media_assets_derivation_chk",
      sql`${t.derivation} is null or ${t.derivation} in ('jpeg-publish-v1')`,
    ),
    check(
      "media_assets_derivation_jpeg_chk",
      sql`${t.derivation} is distinct from 'jpeg-publish-v1' or ${t.mimeType} = 'image/jpeg'`,
    ),
    check(
      "media_assets_derivation_not_self_chk",
      sql`${t.derivedFromAssetId} is null or ${t.derivedFromAssetId} <> ${t.id}`,
    ),

    check(
      "media_assets_mime_type_chk",
      sql`${t.mimeType} in ('image/png','image/jpeg','image/webp')`,
    ),
    check("media_assets_byte_size_chk", sql`${t.byteSize} between 1 and 20971520`),
    check("media_assets_byte_digest_chk", sql`${t.byteDigest} ~ '^[0-9a-f]{64}$'`),
    check("media_assets_width_chk", sql`${t.width} between 1 and 8192`),
    check("media_assets_height_chk", sql`${t.height} between 1 and 8192`),
    check("media_assets_storage_backend_chk", sql`${t.storageBackend} ~ '^[a-z0-9-]{1,32}$'`),
    check(
      "media_assets_storage_key_chk",
      sql`${t.storageKey} = 'tenants/' || ${t.tenantId}::text || '/media/' || ${t.id}::text`,
    ),
    check(
      "media_assets_lifecycle_chk",
      sql`${t.assetLifecycleStatus} in ('admitted','retired')`,
    ),
    check(
      "media_assets_retirement_chk",
      sql`(${t.assetLifecycleStatus} = 'retired') = (${t.retiredAt} is not null and ${t.retiredByActorId} is not null)
        and (${t.retiredAt} is null) = (${t.retiredByActorId} is null)`,
    ),
  ],
);
