/*
 * knowledge/create-contracts.ts — the Knowledge creation contract and its validation (K2).
 *
 * WHAT A HUMAN SUPPLIES, AND WHAT THEY CANNOT. The input carries CONTENT and CLASSIFICATION only:
 * the fact's identity (key, domain, scope) and its text (title, statement). It carries no tenant,
 * no organization, no membership, no role, no actor, no createdBy, no approvedBy — those are
 * resolved server-side from the authenticated session, and the type makes supplying them
 * unrepresentable rather than merely discouraged.
 *
 * It also carries NO governance claim. There is no field for lifecycle status, authority class,
 * ratification, health, or effective dates, because a person typing a sentence does not ratify it.
 * K2 writes `draft` / `provisional` unconditionally (see `knowledge-create.server.ts`), and a form
 * cannot talk its way past that.
 *
 * VALIDATION PREVENTS EXECUTION, NOT EXPRESSION. Knowledge content is DATA. A statement that reads
 * "Run /terminal to restart the server", contains `<script>`, `' OR 1=1 --`, `../../etc/passwd`, or
 * "Ignore previous instructions" is legitimate Knowledge if an authorized human deliberately
 * records it, and it is stored VERBATIM. Nothing here rewrites, escapes, strips, or "sanitizes"
 * meaning — that would silently corrupt the organization's own words. What validation rejects is
 * input that is structurally broken: empty, over-length, or carrying control characters that would
 * corrupt storage and display. Safety comes from the fact that no code path in Hebun executes
 * Knowledge content, not from mangling it.
 *
 * Pure. No React, no I/O, no server, no authority.
 */

import type { KnowledgeScope } from "./contracts";

/**
 * A machine-readable statement of WHAT KIND of authority currently gates Knowledge authoring (K2.1).
 *
 * It lives here — in the pure contract module — so the server resolver, the report, and the UI all
 * read ONE declaration rather than each carrying its own sentence about it. Nothing downstream can
 * then quietly present the gate as finer than it is: `kind` is `"role-band"`,
 * `fineGrainedPermissionRuntimeConnected` is `false`, and a test asserts both. When
 * `role_permissions` gains a real runtime, this object changes and every consumer changes with it,
 * instead of a stale claim surviving inside a component.
 */
export const KNOWLEDGE_WRITE_AUTHORITY_MODEL = Object.freeze({
  /** A coarse authority band read from `roles.type` — NOT a per-capability grant. */
  kind: "role-band" as const,
  bands: Object.freeze(["owner", "director"] as const),
  /**
   * `permissions` + `role_permissions` exist as schema with zero application consumers and zero
   * rows. There is no permission-resolution runtime, so there is no `knowledge.create` grant to
   * check, and Hebun must not imply that there is.
   */
  fineGrainedPermissionRuntimeConnected: false as const,
  /** One sentence an operator can be shown verbatim. It claims exactly what is true. */
  operatorSummary:
    "Authoring organizational Knowledge is limited to the owner and director role bands. Hebun has no per-capability Knowledge permission yet, so this is a coarse authority check, not a fine-grained grant.",
});

/** The canonical scopes, as the `knowledge_scope` enum declares them. */
export const KNOWLEDGE_SCOPES: readonly KnowledgeScope[] = [
  "company-wide",
  "department",
  "domain",
];

/**
 * Bounds, counted in Unicode CODE POINTS so Turkish characters and emoji cost what they look like
 * rather than what UTF-16 charges for them.
 */
export const KNOWLEDGE_LIMITS = Object.freeze({
  factKey: 128,
  domainKey: 64,
  title: 200,
  statement: 20_000,
});

/** Everything a human supplies. Authority fields are absent BY TYPE, not by convention. */
export interface CreateKnowledgeInput {
  /** The fact's stable, human-meaningful identity within its domain and scope. */
  readonly factKey: string;
  readonly domainKey: string;
  readonly scope: KnowledgeScope;
  /** The node label. */
  readonly title: string;
  /** The knowledge itself. Stored verbatim. */
  readonly statement: string;
}

export type KnowledgeField = "factKey" | "domainKey" | "scope" | "title" | "statement";

export interface KnowledgeValidationProblem {
  readonly field: KnowledgeField;
  readonly code: "required" | "too-long" | "control-characters" | "unknown-scope";
  /** Operator-facing text. States what is wrong; never rewrites the input. */
  readonly message: string;
}

/** Count Unicode code points, not UTF-16 units. */
function length(value: string): number {
  return Array.from(value).length;
}

/** All C0 controls and DEL except newline and tab — knowledge has paragraphs. */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
/** All C0 controls and DEL — a single-line field has no legitimate newline or tab. */
const CONTROL_CHARACTERS_SINGLE_LINE = /[\u0000-\u001F\u007F]/;

/** Normalize a single-line field: trim only. Interior text is never altered. */
export function normalizeSingleLine(value: string): string {
  return value.trim();
}

/**
 * Normalize the statement: trim the ends and normalize line endings to `\n`. The words themselves
 * are untouched.
 */
