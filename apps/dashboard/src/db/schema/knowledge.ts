/* Knowledge graph — nodes and directed edges (node <-> node, many-to-many). */
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import {
  actorTypeEnum,
  knowledgeAuthorityEnum,
  knowledgeHealthEnum,
  knowledgeLifecycleStatusEnum,
  knowledgeScopeEnum,
} from "./_enums";
import { governanceSessions, decisionRecords } from "./governance";

export const knowledgeNodes = pgTable(
  "knowledge_nodes",
  {
    ...tenantColumns,
    type: text("type").notNull(),
    refId: text("ref_id"),
    label: text("label").notNull(),

    /* ── S10 governed truth metadata (dual-shape, additive only) ── */
    statement: text("statement"),
    knowledgeLifecycleStatus: knowledgeLifecycleStatusEnum("knowledge_lifecycle_status"),
    knowledgeHealth: knowledgeHealthEnum("knowledge_health"),
    knowledgeScope: knowledgeScopeEnum("knowledge_scope"),
    knowledgeAuthority: knowledgeAuthorityEnum("knowledge_authority"),
    domainKey: text("domain_key"),
    categoryKey: text("category_key"),
    ownerActorType: actorTypeEnum("owner_actor_type"),
    ownerActorId: uuid("owner_actor_id"),
    stewardActorType: actorTypeEnum("steward_actor_type"),
    stewardActorId: uuid("steward_actor_id"),
    provenance: jsonb("provenance"),
    sourceAttribution: jsonb("source_attribution"),
    references: jsonb("references"),
    dependencies: jsonb("dependencies"),
    memoryRefs: jsonb("memory_refs"),
    governanceSessionId: uuid("governance_session_id").references(
      () => governanceSessions.id,
    ),
    ratificationDecisionId: uuid("ratification_decision_id").references(
      () => decisionRecords.id,
    ),
    ratifiedByActorType: actorTypeEnum("ratified_by_actor_type"),
    ratifiedByActorId: uuid("ratified_by_actor_id"),
    ratifiedAt: timestamp("ratified_at", { withTimezone: true }),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    reviewCadence: text("review_cadence"),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    freshnessEvaluatedAt: timestamp("freshness_evaluated_at", {
      withTimezone: true,
    }),
    deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    knowledgeVersion: integer("knowledge_version").notNull().default(1),
    supersedesKnowledgeNodeId: uuid("supersedes_knowledge_node_id").references(
      (): AnyPgColumn => knowledgeNodes.id,
    ),
    /*
     * SCI-2B. TRUE: this version was inserted while the SCI-2A immutability triggers were enabled,
     * so its content has been protected since creation. NULL: not established (every row older
     * than the column, or inserted while protection was off). Written ONLY by the database — the
     * `knowledge_nodes_stamp_integrity_at_insert` trigger overwrites whatever an INSERT supplies —
     * and frozen afterwards by SCI-2A's deny-by-default UPDATE rule. Never write it from code.
     */
    integrityProtectedAtInsert: boolean("integrity_protected_at_insert"),
  },
  (t) => [
    index("knowledge_nodes_tenant_domain_scope_idx").on(
      t.tenantId,
      t.domainKey,
      t.knowledgeScope,
    ),
    index("knowledge_nodes_next_review_at_idx").on(t.nextReviewAt),
    index("knowledge_nodes_supersedes_knowledge_node_id_idx").on(
      t.supersedesKnowledgeNodeId,
    ),
  ],
);

export const knowledgeEdges = pgTable(
  "knowledge_edges",
  {
    ...tenantColumns,
    fromNodeId: uuid("from_node_id").notNull().references(() => knowledgeNodes.id),
    toNodeId: uuid("to_node_id").notNull().references(() => knowledgeNodes.id),
    relation: text("relation").notNull(),
    weight: doublePrecision("weight").notNull().default(1),

    /* ── S10 governed relationship metadata (dual-shape, additive only) ── */
    relationshipCategory: text("relationship_category"),
    edgeLifecycleStatus: text("edge_lifecycle_status"),
    edgeVersion: integer("edge_version").notNull().default(1),
    domainKey: text("domain_key"),
    scopeMetadata: jsonb("scope_metadata"),
    provenance: jsonb("provenance"),
    governanceSessionId: uuid("governance_session_id").references(
      () => governanceSessions.id,
    ),
    ratificationDecisionId: uuid("ratification_decision_id").references(
      () => decisionRecords.id,
    ),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    supersedesKnowledgeEdgeId: uuid("supersedes_knowledge_edge_id").references(
      (): AnyPgColumn => knowledgeEdges.id,
    ),
    metadata: jsonb("metadata"),
  },
  (t) => [
    index("knowledge_edges_tenant_domain_key_idx").on(t.tenantId, t.domainKey),
    index("knowledge_edges_supersedes_knowledge_edge_id_idx").on(
      t.supersedesKnowledgeEdgeId,
    ),
  ],
);
