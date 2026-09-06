/*
 * agent-origination/structured-output.ts — the boundary where model TEXT may become a typed
 * SELECTION, or nothing at all (AGENT-PROPOSAL-1).
 *
 * ── FREE-FORM TEXT NEVER BECOMES AN ACTION BY INFERENCE ──────────────────────
 *
 * This module contains no classifier, no intent detection, no keyword matching, no similarity
 * search and no extraction of "the JSON part" from a paragraph. It performs exactly one
 * transformation: it takes the WHOLE response and requires it to be a single JSON object matching
 * a closed contract. A response with prose around the object is refused — not scanned for a brace.
 *
 * The one normalization is a FENCE UNWRAP: providers routinely wrap a JSON reply in a single
 * ```json block. The unwrap is anchored to the whole string, so it either is a fenced object and
 * nothing else, or it is not. It never searches inside prose, and it can never select one of
 * several candidate objects — those are the behaviours that would make this an inference engine.
 *
 * ── REJECT, NEVER REPAIR ─────────────────────────────────────────────────────
 *
 * Missing key, extra key, wrong type, empty string, over-long reason, a reference that is
 * well-formed but was never offered — every one is a refusal. Nothing is trimmed to fit, defaulted,
 * coerced or "best effort". A malformed selection means no proposal exists, which is always a safe
 * outcome; a repaired one means a human is asked to approve something nobody chose.
 *
 * ── MEMBERSHIP IS THE CONTAINMENT ────────────────────────────────────────────
 *
 * Shape validation alone would still let a model name a plausible-looking reference it invented,
 * or one belonging to another tenant, and leave the resolvers as the only defence. Every NAMED
 * thing is therefore checked for EXACT membership in the server-built candidate set before this
 * function returns anything — both `send` references, and `record-work`'s department slug. The
 * agent can only choose from what this tenant was actually offered.
 *
 * TRH-17 admits ONE argument membership cannot bound: a record-work TITLE is prose, and no list can
 * contain prose. It is held to the RELEASED work-title predicate — the same one a human's title
 * passes — and to human review before any decision. That is stated here rather than glossed,
 * because it is the one place this module's containment story is not membership.
 *
 * PURE. No I/O, no database, no clock, no randomness, no environment — so every branch is provable
 * without a provider or a server.
 */
import { isRecipientRef } from "@/features/external-recipients/recipient-ref";
import { isWorkArtifactRef } from "@/features/work-artifacts/artifact-ref";
/* PURE. `work-contracts.ts` imports nothing at all, so the released title bound costs no I/O. */
import { isWellFormedWorkTitle } from "@/features/organizational-work/work-contracts";
import {
  MAX_ORIGINATION_REASON_LENGTH,
  NO_ACTION_KIND,
  RECORD_WORK_ORIGINATION_ALIAS,
  SEND_ORIGINATION_ALIAS,
  type OriginationCandidateSet,
  type ParseAgentSelectionResult,
  type RecordWorkSelectionScope,
  type StructuredOutputRefusal,
} from "./contracts";

/** The complete key set of the envelope, per kind. Extra or missing keys are both refusals. */
const SEND_ENVELOPE_KEYS = ["kind", "args", "reason"] as const;
const NONE_ENVELOPE_KEYS = ["kind", "reason"] as const;
const SEND_ARG_KEYS = ["recipientRef", "draftRef"] as const;

/* TRH-17. The record-work envelope is the SAME three-key shape; only its arguments differ. */
const RECORD_WORK_ENVELOPE_KEYS = SEND_ENVELOPE_KEYS;
const RECORD_WORK_ARG_KEYS = ["title", "scope"] as const;
const ORGANIZATION_LEVEL_SCOPE_KEYS = ["kind"] as const;
const DEPARTMENT_SCOPE_KEYS = ["kind", "departmentSlug"] as const;

/** The two scope discriminators, mirroring the inlet's released union exactly. */
const ORGANIZATION_LEVEL_SCOPE = "organization-level" as const;
const DEPARTMENT_SCOPE = "department" as const;

/**
 * A single fenced JSON block and NOTHING else.
 *
 * Anchored at both ends on the trimmed string. `[\s\S]` rather than a dot so a multi-line object
 * matches, and the capture is the whole body — there is no alternation that could pick one block
 * out of several, because a response containing two blocks does not match this at all.
 */
const WHOLE_STRING_FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

function refused(reason: StructuredOutputRefusal): ParseAgentSelectionResult {
  return { status: "refused", reason };
}

