/*
 * knowledge/supersede-contracts.ts — the correction contract (K3).
 *
 * A CORRECTION IS NOT AN EDIT. The operator supplies replacement content and the identity of the
 * fact being corrected; everything else — which node is currently active, what version it is, what
 * the next version number is, who is acting, which tenant — is resolved server-side. The input type
 * therefore has exactly three fields, and the version fields a caller might want to "help" with are
 * absent by construction rather than ignored at runtime.
 *
 * `observedKnowledgeVersion` IS here, and it is NOT authority. It is the version the operator was
 * actually looking at, and it can do exactly one thing: cause a REFUSAL. It never selects a row,
 * never authorizes anything, and never decides which correction wins — the transaction's own
 * compare-and-swap on the server-read `fact_version` does that. Forging it, omitting it, or sending
 * a stale one can only make the request fail; it can never make it succeed or overwrite more.
 *
 * Both are needed, because they refuse different things. The server-side compare-and-swap stops two
 * SIMULTANEOUS transactions from both claiming they superseded the same version. The observed
 * version stops the slower human case the swap cannot see: a form opened against v2, submitted after
 * someone else committed v3, would otherwise quietly bury v3 under a correction that never read it.
 *
 * Pure. No React, no I/O, no server, no authority.
 */

import {
  KNOWLEDGE_LIMITS,
  normalizeSingleLine,
  normalizeStatement,
  type KnowledgeValidationProblem,
} from "./create-contracts";

/** Everything a human supplies to correct an existing fact. */
export interface SupersedeKnowledgeInput {
  /** The `knowledge_facts` row being corrected. An opaque handle — it grants nothing. */
  readonly factId: string;
  /** The corrected title. */
  readonly title: string;
  /** The corrected statement. */
  readonly statement: string;
  /**
   * The `knowledge_version` the operator was shown. A PRECONDITION, not authority: if it no longer
   * matches the active version, the correction is refused so the operator can re-read what changed.
   */
  readonly observedKnowledgeVersion: number;
}

export type SupersedeField = "factId" | "title" | "statement" | "observedKnowledgeVersion";

export interface NormalizedSupersedeInput {
  readonly factId: string;
  readonly title: string;
  readonly statement: string;
  readonly observedKnowledgeVersion: number;
}

export type SupersedeValidation =
  | { readonly ok: true; readonly value: NormalizedSupersedeInput }
  | { readonly ok: false; readonly problems: readonly KnowledgeValidationProblem[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** All C0 controls and DEL except newline and tab. */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const CONTROL_CHARACTERS_SINGLE_LINE = /[\u0000-\u001F\u007F]/;

function length(value: string): number {
  return Array.from(value).length;
}

/**
 * Validate a correction. Same discipline as creation: content is normalized, never rewritten in
 * meaning, and a statement that reads like a command is legitimate Knowledge stored verbatim.
 */
export function validateSupersedeKnowledge(input: unknown): SupersedeValidation {
  const problems: KnowledgeValidationProblem[] = [];
  const raw = (input ?? {}) as Partial<Record<SupersedeField, unknown>>;

  const factId = typeof raw.factId === "string" ? raw.factId.trim() : "";
  if (factId.length === 0) {
    problems.push({ field: "factKey", code: "required", message: "The Knowledge record to correct is required." });
  } else if (!UUID_RE.test(factId)) {
    // Not a lookup key: this addresses a row, so it must actually look like one.
    problems.push({ field: "factKey", code: "required", message: "That Knowledge record reference is not valid." });
  }

  const title = typeof raw.title === "string" ? normalizeSingleLine(raw.title) : "";
  if (title.length === 0) {
    problems.push({ field: "title", code: "required", message: "Title is required." });
  } else if (CONTROL_CHARACTERS_SINGLE_LINE.test(title)) {
    problems.push({ field: "title", code: "control-characters", message: "Title contains control characters and was not saved." });
  } else if (length(title) > KNOWLEDGE_LIMITS.title) {
    problems.push({ field: "title", code: "too-long", message: `Title must be ${KNOWLEDGE_LIMITS.title} characters or fewer.` });
  }

  const statement = typeof raw.statement === "string" ? normalizeStatement(raw.statement) : "";
  if (statement.length === 0) {
    problems.push({ field: "statement", code: "required", message: "Statement is required." });
  } else if (CONTROL_CHARACTERS.test(statement)) {
    problems.push({
      field: "statement",
      code: "control-characters",
      message: "Statement contains control characters and was not saved. Line breaks and tabs are allowed.",
    });
  } else if (length(statement) > KNOWLEDGE_LIMITS.statement) {
    problems.push({ field: "statement", code: "too-long", message: `Statement must be ${KNOWLEDGE_LIMITS.statement} characters or fewer.` });
  }

  // Fail closed: a missing or nonsensical observed version is refused, never assumed to be current.
  const observedRaw = (raw as { observedKnowledgeVersion?: unknown }).observedKnowledgeVersion;
  const observed = typeof observedRaw === "number" ? observedRaw : Number.NaN;
  if (!Number.isInteger(observed) || observed < 1) {
    problems.push({
      field: "factKey",
      code: "required",
      message: "The version you were viewing could not be determined. Reload and try the correction again.",
    });
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value: { factId, title, statement, observedKnowledgeVersion: observed } };
}

/**
 * One version in a fact's chain, as a reader sees it. Real fields only — there is no change
 * summary, no diff quality, no confidence, because no authority in Hebun owns any of them.
 */
export interface KnowledgeVersionView {
  readonly knowledgeVersion: number;
  readonly title: string;
  readonly statement: string | null;
  readonly active: boolean;
  readonly lifecycleStatus: string | null;
  readonly authorityClass: string | null;
  readonly ratified: boolean;
  readonly createdAt: string;
  /** The acting principal id, when the record carries one. Never a name or session material. */
  readonly createdBy: string | null;
  /** Whether this version replaced an earlier one. */
  readonly supersedesEarlier: boolean;
}

/** Why a version chain could not be fully reconstructed. Reported, never silently repaired. */
export type KnowledgeVersionChainIntegrity =
  /** The chain terminated at an original version, as expected. */
  | "complete"
  /** A supersedes link pointed at a node that is missing or not this tenant's. Chain truncated. */
  | "broken-link"
  /** A cycle was detected. Walking stopped; nothing was repaired. */
  | "cycle-detected"
  /** The chain hit the safety bound before reaching an original. */
  | "truncated";

export type KnowledgeVersionHistory =
  | {
      readonly status: "read";
      /** Newest first. The active version is first when the chain is coherent. */
      readonly versions: readonly KnowledgeVersionView[];
      readonly integrity: KnowledgeVersionChainIntegrity;
    }
  | {
      readonly status: "unavailable";
      readonly reason: "no-authorized-tenant-context" | "persistence-not-configured" | "not-found" | "read-failed";
      readonly detail?: string;
    };
