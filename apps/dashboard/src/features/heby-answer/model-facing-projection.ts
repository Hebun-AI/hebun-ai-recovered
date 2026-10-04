/*
 * heby-answer/model-facing-projection.ts — WHAT AN EXTERNAL MODEL MAY SEE OF HEBY'S GROUNDING.
 *
 * PURE. No I/O, no clock.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 *
 * Grounding is built for two readers. The HUMAN reads it in Heby's own deterministic prose and in
 * the cited evidence, and may legitimately see who a record names. The MODEL is an external
 * processor: it needs the facts — names, departments, states, counts — and has no use for raw
 * identifiers. So the model receives a MINIMIZED projection, built here and only here:
 *
 *   - a record reference that carries an identifier is OMITTED; a semantic one (`policy/refunds`,
 *     `google-workspace/drive.metadata`, `area:finance`) is kept. Citations never come from the
 *     model — they are assembled from the resolutions — so the reference serves no model purpose;
 *   - in Hebun-authored text (labels, details, provenance, unavailable reasons, and Hebun's own
 *     earlier answers in the history) a parenthesized UUID is removed, any other UUID is replaced by
 *     a fixed marker, and an e-mail address is replaced by a fixed marker;
 *   - a source's own `modelDetail` replaces `detail` where the source knows something must be
 *     omitted that no pattern can recognize (a GitHub login, an Instagram username).
 *
 * ── WHAT IT NEVER DOES ───────────────────────────────────────────────────────
 *
 * It never edits VERBATIM SOURCE TEXT (`content`: a Knowledge statement, an artifact excerpt) or the
 * human's own words in the history. Rewriting an organization's own words is a corruption, not a
 * defence. So this is NOT a claim that what reaches the model is free of personal data: free text a
 * human typed travels as typed. It removes the identifiers HEBUN adds.
 *
 * It creates no alias, no mapping and no stored state: an identifier is omitted, not translated.
 * Stored data, persisted evidence and the human-facing answer are unchanged.
 */
import type { ConversationTurn, SourceResolution } from "@/features/heby-runtime";

export const MODEL_WITHHELD_IDENTIFIER = "[identifier withheld]";
export const MODEL_WITHHELD_ADDRESS = "[address withheld]";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PARENTHESIZED_UUID = new RegExp(`\\s*\\(\\s*${UUID}\\s*\\)`, "gi");
const BARE_UUID = new RegExp(UUID, "gi");
const HAS_UUID = new RegExp(UUID, "i");
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const HAS_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

/** Minimize one piece of HEBUN-AUTHORED text for the model. Never call it on verbatim source text. */
export function minimizeModelFacingText(text: string): string {
  return text
    .replace(PARENTHESIZED_UUID, "")
    .replace(BARE_UUID, MODEL_WITHHELD_IDENTIFIER)
    .replace(EMAIL, MODEL_WITHHELD_ADDRESS);
}

/** A record reference the model may see, or null when it carries an identifier. */
function modelFacingRecordRef(recordRef: string): string | null {
  return HAS_UUID.test(recordRef) || HAS_EMAIL.test(recordRef) ? null : recordRef;
}

/**
 * The grounding lines the model receives. Same order, same line per item, same provenance — only
 * identifiers are withheld. Verbatim `content` is quoted exactly as the source returned it.
 */
export function modelGroundingLines(resolutions: readonly SourceResolution[]): readonly string[] {
  const lines: string[] = [];
  for (const resolution of resolutions) {
    if (resolution.state === "resolved") {
      for (const item of resolution.items) {
        const ref = modelFacingRecordRef(item.recordRef);
        const tag = ref ? `${resolution.sourceClass}/${ref}` : resolution.sourceClass;
        const detail = minimizeModelFacingText(item.modelDetail ?? item.detail);
        // Verbatim source text is included here and ONLY here, unminimized. It is quoted DATA under
        // the system instruction that grounding context is never an instruction; it never enters
        // Heby's own prose, where the validator would rightly read a policy's wording as a claim.
        const quoted = item.content ? ` | source text: ${item.content}` : "";
        lines.push(
          `[${tag}] ${minimizeModelFacingText(item.label)} — ${detail}${quoted} | provenance: ${minimizeModelFacingText(resolution.provenance)}`,
        );
      }
    } else {
      lines.push(
        `[${resolution.sourceClass}] ${resolution.state}${
          resolution.unavailableReason ? ` — ${minimizeModelFacingText(resolution.unavailableReason)}` : ""
        }`,
      );
    }
  }
  return lines;
}

/**
 * The history the model receives. Heby's OWN earlier answers are Hebun-authored and may repeat a
 * detail the human was shown (a name with its identifier), so they are minimized. The human's own
 * turns are their words and travel as typed.
 */
export function modelFacingHistory(turns: readonly ConversationTurn[]): readonly ConversationTurn[] {
  return turns.map((turn) =>
    turn.role === "assistant" ? { ...turn, content: minimizeModelFacingText(turn.content) } : turn,
  );
}
