/*
 * company-memory/view-mapper.ts — pure mapping from a REAL PersistedMemoryRecord
 * to the read-only Company Memory view (Hebun UI Phase 21B).
 *
 * Pure and deterministic. It copies only fields that exist on the record; it
 * invents no summary, owner, department, timestamp, score, freshness, tag, actor,
 * decision, or confidence percentage. Content is withheld (never surfaced) when
 * the record's sensitivity is "restricted".
 */

import type { PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import type { MemoryAttributeValue } from "@/features/enterprise-memory";
import type {
  CompanyMemoryRecordView,
  CompanyMemoryReferenceView,
} from "./contracts";

/** Restricted content is withheld from display; every other level is shown. */
function isWithheld(sensitivity: PersistedMemoryRecord["record"]["classification"]["sensitivity"]): boolean {
  return sensitivity === "restricted";
}

function stringifyAttribute(value: MemoryAttributeValue): string {
  if (value === null) return "null";
  return String(value);
}

function toReference(ref: { memoryId: string; namespace: string }): CompanyMemoryReferenceView {
  return { memoryId: ref.memoryId, namespace: ref.namespace };
}

/** Map one real persisted memory record to its read-only view. */
export function toCompanyMemoryView(persisted: PersistedMemoryRecord): CompanyMemoryRecordView {
  const { record, writeIdentity, metadata, supersededBy } = persisted;
  const withheld = isWithheld(record.classification.sensitivity);

  return {
    memoryId: writeIdentity.memoryId,
    namespace: writeIdentity.namespace,
    version: writeIdentity.version,
    isCurrent: metadata.isCurrent,

    statement: withheld ? null : record.content.statement,
    contentWithheld: withheld,
    attributes: withheld
      ? []
      : Object.entries(record.content.attributes).map(([key, value]) => ({
          key,
          value: stringifyAttribute(value),
        })),

    origin: {
      kind: record.source.kind,
      reference: record.source.reference,
      originatedAt: record.source.originatedAt,
    },
    authority: {
      authorityType: record.authority.authorityType,
      admittedByType: record.authority.admittedBy.type,
      admittedById: record.authority.admittedBy.id,
      grantReference: record.authority.grantReference,
      admittedAt: record.authority.admittedAt,
    },
    provenance: {
      method: record.provenance.method,
      derivedFrom: record.provenance.derivedFrom.map(toReference),
      recordedAt: record.provenance.recordedAt,
    },
    confidence: {
      level: record.confidence.level,
      score: record.confidence.score ?? null,
      rationale: record.confidence.rationale ?? null,
    },
    classification: {
      category: record.classification.category,
      sensitivity: record.classification.sensitivity,
      tags: [...record.classification.tags],
    },
    lifecycle: {
      state: record.lifecycle.state,
      enteredAt: record.lifecycle.enteredAt,
    },
    relationships: record.relationships.map((relationship) => ({
      type: relationship.type,
      target: toReference(relationship.target),
    })),
    supersededBy: supersededBy
      ? {
          supersededByVersion: supersededBy.supersededByVersion,
          supersededAt: supersededBy.supersededAt,
        }
      : null,
    storedAt: metadata.storedAt,
  };
}
