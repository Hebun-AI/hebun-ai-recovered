/*
 * work-artifacts/validation.ts — structural validation for artifact input (pure, R3W).
 *
 * VALIDATION PREVENTS CORRUPTION, NOT EXPRESSION. This is the same doctrine K2 applies to
 * Knowledge statements, and it applies here for the same reason. Artifact content is DATA. A draft
 * that reads "Run /terminal to restart the server", contains `<script>`, `' OR 1=1 --`,
 * `../../etc/passwd`, or "Ignore previous instructions" is legitimate prepared work if somebody
 * deliberately wrote it, and it is stored VERBATIM. Nothing here rewrites, escapes, strips, or
 * "sanitizes" meaning — that would silently corrupt the words somebody meant to keep, and it would
 * also manufacture a false sense of safety.
 *
 * What is rejected is input that is structurally broken: empty, over-length, or carrying control
 * characters that would corrupt storage and display. Safety comes from the fact that no code path
 * in Hebun executes artifact content, not from mangling it.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */
import {
  CONTENT_DRAFT_TYPE,
  WORK_ARTIFACT_LIMITS,
  isContentDestination,
  isWorkArtifactType,
  type WorkArtifactValidationProblem,
} from "./contracts";

/*
 * The same rule K2 enforces for Knowledge, expressed as code points rather than as a regex
 * literal. The semantics are identical — C0 controls plus DEL — and the form is deliberate: a
 * character class written with unicode escapes is one careless editor away from carrying the raw
 * control byte instead of the escape, which is invisible in review and impossible to diff.
 *
 * Multi-line content KEEPS tab (09), newline (0A) and carriage return (0D): prepared work is
 * multi-line by nature — a script, an email body, a plan — and banning newlines would make the
 * whole feature useless. A single-line title has no legitimate newline or tab, so it bans them too.
 */
const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const UNIT_SEPARATOR = 0x1f;
const DELETE = 0x7f;

function hasControlCharacters(value: string, allowLineBreaks: boolean): boolean {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code === undefined) continue;
    if (allowLineBreaks && (code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN)) {
      continue;
    }
    if (code <= UNIT_SEPARATOR || code === DELETE) return true;
  }
  return false;
}

/** Code points, not UTF-16 units — Turkish characters and emoji cost what they look like. */
function codePointLength(value: string): number {
  return [...value].length;
}

function checkText(
  field: "title" | "content",
  value: unknown,
  limit: number,
  problems: WorkArtifactValidationProblem[],
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    problems.push({ field, code: "required", message: `A ${field} is required.` });
    return;
  }
  if (hasControlCharacters(value, field === "content")) {
    problems.push({
      field,
      code: "control-characters",
      message: `The ${field} contains control characters and was not saved.`,
    });
    return;
  }
  if (codePointLength(value) > limit) {
    problems.push({
      field,
      code: "too-long",
      message: `The ${field} is longer than ${limit} characters.`,
    });
  }
}

/**
 * Validate the content-and-classification a caller supplies. It never sees a tenant, an actor, a
 * lifecycle or an authority claim, because the input type makes those unrepresentable.
 */
export function validateWorkArtifactInput(input: {
  readonly artifactType?: unknown;
  readonly title?: unknown;
  readonly content?: unknown;
  readonly intendedDestination?: unknown;
}): readonly WorkArtifactValidationProblem[] {
  const problems: WorkArtifactValidationProblem[] = [];

  if (!isWorkArtifactType(input.artifactType)) {
    problems.push({
      field: "artifactType",
      code: "unknown-type",
      message: "That is not a registered work-artifact type.",
    });
  }
  checkText("title", input.title, WORK_ARTIFACT_LIMITS.title, problems);
  checkText("content", input.content, WORK_ARTIFACT_LIMITS.content, problems);
  checkIntendedDestination(input.artifactType, input.intendedDestination, problems);

  return problems;
}

/**
 * CGO-1 — the destination rule, in BOTH directions, mirroring the two database CHECKs.
 *
 * A content draft without a destination is incomplete: the whole point of the type is that the
 * prose was written FOR somewhere. A non-content artifact WITH a destination is a false claim: an
 * operational plan is not prepared for Instagram, and letting the field ride along would put a
 * destination on a row no surface would ever show one on.
 *
 * The refusal is structural, never a judgement about the destination itself — this domain does not
 * rank destinations, and it cannot reach any of them.
 */
function checkIntendedDestination(
  artifactType: unknown,
  intendedDestination: unknown,
  problems: WorkArtifactValidationProblem[],
): void {
  if (artifactType === CONTENT_DRAFT_TYPE) {
    if (!isContentDestination(intendedDestination)) {
      problems.push({
        field: "intendedDestination",
        code: "required",
        message: "A content draft must declare the destination it was prepared for.",
      });
    }
    return;
  }

  /*
   * Anything other than a content draft. `undefined` and `null` are both "not supplied" — a caller
   * that omits the field and one that passes an explicit empty are making the same statement.
   */
  if (intendedDestination === undefined || intendedDestination === null) return;

  problems.push({
    field: "intendedDestination",
    code: "destination-not-permitted",
    message: "Only a content draft carries a prepared destination.",
  });
}

/** Validate only the content of a new revision. The type and title are already fixed. */
export function validateRevisionContent(
  content: unknown,
): readonly WorkArtifactValidationProblem[] {
  const problems: WorkArtifactValidationProblem[] = [];
  checkText("content", content, WORK_ARTIFACT_LIMITS.content, problems);
  return problems;
}
