/*
 * organizational-work/heby-work-source.server.ts — THE ORGANIZATIONAL WORK AUTHORITY'S read
 * projection of itself, shaped for Heby grounding (WORK-2).
 *
 * ── WHY IT LIVES ON THIS SIDE OF THE BOUNDARY ────────────────────────────────
 *
 * G6C settled it and E2-1, E2-5 and AMA-3 followed it: a projection belongs to the authority that
 * owns the facts, and the consumer imports the projection. So this file sits inside the work
 * authority, and Heby imports one function from it. Heby therefore never holds `workItems`, never
 * holds a database handle for work truth, and — the part that matters most — never holds
 * `recordWork`, `setWorkDeclaredState`, `setWorkAccountableHuman`, `retitleWork` or `retireWork`.
 *
 * ── READ-ONLY, AND PROVABLY ──────────────────────────────────────────────────
 *
 * No insert, no update, no delete, no transaction. It imports the READ SEAM MODULE, never the
 * writer, for the reason AMA-3 states about its own: importing the writer would put a work mutation
 * into Heby's import graph for the sake of a read.
 *
 *     HEBY GROUNDS ON WORK != HEBY HAS A WORK WRITER
 *
 * ── WHY A NEW CLASS, AND WHY NOT ONE OF THE FOUR IT LOOKS LIKE ───────────────
 *
 * The WORK-0 gate predicted this and the repository confirms it. The rule every class since
 * `work-artifacts` has used is A DIFFERENT AUTHORITY OWNER, and `SourceResolution.authoritative` is
 * ONE boolean for a whole class, so a class cannot assert one standing and cite under another.
 *
 *   `organization`    Organization Structure Authority owns WHAT PARTS EXIST. Work names a
 *                     department; it is not a department. Folding work in would make "this
 *                     organization has an Engineering department" and "this organization is doing
 *                     something" one indistinguishable claim under one provenance sentence.
 *
 *   `work-artifacts`  R3W owns prepared CONTENT with immutable revisions, and declares
 *                     `authoritative: false` because a draft is not organizational truth. A work
 *                     item is the opposite in both halves: a COMMITMENT with MUTABLE declared
 *                     state, and it IS a recorded organizational fact.
 *
 *                         WORK ITEM != WORK ARTIFACT
 *
 *   `operations`      reads Executive Overview sections the mock-surface gate withholds from a
 *                     real tenant. Filing durable rows behind that would make them invisible to
 *                     the only tenants that have any.
 *
 *   `intelligence`    has no connected reader at all.
 *
 *     NEW SOURCE CLASS != NEW AUTHORITY. WORK-2 widens a contract over an authority released at
 *     WORK-1 and creates nothing.
 *
 * ── THE SIX DISTINCTIONS THIS MODULE CARRIES AS DATA ─────────────────────────
 *
 * Not as prompt prose. Every one of them travels in a provenance sentence, a non-claim constant or
 * a per-item `detail` string, because a model forgets an instruction and cannot forget a field.
 *
 *     RECORDED WORK      != OBSERVED ACTIVITY
 *     DECLARED STATE     != VERIFIED STATE
 *     DECLARED COMPLETE  != SUCCESSFUL != OUTCOME ACHIEVED
 *     ACCOUNTABLE HUMAN  != AUTHORIZED EXECUTOR
 *     DEPARTMENT REF     != THE HUMAN BELONGS TO THAT DEPARTMENT
 *     WORK               != KNOWLEDGE
 *
 * ── A HUMAN'S READABLE NAME ENTERS HEBY'S CONTEXT HERE, FOR THE FIRST TIME ───
 *
 * Stated loudly rather than slipped in. Before WORK-2, `human-label-read.server.ts` had exactly two
 * consumers — the Organization page and the Work register page — and NO Heby grounding source
 * resolved a human label; the `organization` class carries the department owner as an IDENTIFIER
 * and says so in its provenance. This module is the first place a person's readable name reaches a
 * model's grounding context.
 *
 * It is done through the RELEASED projection, not a new read: the same Governance-gated,
 * tenant-scoped, fail-closed `resolveHumanLabels` the two pages use. It creates no roster — it
 * answers for ids this register already names and cannot enumerate anybody. And the IDENTIFIER
 * travels beside the label in every item, because:
 *
 *     THE LABEL IS NOT THE KEY.        A READABLE NAME GRANTS NOTHING.
 *     RESOLVED != AUTHORIZED.          UNRESOLVED != NOBODY.
 *
 * When Identity cannot answer, the item says the name is unavailable and shows the identifier. It
 * never guesses, never abbreviates and never falls back to a blank.
 *
 * ── WHAT IT STRUCTURALLY CANNOT SAY ──────────────────────────────────────────
 *
 * No credential, no secret, no provider payload, no permission row, no role, no manager, no
 * reporting line, no team, no progress, no health, no priority, no due date, no outcome. Not
 * because each is filtered here, but because the released read seam carries none of them to filter.
 *
 * Server-only.
 */
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveHumanLabels } from "@/features/auth-runtime/human-label-read.server";
import { readWorkRegister, type WorkItemView } from "./read-work.server";
import { WORK_DECLARED_STATE_MEANING, WORK_NON_CLAIMS, type WorkDeclaredState } from "./work-contracts";

