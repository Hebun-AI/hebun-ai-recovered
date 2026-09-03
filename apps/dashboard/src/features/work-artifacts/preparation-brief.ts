/*
 * work-artifacts/preparation-brief.ts — what the model is TOLD when it prepares an artifact (CGO-4).
 *
 * ── THE PROBLEM THIS SOLVES, AND THE ONE IT REFUSES TO ──────────────────────
 *
 * CGO-3's first production content draft stored the model's whole reply: a sentence about what it
 * was about to do, the caption, and a paragraph explaining the caption. That is the released
 * no-parser doctrine working exactly as designed — every stored byte was authored by the model.
 * It is also not a caption a human can review as a caption.
 *
 * The tempting fix is a parser: find "the draft part" after generation and store that. It is
 * refused, here and in `prepare-work-artifact.server.ts`, for the same reason it was refused when
 * R3W was written: a parser is a second, silent author. It decides what the model meant, and the
 * bytes a human later approves would be bytes nobody wrote.
 *
 * So the change is made BEFORE generation, where authorship is not in question. The model is told,
 * once and in plain words, that its entire reply IS the artifact — and it authors the durable bytes
 * directly. Nothing downstream changes: the same validator judges the reply, the same seam stores
 * it verbatim, the same durable agent is named as its author.
 *
 * ── WHAT THE BRIEF SAYS AND DOES NOT SAY ────────────────────────────────────
 *
 * It says the artifact is PREPARED FOR a destination. It never says the destination is connected,
 * that the content will be published, scheduled or delivered, or that any provider exists — because
 * none of that is true (`CONTENT_DESTINATION_NON_CLAIMS`), and a model told otherwise would write
 * as though it were. "Prepared for Instagram" is the whole of what the model may know.
 *
 * It carries no destination-specific copy rules. The destination vocabulary is a closed enum with a
 * human-facing label and nothing else; inventing per-platform rules here would be a content policy
 * that no authority in this repository has declared.
 *
 * ── SCOPE ───────────────────────────────────────────────────────────────────
 *
 * Only `content-draft` receives a brief. `operational-plan` and `message-draft` are prepared exactly
 * as before — this phase changes one artifact type's preparation contract, not the preparation
 * runtime. A brief is INSTRUCTION to the model; it enforces nothing and is never stored.
 *
 * Pure. No I/O, no database, no model, no authority.
 */
import {
  CONTENT_DESTINATION_LABELS,
  CONTENT_DRAFT_TYPE,
  type ContentDestination,
  type WorkArtifactType,
} from "./contracts";

/**
 * The content-draft contract, as sentences the model receives verbatim after Heby's standing
 * system instructions. Exported so a test can assert the exact words the model was given, and so a
 * surface can quote what the model was asked for rather than paraphrase it.
 */
export const CONTENT_DRAFT_PREPARATION_BRIEF: readonly string[] = [
  "You are now preparing a CONTENT DRAFT, not answering a question.",
  "Your entire reply becomes the draft that a human will review, byte for byte, with nothing removed and nothing added.",
  "Return ONLY the content intended for human review.",
  "Do not include analysis, explanation, preamble, labels, headings about the task, commentary on the draft, or a postscript, unless that material is itself part of the intended content.",
  "Do not open with phrases such as \"Here is\", \"I have prepared\" or \"Below is\"; the first line of your reply is the first line of the content.",
  "Ground every organizational fact in the GROUNDING CONTEXT. If it is insufficient to prepare the content, reply with a single plain sentence naming what is missing, and nothing else.",
  "This is a draft for human review only. It is not scheduled, not published and not delivered, and nothing you write may claim or imply otherwise.",
] as const;

/**
 * The one destination sentence. "Prepared for", never "publishing to": the destination is the
 * human's declaration of where this draft was prepared to go, and the model is told exactly that.
 */
export function contentDraftDestinationSentence(destination: ContentDestination): string {
  return `The draft is prepared for ${CONTENT_DESTINATION_LABELS[destination]}. That is a declaration by the requesting human about where it was prepared to go; no ${CONTENT_DESTINATION_LABELS[destination]} account or connection is involved, and you must not address ${CONTENT_DESTINATION_LABELS[destination]} as a system you are posting to.`;
}

/**
 * Resolve the preparation brief for an artifact, or `undefined` when the type carries none.
 *
 * A content draft with no destination is not a case this function decides: the released validator
 * refuses that write, and the brief simply omits the destination sentence rather than inventing
 * one. The refusal happens after generation, exactly as before this phase.
 */
export function preparationBriefFor(input: {
  readonly artifactType: WorkArtifactType;
  readonly intendedDestination?: ContentDestination;
}): string | undefined {
  if (input.artifactType !== CONTENT_DRAFT_TYPE) return undefined;
  const lines = [...CONTENT_DRAFT_PREPARATION_BRIEF];
  if (input.intendedDestination) {
    lines.push(contentDraftDestinationSentence(input.intendedDestination));
  }
  return lines.join(" ");
}