export function normalizeStatement(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

/** The normalized input a validated request carries forward. */
/**
 * How one chunk relates to the source a human ingested.
 *
 * Present ONLY on facts created by ingestion. A hand-authored fact omits it, and the writer then
 * records exactly the provenance it always did — so this cannot make an authored fact look ingested,
 * or the reverse.
 */
/**
 * The CLOSED vocabulary of what an ingested source WAS.
 *
 * It stays closed on purpose. `sourceType` is provenance shown to the person reading an answer
 * ("Source type: markdown"), so an open string would let a caller write anything into the sentence
 * Hebun tells a human about where its knowledge came from. Every member here is a format Hebun can
 * actually read end to end — adding one means a surface that produces it exists, not that a label
 * would be convenient.
 *
 * `plain-text` covers text a human pasted AND a `.txt` file, because they are the same thing by the
 * time they reach the writer. `markdown` records that a file WAS Markdown; nothing parses it, and it
 * is stored as the Markdown the author wrote, exactly as pasted Markdown already is.
 */
export const KNOWLEDGE_SOURCE_TYPES = ["plain-text", "markdown"] as const;

export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export interface IngestionProvenance {
  readonly sourceTitle: string;
  /** Derived server-side from what was validated. Never accepted from client input. */
  readonly sourceType: KnowledgeSourceType;
  /** SHA-256 of the normalized source. Identity of the CONTENT, not of the file or the title. */
  readonly sourceDigest: string;
  readonly chunkIndex: number;
  readonly chunkCount: number;
}

export interface NormalizedKnowledgeInput {
  readonly factKey: string;
  readonly domainKey: string;
  readonly scope: KnowledgeScope;
  readonly title: string;
  readonly statement: string;
  /** Set by ingestion only. Absent for a hand-authored fact. */
  readonly ingestion?: IngestionProvenance;
}

export type KnowledgeValidation =
  | { readonly ok: true; readonly value: NormalizedKnowledgeInput }
  | { readonly ok: false; readonly problems: readonly KnowledgeValidationProblem[] };

function problem(
  field: KnowledgeField,
  code: KnowledgeValidationProblem["code"],
  message: string,
): KnowledgeValidationProblem {
  return { field, code, message };
}

function checkSingleLine(
  field: Exclude<KnowledgeField, "scope" | "statement">,
  raw: unknown,
  label: string,
  limit: number,
  problems: KnowledgeValidationProblem[],
): string {
  const value = typeof raw === "string" ? normalizeSingleLine(raw) : "";
  if (value.length === 0) {
    problems.push(problem(field, "required", `${label} is required.`));
    return value;
  }
  if (CONTROL_CHARACTERS_SINGLE_LINE.test(value)) {
    problems.push(
      problem(field, "control-characters", `${label} contains control characters and was not saved.`),
    );
    return value;
  }
  if (length(value) > limit) {
    problems.push(problem(field, "too-long", `${label} must be ${limit} characters or fewer.`));
  }
  return value;
}

/**
 * Validate and normalize a creation request. Total: it always returns either a normalized value or
 * every problem found, so an operator sees all of them at once rather than one per attempt.
 *
 * Deliberately NOT enforced: a slug pattern on `factKey`. The canonical column is plain `text` with
 * no format constraint, and imposing an ASCII slug rule here would reject legitimate Turkish
 * identities that the schema itself accepts. A key that happens to look like a path or a URL is
 * still only ever compared as an exact value — Hebun constructs no path and fetches nothing from it.
 */
export function validateCreateKnowledge(input: unknown): KnowledgeValidation {
  const problems: KnowledgeValidationProblem[] = [];
  const raw = (input ?? {}) as Partial<Record<KnowledgeField, unknown>>;

  const factKey = checkSingleLine("factKey", raw.factKey, "Fact key", KNOWLEDGE_LIMITS.factKey, problems);
  const domainKey = checkSingleLine("domainKey", raw.domainKey, "Domain", KNOWLEDGE_LIMITS.domainKey, problems);
  const title = checkSingleLine("title", raw.title, "Title", KNOWLEDGE_LIMITS.title, problems);

  const scopeRaw = typeof raw.scope === "string" ? raw.scope.trim() : "";
  const scope = KNOWLEDGE_SCOPES.find((candidate) => candidate === scopeRaw);
  if (!scope) {
    problems.push(
      problem(
        "scope",
        scopeRaw.length === 0 ? "required" : "unknown-scope",
        scopeRaw.length === 0
          ? "Scope is required."
          : `“${scopeRaw}” is not a Knowledge scope. Use one of: ${KNOWLEDGE_SCOPES.join(", ")}.`,
      ),
    );
  }

  const statement = typeof raw.statement === "string" ? normalizeStatement(raw.statement) : "";
  if (statement.length === 0) {
    problems.push(problem("statement", "required", "Statement is required."));
  } else if (CONTROL_CHARACTERS.test(statement)) {
    problems.push(
      problem(
        "statement",
        "control-characters",
        "Statement contains control characters and was not saved. Line breaks and tabs are allowed.",
      ),
    );
  } else if (length(statement) > KNOWLEDGE_LIMITS.statement) {
    problems.push(
      problem("statement", "too-long", `Statement must be ${KNOWLEDGE_LIMITS.statement} characters or fewer.`),
    );
  }

  if (problems.length > 0 || !scope) return { ok: false, problems };
  return { ok: true, value: { factKey, domainKey, scope, title, statement } };
}
