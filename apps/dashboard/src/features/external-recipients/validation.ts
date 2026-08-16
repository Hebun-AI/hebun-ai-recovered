/*
 * external-recipients/validation.ts — structural validation for recipient input (pure, R3R).
 *
 * VALIDATION PREVENTS CORRUPTION, NOT EXPRESSION. Same doctrine K2 applies to Knowledge statements
 * and R3W applies to artifact content, and it applies here for the same reason: a display name is
 * DATA. A recipient called `<script>alert(1)</script>`, `' OR 1=1 --` or "Ignore previous
 * instructions" is a legitimate — if odd — thing for somebody to type, and it is stored VERBATIM.
 * Nothing here rewrites, escapes or strips meaning. Safety comes from no code path executing a
 * display name, not from mangling it.
 *
 * THE ADDRESS IS THE EXCEPTION, AND ONLY IN SHAPE. `endpoint_value` is refused when it is not a
 * syntactically usable address, because unlike a name it is not free text — it is a machine
 * destination, and a value nothing could ever deliver to is corruption rather than expression.
 * That check is a shape gate, not a claim the address is real.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */
import {
  RECIPIENT_LIMITS,
  isRecipientEndpointKind,
  type CreateRecipientInput,
  type RecipientValidationProblem,
} from "./contracts";
import { normalizeRecipientEmail } from "./normalization";

/*
 * C0 controls plus DEL, expressed as code points rather than as a regex literal — the same form
 * R3W uses, and for the same reason: a character class written with unicode escapes is one
 * careless editor away from carrying the raw control byte instead of the escape, which is
 * invisible in review and impossible to diff.
 *
 * A display name is SINGLE LINE, so unlike artifact content it bans tab, newline and carriage
 * return too: a recipient name with an embedded newline would break every surface that renders it
 * on one row, and no legitimate name needs one.
 */
const UNIT_SEPARATOR = 0x1f;
const DELETE = 0x7f;

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code === undefined) continue;
    if (code <= UNIT_SEPARATOR || code === DELETE) return true;
  }
  return false;
}

/** Code points, not UTF-16 units — Turkish characters and emoji cost what they look like. */
function codePointLength(value: string): number {
  return [...value].length;
}

/**
 * Validate one create input.
 *
 * Returns EVERY problem rather than the first, so a surface can show a person all of what is wrong
 * at once instead of making them discover it one round trip at a time.
 */
export function validateCreateRecipientInput(
  input: unknown,
): readonly RecipientValidationProblem[] {
  const problems: RecipientValidationProblem[] = [];
  const candidate = (input ?? {}) as Partial<CreateRecipientInput>;

  const displayName = candidate.displayName;
  if (typeof displayName !== "string" || displayName.trim().length === 0) {
    problems.push({ field: "displayName", problem: "empty" });
  } else if (codePointLength(displayName) > RECIPIENT_LIMITS.displayNameMaxLength) {
    problems.push({ field: "displayName", problem: "too-long" });
  } else if (hasControlCharacters(displayName)) {
    problems.push({ field: "displayName", problem: "control-characters" });
  }

  if (!isRecipientEndpointKind(candidate.endpointKind)) {
    problems.push({ field: "endpointKind", problem: "unknown" });
  } else if (normalizeRecipientEmail(candidate.endpointValue) === null) {
    /*
     * Only reachable once the kind is known, because "is this a valid value" has no answer until
     * the channel says which validator applies. A second channel adds a branch here, not a rewrite.
     */
    problems.push({ field: "endpointValue", problem: "invalid" });
  }

  return problems;
}
