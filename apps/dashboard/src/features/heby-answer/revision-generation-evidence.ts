/*
 * heby-answer/revision-generation-evidence.ts — what a reviewer is shown about the Knowledge that
 * was SUPPLIED TO GENERATION of one exact revision (KT-2). The client-safe half: types and words.
 *
 * ── WHAT IT IS ───────────────────────────────────────────────────────────────
 *
 * When Heby prepares a revision, the answer flow records — in the same transaction as the message
 * whose reply became the revision — the Knowledge its retrieval selected and handed to the model
 * (KR5). This is that record, replayed for the human reviewing those bytes.
 *
 * ── WHAT IT IS NOT ───────────────────────────────────────────────────────────
 *
 *     SUPPLIED TO GENERATION != SUPPORTS EVERY SENTENCE
 *     RECORDED THEN          != TRUE NOW
 *     NOTHING SELECTED       != NOTHING RECORDED       != COULD NOT BE READ
 *
 * Nothing here compares the revision's claims with the evidence. A revision can say things no
 * supplied record says — from the previous draft, from voice material, from the instruction, or from
 * the model — and this projection cannot tell which. The words below say so where the evidence is
 * read, because that is where the confusion would happen.
 *
 * Pure. No I/O. A client component may import it; it names no server module.
 */
import type { RevisionSupport, RevisionSupportStatus } from "@/features/knowledge-retrieval/claim-support";

/** The heading sentence, rendered verbatim above the evidence. */
export const REVISION_EVIDENCE_NOTICE =
  "Evidence supplied to generation: the Knowledge records Hebun's retrieval selected and handed to the model when it prepared this exact revision. It is not proof that the revision's claims are supported." as const;

/** What a reviewer must not read into the evidence. Rendered verbatim beside it. */
export const REVISION_EVIDENCE_NON_CLAIMS: readonly string[] = Object.freeze([
  "It does not show that every sentence in the revision is supported. Nothing compared the revision's claims with these records.",
  "The revision may contain claims that came from elsewhere — the previous draft, voice material, the instruction, or the model itself.",
  "It is the record made at generation time. It is not a re-run of retrieval and not today's current Knowledge; a record may have been superseded or rejected since.",
]);

/**
 * KT-5.2 — a `bounded-universe` selection, in words. The records were supplied whole because the
 * eligible set was small; "retrieval supplied" or "matched" would both be false here.
 */
export function boundedUniverseSelectionSentence(count: number, revisionNo: number): string {
  return `All ${count} Knowledge record${count === 1 ? "" : "s"} eligible for this purpose were supplied whole to the generation of revision ${revisionNo}, because the eligible set is small. They were not matched to the request, and none is claimed to support any particular claim.`;
}

/** One Knowledge record as it was supplied to generation — a snapshot, never a re-read. */
export interface RevisionEvidenceItem {
  readonly factKey: string;
  readonly domainKey: string;
  readonly title: string;
  readonly scope: string;
  /** The exact version row supplied. Null only for a record with no identifiable version row. */
  readonly knowledgeNodeId: string | null;
  readonly knowledgeVersion: number;
  readonly factVersion: number;
  /** The statement text as recorded with the evidence. */
  readonly excerpt: string | null;
  /** True when the recorded text was shortened when it was stored. */
  readonly excerptTruncated: boolean;
  /** Whether the version carried a ratification WHEN IT WAS SUPPLIED. Not today's standing. */
  readonly ratifiedAtGeneration: boolean;
  readonly authorityClass: string | null;
  readonly lifecycleStatus: string | null;
  readonly freshness: string;
  /** The query terms the record matched, as recorded. */
  readonly matchedTerms: readonly string[];
}

/** How the retrieval that ran for the generating message ended, as recorded. */
export interface RevisionEvidenceSelection {
  /** `matched` | `no-match` | `empty-corpus` | `empty-query` | `unavailable` | `bounded-universe` (KT-5.2: supplied whole, not matched), as recorded. */
  readonly status: string;
  readonly truncated: boolean;
  readonly excludedCount: number;
  readonly degradedReason: string | null;
  readonly unavailableReason: string | null;
}

/**
 * Six answers, kept apart on purpose.
 *
 *   unauthorized           no authenticated organization
 *   revision-unresolvable  no such revision of that artifact in this organization (a foreign one is
 *                          indistinguishable, so its existence is not confirmed)
 *   unavailable            the revision or its evidence could not be read — never "nothing recorded"
 *   no-generation-message  no message generated these bytes (for example, a human typed them)
 *   no-retrieval-recorded  a message generated them, but no Knowledge retrieval was recorded with it
 *   recorded               the retrieval that ran, and what it supplied — possibly nothing
 */
export type RevisionGenerationEvidence =
  | { readonly status: "unauthorized" }
  | { readonly status: "revision-unresolvable" }
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" | "provenance-unreadable" }
  | { readonly status: "no-generation-message"; readonly revisionNo: number }
  | { readonly status: "no-retrieval-recorded"; readonly revisionNo: number }
  | {
      readonly status: "recorded";
      readonly revisionNo: number;
      readonly selection: RevisionEvidenceSelection;
      readonly items: readonly RevisionEvidenceItem[];
      /** GS-1 — the automated grounding check, derived on this read. Advisory; decides nothing. */
      readonly grounding: RevisionSupport;
    };

/**
 * GS-1 — the automated grounding check, in words. A deterministic text check of the copy against the
 * records above: it can find claims those records do not state, and it can recognise a sentence a
 * record states word for word. It cannot tell whether anything is true, and it approves nothing.
 */
export const GROUNDING_CHECK_NOTICE =
  "Automated grounding check: compares each sentence of this revision with the Knowledge records supplied to its generation. It is advisory. It does not check whether anything is true, and it does not approve, reject or block this revision." as const;

export const GROUNDING_CHECK_VERDICT: Readonly<Record<RevisionSupportStatus, string>> = Object.freeze({
  supported: "Every sentence appears word for word in a supplied record. This is the automated check's result, not a review decision or a publication approval.",
  insufficient: "Some sentences state things the supplied Knowledge records do not state.",
  undetermined: "The automated check could not determine whether the supplied Knowledge supports every sentence. A person needs to compare them.",
  unavailable: "The automated grounding check is unavailable: the evidence recorded for this revision could not be read.",
});

/** For revisions with no recorded generation evidence (typed by a person, or recorded before evidence was kept). */
export const GROUNDING_CHECK_NOT_RUN =
  "Automated grounding check: not available — there is no recorded generation evidence to check this revision against." as const;

/** One sentence's verdict, in words, naming which kind of unsupported statement was found. */
export function groundingClaimLabel(support: RevisionSupport["claims"][number]["support"]): string {
  switch (support.status) {
    case "supported":
      return "appears word for word in a supplied record";
    case "insufficient":
      return support.reason === "no-evidence"
        ? "no Knowledge was supplied to support it"
        : `states something no supplied record states (${support.signals.join(", ")})`;
    case "contradicted":
      return "contradicted by a supplied record";
    case "undetermined":
      return "could not be determined automatically";
    case "unavailable":
      return "could not be checked";
  }
}