function keysAreExactly(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  if (actual.length !== expected.length) return false;
  return expected.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

/** A non-empty, bounded, single-line-safe reason. Bounded so a reason cannot carry a payload. */
function validReason(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_ORIGINATION_REASON_LENGTH
  );
}

/**
 * Turn one model response into a typed selection, or refuse.
 *
 * `candidates` is the server-built set this tenant was offered. It is a REQUIRED argument rather
 * than an option: a parse that could be performed without it would be a parse that could be
 * performed without the containment, and somebody would eventually call it that way.
 */
export function parseAgentActionSelection(
  responseText: unknown,
  candidates: OriginationCandidateSet,
): ParseAgentSelectionResult {
  if (typeof responseText !== "string") return refused("not-a-structured-object");

  const trimmed = responseText.trim();
  if (trimmed.length === 0) return refused("not-a-structured-object");

  const fenced = WHOLE_STRING_FENCE.exec(trimmed);
  const body = (fenced ? fenced[1]! : trimmed).trim();

  /*
   * A cheap structural pre-check before parsing. `JSON.parse` accepts bare scalars — `"7"` parses
   * to a number and `"\"hi\""` to a string — and both would then have to be rejected by a type
   * check that reads as an afterthought. Requiring an object literal up front makes the contract
   * "an object, or nothing" visible at the point it is enforced.
   */
  if (!body.startsWith("{") || !body.endsWith("}")) return refused("not-a-structured-object");

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return refused("not-a-structured-object");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return refused("not-a-structured-object");
  }
  const envelope = parsed as Record<string, unknown>;

  const kind = envelope.kind;
  if (
    kind !== SEND_ORIGINATION_ALIAS &&
    kind !== RECORD_WORK_ORIGINATION_ALIAS &&
    kind !== NO_ACTION_KIND
  ) {
    /*
     * A kind the contract does not admit is refused HERE, before any argument is looked at. The
     * admitted set is a closed literal union, so "grant-permission", "device-action" or a tool id
     * the model read somewhere cannot become an action by passing later checks.
     */
    return refused("unsupported-action-kind");
  }

  if (kind === NO_ACTION_KIND) {
    if (!keysAreExactly(envelope, NONE_ENVELOPE_KEYS)) return refused("unexpected-shape");
    if (!validReason(envelope.reason)) return refused("invalid-reason");
    return { status: "selected", selection: { kind: NO_ACTION_KIND, reason: envelope.reason } };
  }

  if (kind === RECORD_WORK_ORIGINATION_ALIAS) {
    return parseRecordWork(envelope, candidates);
  }

  if (!keysAreExactly(envelope, SEND_ENVELOPE_KEYS)) return refused("unexpected-shape");
  if (!validReason(envelope.reason)) return refused("invalid-reason");

  const args = envelope.args;
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return refused("invalid-arguments");
  }
  const argRecord = args as Record<string, unknown>;
  /* EXACTLY the declared arguments. A missing one and an extra one are both contract violations. */
  if (!keysAreExactly(argRecord, SEND_ARG_KEYS)) return refused("invalid-arguments");

  const { recipientRef, draftRef } = argRecord;
  if (!isRecipientRef(recipientRef) || !isWorkArtifactRef(draftRef)) {
    return refused("malformed-reference");
  }

  /*
   * THE CONTAINMENT. Exact string membership in what the server offered — not a prefix match, not
   * a uuid comparison, not a normalized comparison. A reference the model produced from anywhere
   * other than the candidate list fails here, whatever it looks like and whoever suggested it.
   */
  const offeredRecipient = candidates.recipients.some((c) => c.ref === recipientRef);
  const offeredDraft = candidates.drafts.some((c) => c.ref === draftRef);
  if (!offeredRecipient || !offeredDraft) return refused("reference-not-offered");

  return {
    status: "selected",
    selection: {
      kind: SEND_ORIGINATION_ALIAS,
      recipientRef,
      draftRef,
      reason: envelope.reason,
    },
  };
}