/**
 * Named for what it is, and for what it is not.
 *
 * A reader who sees this line must not conclude that Hebun watched any of this happen. Every state
 * named below was DECLARED by a human, and the sentence says so before it says anything else.
 */
export const WORK_GROUNDING_PROVENANCE =
  "Organizational Work Authority — this organization's recorded statement of the work it is doing, " +
  "read tenant-scoped from the session and authoritative (authoritative: true). Every work item " +
  "was recorded by an authorized human through the product, and EVERY STATE IS A DECLARATION: " +
  "Hebun did not observe the work, did not verify it, and holds no record of any outcome. " +
  "DECLARED COMPLETE IS NOT VERIFIED, NOT SUCCESSFUL, AND NOT AN OUTCOME. Naming an accountable " +
  "human is attribution and grants that person nothing — no permission, no Governance authority, " +
  "no approval right and no right to execute anything. A department reference records which part " +
  "of the organization the work belongs to; it does not say the accountable human belongs to that " +
  "department. This is not organizational Knowledge: a work item is declared, is mutable, and is " +
  "never ratified. No progress, health, priority, due date or outcome is carried, because no " +
  "authority for any of them exists.";

/**
 * The refusal carried on every work item, held as its own constant.
 *
 * IT NAMES THE CLAIMS IT FORBIDS, which is what makes it useful to a model and what makes a
 * vocabulary ban fail on it. E2-4 through E2-8 recorded that collision and AMA-2 recorded it again;
 * the settled remedy is to pin the denial BY EQUALITY and run any word ban over only what the
 * source CLAIMS. Keeping it separately named is what lets a test do both.
 */
export const WORK_NON_CLAIM =
  "This is a DECLARED state, not an observed or verified one. Hebun did not watch this work and " +
  "cannot confirm what happened; declared complete is not successful and is not an outcome. The " +
  "accountable human is attributed, not authorized to execute anything.";

/** What recorded work never means, carried with the records rather than left to a surface. */
export const WORK_GROUNDING_NON_CLAIMS: readonly string[] = WORK_NON_CLAIMS;

/**
 * The measured absence. A real answer about the organization, and never an outage.
 *
 * The sentence must survive being read alone, because that is how a sentence reaches a model.
 */
export const WORK_NONE_RECORDED_STATEMENT =
  "This organization has recorded no work. Hebun looked and found none — a measured absence in " +
  "this organization's records, never a statement that the organization is doing nothing. Work " +
  "exists in Hebun only once a human records it.";

/** Said when Identity returns no label for an id the register names. Never replaced by a guess. */
export const WORK_LABEL_UNAVAILABLE = "name unavailable";

export interface WorkGroundingDeps {
  readonly readRegister?: typeof readWorkRegister;
  readonly resolveLabels?: typeof resolveHumanLabels;
}

function base(
  state: SourceResolution["state"],
  items: readonly ResolvedSourceItem[],
  unavailableReason?: string,
): SourceResolution {
  return {
    sourceClass: "work",
    state,
    provenance: WORK_GROUNDING_PROVENANCE,
    /*
     * TRUE, on the same basis as `governance` (G6C) and `agent-mandate` (AMA-3): `work_items` IS
     * the record. Every field cited below is a stored column of a row an authorized human wrote —
     * not a figure recomputed on read. `authoritative` describes WHOSE RECORD IT IS, never whether
     * the world matches it, and the provenance above carries that second half explicitly.
     */
    authoritative: true,
    items,
    ...(unavailableReason === undefined ? {} : { unavailableReason }),
  };
}

/**
 * The accountable clause for one item.
 *
 * Three cases, kept apart: nobody recorded, recorded and resolvable, recorded and unresolvable. The
 * identifier is present in the last two, always, because the label is a rendering and the id is the
 * fact.
 */
function accountableClause(item: WorkItemView, labels: ReadonlyMap<string, string>): string {
  if (!item.accountableActorId) {
    return "No human is recorded accountable for this work.";
  }
  const label = labels.get(item.accountableActorId);
  const named = label ?? WORK_LABEL_UNAVAILABLE;
  const standing =
    item.accountableCurrentlyActiveMember === false
      ? " — recorded accountable, and no longer an active member of this organization; the record " +
        "still names them because erasing them would destroy the record that anyone ever was"
      : "";
  return (
    `accountable human: ${named} (${item.accountableActorId})${standing}. ` +
    "Accountability is attribution: it grants no permission, no Governance authority, no approval " +
    "right and no authority to execute anything."
  );
}

