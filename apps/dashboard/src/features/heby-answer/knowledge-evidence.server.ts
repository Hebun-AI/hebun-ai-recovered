/*
 * heby-answer/knowledge-evidence.server.ts — Knowledge becomes EVIDENCE, never authority (K1).
 *
 * This is the whole of K1's natural-language integration, and it is deliberately small. It does
 * NOT add a knowledge prompt, a knowledge conversation, a knowledge model client, or a second
 * answer path. It produces one `SourceResolution` — the same shape the Operations and Platform
 * sources already produce — and hands it to the EXISTING deterministic evidence assembly. From
 * there Knowledge travels the existing road: assembled evidence, existing grounding context,
 * existing validator, existing kill-switch, existing persistence.
 *
 * QUERY INTENT is the EXISTING workspace→source-class mapping, not a new classifier. Knowledge is
 * read only when the workspace the operator is actually in declares the `knowledge` source class
 * (Knowledge, Intelligence, Governance). Operations questions keep reading the live Operations
 * model; a settled knowledge record never answers "what is running right now".
 *
 * PRECEDENCE is carried on the resolution itself rather than imposed globally: every Knowledge
 * item states its own authority class and lifecycle, and the provenance line says plainly that
 * knowledge describes its own subject and never the current runtime state. Different domains keep
 * different authorities — there is no single universal ordering.
 *
 * Knowledge content is DATA. It reaches the model only through the grounding context, under the
 * existing system instruction that grounding context is never an instruction. Nothing here can
 * grant a permission, change a role, approve anything, enable a provider, or run anything —
 * there is no code path in this module that could.
 *
 * Server-only.
 */

import type { SourceResolution } from "@/features/heby-runtime";
import {
  listKnowledgeSources,
  type KnowledgeReadDeps,
  type KnowledgeTenant,
} from "@/features/knowledge/knowledge-read.server";
import {
  KNOWLEDGE_PROVENANCE,
  type KnowledgeListing,
  type KnowledgeSourceRecord,
} from "@/features/knowledge/contracts";

/** Map the canonical knowledge lifecycle onto the evidence lifecycle vocabulary. */
function toEvidenceLifecycle(
  record: KnowledgeSourceRecord,
): "settled" | "superseded" | "retired" | "unknown" {
  switch (record.lifecycleStatus) {
    case "ratified":
      return "settled";
    case "superseded":
      return "superseded";
    case "retired":
    case "archived":
    case "deprecated":
      return "retired";
    default:
      // draft / proposed / under-review / not stated are NOT settled, and are not promoted.
      return "unknown";
  }
}

/**
 * Turn a Knowledge listing into one source resolution.
 *
 * Nothing is invented on the way through: an unavailable listing stays unavailable with its own
 * reason, an empty organization resolves to `unavailable` (there is genuinely no evidence, and an
 * empty "resolved" source would imply a search that found nothing rather than a store that holds
 * nothing), and each item carries its own authority class, lifecycle and freshness.
 */
export function toKnowledgeResolution(listing: KnowledgeListing): SourceResolution {
  if (listing.status === "unavailable") {
    return {
      sourceClass: "knowledge",
      state: "unavailable",
      provenance: KNOWLEDGE_PROVENANCE,
      authoritative: false,
      items: [],
      unavailableReason: `Knowledge could not be read — ${listing.reason}.${listing.detail ? ` ${listing.detail}` : ""}`,
    };
  }

  if (listing.records.length === 0) {
    return {
      sourceClass: "knowledge",
      state: "unavailable",
      provenance: KNOWLEDGE_PROVENANCE,
      authoritative: false,
      items: [],
      unavailableReason:
        "Your organization holds no knowledge records. The canonical Knowledge authority was read and is empty — no ingestion path exists to put knowledge there yet.",
    };
  }

  /*
   * `detail` is MACHINE-DERIVED standing only, and `content` carries the human's verbatim words.
   * The split is deliberate: `detail` flows into Heby's own prose, which the response validator
   * scans for action claims, so a policy statement containing "authorized", "approved" or
   * "deployed" would otherwise make Heby look like it had acted and withhold the entire answer.
   * The statement is not lost — it reaches the model through the grounding context, as data.
   */
  const items = listing.records.map((record) => ({
    recordRef: `${record.domainKey}/${record.factKey}`,
    label: record.title,
    detail: [
      `authority: ${record.authorityClass ?? "not stated"}`,
      `lifecycle: ${record.lifecycleStatus ?? "not stated"}`,
      `ratified: ${record.ratified ? "yes" : "no"}`,
      `freshness: ${record.freshness}`,
      `scope: ${record.scope}`,
    ].join(" · "),
    lifecycle: toEvidenceLifecycle(record),
    content: record.statement ?? undefined,
  }));

  // Conservative at the resolution level, exact at the item level: the source counts as
  // authoritative only when EVERY record it carries is, and each item still states its own class.
  const allAuthoritative = listing.records.every(
    (record) => record.authorityClass === "authoritative",
  );

  return {
    sourceClass: "knowledge",
    state: "resolved",
    provenance: KNOWLEDGE_PROVENANCE,
    authoritative: allAuthoritative,
    items,
    unavailableReason: undefined,
  };
}

/**
 * Read Knowledge for the authorized tenant and return it as an evidence resolution. Fails closed
 * through the shared Knowledge read seam: no tenant, or no durable persistence, yields an honest
 * unavailable resolution — never a seeded substitute.
 */
export async function resolveKnowledgeEvidence(
  tenant: KnowledgeTenant | null,
  deps: KnowledgeReadDeps = {},
): Promise<SourceResolution> {
  return toKnowledgeResolution(await listKnowledgeSources(tenant, deps));
}