/**
 * THE RECORD-WORK ENVELOPE (TRH-17).
 *
 * Split into its own function rather than added as a fourth nested branch, because the two admitted
 * kinds validate DIFFERENT THINGS and interleaving them would make it hard to see that neither is
 * relaxed for the other. Every rule the send branch applies applies here: exact keys, no repair, a
 * bounded reason, and membership in what the server offered.
 *
 * ── THE TITLE IS THE ONE ARGUMENT NO CANDIDATE LIST CAN BOUND ────────────────
 *
 * `isWellFormedWorkTitle` is the RELEASED Work Authority predicate — the same one a human-typed
 * title passes, imported rather than restated, so a model-authored title can never be held to a
 * looser rule than a person's. It bounds length and forbids untrimmed text. It cannot make prose
 * true, and nothing here pretends otherwise: a human reads the title before any decision.
 *
 * ── THE SCOPE NAMES A SLUG, AND THE SLUG MUST HAVE BEEN OFFERED ──────────────
 *
 * The model never sees a uuid or a `department/...` reference, so it cannot name one. It names the
 * organization's own slug, and that slug is checked for EXACT membership in the offered list — the
 * same containment `send` rests on. `organization-level` names nothing, so there is nothing to
 * check for membership; what IS checked is that it was OFFERED, which is false when this tenant's
 * organization could not be read and the inlet's own branch would therefore refuse.
 */
function parseRecordWork(
  envelope: Record<string, unknown>,
  candidates: OriginationCandidateSet,
): ParseAgentSelectionResult {
  if (!keysAreExactly(envelope, RECORD_WORK_ENVELOPE_KEYS)) return refused("unexpected-shape");
  if (!validReason(envelope.reason)) return refused("invalid-reason");

  const args = envelope.args;
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return refused("invalid-arguments");
  }
  const argRecord = args as Record<string, unknown>;
  if (!keysAreExactly(argRecord, RECORD_WORK_ARG_KEYS)) return refused("invalid-arguments");

  /*
   * NOT TRIMMED INTO SHAPE. `isWellFormedWorkTitle` rejects untrimmed text outright, and repairing
   * it here would mean the title a human approves is not the title the agent chose.
   */
  const title = argRecord.title;
  if (!isWellFormedWorkTitle(title)) return refused("invalid-arguments");

  const scope = parseScope(argRecord.scope, candidates);
  if (scope.status === "refused") return scope;

  return {
    status: "selected",
    selection: {
      kind: RECORD_WORK_ORIGINATION_ALIAS,
      title,
      scope: scope.scope,
      reason: envelope.reason,
    },
  };
}

type ScopeResult =
  | { readonly status: "ok"; readonly scope: RecordWorkSelectionScope }
  | { readonly status: "refused"; readonly reason: StructuredOutputRefusal };

/**
 * One scope object, or a refusal.
 *
 * A MISSING DISCRIMINATOR IS NOT ORGANIZATION-LEVEL. TRH-16 made the inlet refuse exactly that, and
 * defaulting here would reintroduce at the model boundary the fiction that phase removed at the
 * authority boundary: the agent must SAY which organizational truth it is asserting.
 */
function parseScope(value: unknown, candidates: OriginationCandidateSet): ScopeResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { status: "refused", reason: "invalid-arguments" };
  }
  const scope = value as Record<string, unknown>;
  const kind = scope.kind;

  if (kind === ORGANIZATION_LEVEL_SCOPE) {
    if (!keysAreExactly(scope, ORGANIZATION_LEVEL_SCOPE_KEYS)) {
      return { status: "refused", reason: "invalid-arguments" };
    }
    /*
     * OFFERED, NOT MERELY VALID. When the organization could not be read, org-level work was not on
     * the table — the inlet's own branch refuses `persistence-unavailable` — so selecting it is
     * selecting something never offered, and that is the refusal it gets.
     */
    if (!candidates.work.organizationLevel) {
      return { status: "refused", reason: "reference-not-offered" };
    }
    return { status: "ok", scope: { kind: ORGANIZATION_LEVEL_SCOPE } };
  }

  if (kind === DEPARTMENT_SCOPE) {
    if (!keysAreExactly(scope, DEPARTMENT_SCOPE_KEYS)) {
      return { status: "refused", reason: "invalid-arguments" };
    }
    const departmentSlug = scope.departmentSlug;
    /* Shape first, membership second — the same order, and the same two refusals, as `send`. */
    if (typeof departmentSlug !== "string" || departmentSlug.length === 0) {
      return { status: "refused", reason: "malformed-reference" };
    }
    /* THE CONTAINMENT. Exact string membership. Not a prefix, not case-folded, not normalized. */
    const offered = candidates.work.departments.some((d) => d.slug === departmentSlug);
    if (!offered) return { status: "refused", reason: "reference-not-offered" };
    return { status: "ok", scope: { kind: DEPARTMENT_SCOPE, departmentSlug } };
  }

  /* Neither of the two organizational truths. Refused as an argument, never guessed. */
  return { status: "refused", reason: "invalid-arguments" };
}