/** The department clause. A reference, and explicitly not a statement about the human. */
function departmentClause(item: WorkItemView): string {
  if (!item.department) {
    return "No department is recorded for this work.";
  }
  return (
    `department: ${item.department.name} (${item.department.departmentId}) — the part of the ` +
    "organization this work belongs to. It does not say the accountable human belongs to that " +
    "department, and it confers nothing."
  );
}

/**
 * One recorded work item, as a grounding item.
 *
 * The TITLE travels in `label`, which is the released `work-artifacts` convention for a
 * human-authored NAME — as distinct from a human-authored SENTENCE, which AMA-3 keeps in `content`
 * so it cannot be read as a claim Heby is making. A title is a name.
 *
 * `detail` is machine-derived and flows into Heby's own deterministic prose, so every clause in it
 * is a fact this authority stores plus the standing non-claim. Nothing in it is inferred.
 */
function workItem(item: WorkItemView, labels: ReadonlyMap<string, string>): ResolvedSourceItem {
  const meaning = WORK_DECLARED_STATE_MEANING[item.declaredState as WorkDeclaredState];
  return {
    recordRef: `work-item/${item.workItemId}`,
    label: item.title,
    detail:
      `declared state: ${item.declaredState} — ${meaning} ` +
      `${departmentClause(item)} ${accountableClause(item, labels)} ` +
      `The work is ${item.inService ? "in service" : "retired from service"}; recorded ` +
      `${item.recordedAt}, last changed ${item.updatedAt}. ` +
      WORK_NON_CLAIM,
    /*
     * `retired` is the retrieval layer's own vocabulary for a record that is no longer in service.
     * Retired work is RETURNED rather than hidden, because hiding it would make a retirement look
     * like a deletion — and WORK-1 retires in place and deletes nothing.
     */
    lifecycle: item.inService ? "settled" : "retired",
  };
}

/**
 * Read this organization's recorded work, for Heby grounding.
 *
 * Tenant-scoped through the released read seam — this module passes the server-resolved context
 * straight through and constructs no query. There is no parameter by which a caller could name
 * another tenant or another organization's work, so those are not refused here; they are
 * UNREPRESENTABLE.
 *
 * THE THREE STATES SURVIVE INTO GROUNDING UNMERGED. The register's `unavailable` becomes the
 * class's `unavailable` with its own sentence; a register that answered with nothing becomes
 * `resolved` carrying the measured-absence statement. Collapsing those two would let Heby state,
 * on a database outage, that its organization is doing nothing.
 */
export async function readWorkGroundingSource(
  tenant: TenantContext | null,
  deps: WorkGroundingDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Organizational work grounding reads are server-only.");
  }
  if (!tenant?.tenantId) {
    return base("unavailable", [], "no-authorized-tenant-context");
  }

  const readRegister = deps.readRegister ?? readWorkRegister;
  const resolveLabels = deps.resolveLabels ?? resolveHumanLabels;

  const register = await readRegister(tenant);
  if (register.status !== "available") {
    return base(
      "unavailable",
      [],
      "The Organizational Work Authority could not be reached, so what this organization has " +
        "recorded it is working on is unknown. UNAVAILABLE IS NOT NONE: nothing here says whether " +
        "any work exists.",
    );
  }

  if (register.items.length === 0) {
    /*
     * RESOLVED, NOT UNAVAILABLE. Hebun looked and this organization has recorded no work. A real,
     * measured answer, and reporting it as an outage would be the mirror of the fabricated absence
     * this class exists to avoid.
     */
    return base("resolved", [
      {
        recordRef: "work:none-recorded",
        label: "No work has been recorded",
        detail: `${WORK_NONE_RECORDED_STATEMENT} ${WORK_NON_CLAIM}`,
        lifecycle: "settled",
      },
    ]);
  }

  /*
   * ONE label read, for the ids this register already names.
   *
   * Scoped to those exact ids — it can neither list the organization's members nor reach another
   * tenant's. A failed or unauthorized read returns an empty map, and every item then renders the
   * identifier with `name unavailable` rather than a guess. Legibility failing must never make the
   * work itself unavailable, so this is deliberately not escalated.
   */
  const accountableIds = register.items
    .map((item) => item.accountableActorId)
    .filter((id): id is string => Boolean(id));
  let labels: ReadonlyMap<string, string> = new Map();
  try {
    labels = await resolveLabels(tenant, accountableIds);
  } catch {
    labels = new Map();
  }

  const items = register.items.map((item) => workItem(item, labels));

  if (register.truncated) {
    /*
     * A BOUNDED LIST THAT SAYS SO. The register caps what it returns; a model handed a silently
     * truncated list would answer "that is all the work" about a partial one.
     */
    items.push({
      recordRef: "work:bounded",
      label: "This list is bounded",
      detail:
        "The register returned its maximum and this organization holds more recorded work than is " +
        "listed here. Any count derived from this list is a count of what was listed, never of " +
        "what the organization holds.",
      lifecycle: "unknown",
    });
  }

  return base("resolved", items);
}
