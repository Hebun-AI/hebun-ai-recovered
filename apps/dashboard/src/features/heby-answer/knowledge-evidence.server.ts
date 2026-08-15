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
  searchKnowledge,
  type KnowledgeReadDeps,
  type KnowledgeTenant,
} from "@/features/knowledge/knowledge-read.server";
import {
  KNOWLEDGE_PROVENANCE,
  type KnowledgeListing,
  type KnowledgeSourceRecord,
} from "@/features/knowledge/contracts";
import {
  RETRIEVAL_PROVENANCE,
  type RetrievalResult,
} from "@/features/knowledge-retrieval";

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
      /*
       * AN EMPTY CORPUS IS NOT A MISSING CAPABILITY, and this sentence must not confuse the two.
       * It once said no ingestion path existed; one does now, so saying that would be false and
       * would also hide the remedy from the person who could apply it.
       */
      unavailableReason:
        "Your organization holds no knowledge records. The canonical Knowledge authority was read and is genuinely empty — that is your organization's real state, not a read failure. Knowledge is put there through the Knowledge workspace, and none has been yet.",
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

/* ── KR3: the question finally reaches the evidence ─────────────────────────
 *
 * Until now `resolveKnowledgeEvidence` took no query and every Knowledge answer carried the same
 * alphabetical first 50 records regardless of what was asked. It now takes the validated prompt and
 * returns the records that bear on it.
 *
 * WHAT DID NOT CHANGE, deliberately: the SourceResolution shape, the per-item authority/lifecycle/
 * ratification/freshness detail, the verbatim statement riding on `content` rather than `detail`,
 * the provenance line, and everything downstream — evidence assembly, grounding context, the model
 * call, the validator, persistence and the kill switch. Retrieval changes WHICH records are in the
 * resolution, not what a resolution is.
 */

/**
 * Turn a retrieval result into one source resolution.
 *
 * THE FOUR EMPTY STATES SAY FOUR DIFFERENT THINGS. An organization that holds nothing, an
 * organization whose knowledge does not cover this question, a question with no searchable words,
 * and a read that failed are not interchangeable, and the sentence each produces must not imply
 * another. Telling someone "your organization holds no knowledge records" because one question
 * missed would be false about their organization — the exact class of claim this codebase has had to
 * repair three times.
 */
export function toRetrievalResolution(result: RetrievalResult): SourceResolution {
  const unavailable = (reason: string): SourceResolution => ({
    sourceClass: "knowledge",
    state: "unavailable",
    provenance: RETRIEVAL_PROVENANCE,
    authoritative: false,
    items: [],
    unavailableReason: reason,
  });

  switch (result.status) {
    case "unavailable":
      return unavailable(
        `Knowledge could not be read — ${result.reason}.${result.detail ? ` ${result.detail}` : ""}`,
      );

    case "empty-query":
      return unavailable(
        "Your question carried no searchable term, so no knowledge was retrieved. This says nothing " +
          "about what your organization knows.",
      );

    case "empty-corpus":
      return unavailable(
        "Your organization holds no knowledge records. The canonical Knowledge authority was read " +
          "and is genuinely empty — that is your organization's real state, not a read failure. " +
          "Knowledge is put there through the Knowledge workspace, and none has been yet.",
      );

    case "no-match": {
      /*
       * The organization HOLDS knowledge. The honest statement is about the question, never about
       * the corpus. Where records matched but were withdrawn, say so — a silently missing answer is
       * worse than a missing one, because the reader cannot tell that a policy they remember exists.
       */
      const withdrawn = result.excluded.length;
      const degraded = result.capability.degradedReason;
      return unavailable(
        "Your organization holds knowledge records, but none of them match this question. " +
          (withdrawn > 0
            ? `${withdrawn} record(s) did match and were not served because they are no longer in force. `
            : "") +
          (degraded ? degraded : ""),
      );
    }

    case "matched": {
      const items = result.candidates.map(({ record }) => ({
        recordRef: `${record.domainKey}/${record.factKey}`,
        label: record.title,
        /*
         * MACHINE-DERIVED STANDING ONLY, exactly as before. The match score is deliberately NOT here:
         * `detail` becomes Heby's own prose, and a number beside a policy reads as a claim about how
         * true it is. Ordering already carries the match; a printed score would carry a meaning the
         * repository does not compute.
         */
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

      const allAuthoritative = result.candidates.every(
        ({ record }) => record.authorityClass === "authoritative",
      );

      return {
        sourceClass: "knowledge",
        state: "resolved",
        provenance: RETRIEVAL_PROVENANCE,
        authoritative: allAuthoritative,
        items,
        unavailableReason: undefined,
      };
    }
  }
}

/**
 * Retrieve Knowledge bearing on the authorized tenant's question and return it as evidence.
 *
 * Fails closed through the shared Knowledge read seam: no tenant, or no durable persistence, yields
 * an honest unavailable resolution — never a seeded substitute, and never a listing standing in for
 * a search.
 */
export async function resolveKnowledgeEvidence(
  tenant: KnowledgeTenant | null,
  query: string,
  deps: KnowledgeReadDeps = {},
): Promise<SourceResolution> {
  return toRetrievalResolution(await searchKnowledge(tenant, { queryText: query }, deps));
}

/**
 * The pre-KR3 listing path, kept because `/knowledge` and `/source` still need "what do we hold".
 * It is NOT the evidence path any more — a question-independent listing is not evidence for a
 * question, and calling it that is how "Knowledge connected" became a claim nobody could defend.
 */
export async function resolveKnowledgeListingEvidence(
  tenant: KnowledgeTenant | null,
  deps: KnowledgeReadDeps = {},
): Promise<SourceResolution> {
  return toKnowledgeResolution(await listKnowledgeSources(tenant, deps));
}
