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
 * It is done through an Identity-owned projection, not a read of our own: the same
 * Governance-gated, tenant-scoped, fail-closed module the two pages use. It creates no roster — it
 * answers for ids this register already names and cannot enumerate anybody. And the IDENTIFIER
 * travels beside the name in every item, because:
 *
 *     THE NAME IS NOT THE KEY.         A READABLE NAME GRANTS NOTHING.
 *     RESOLVED != AUTHORIZED.          UNRESOLVED != NOBODY.
 *
 * ── AND IT IS A NAME, NEVER AN ADDRESS (WORK-2 POST-ACCEPTANCE HARDENING) ────
 *
 * WORK-2's production acceptance is what found this. The released product label is
 * `display_name → name → email`, and the production identity has neither name column set, so the
 * "readable name" this module put in front of a model was AN EMAIL ADDRESS. Gated, tenant-scoped,
 * eligible and correct as a product label — and a disclosure to a third-party model provider on
 * every Command answer, where before it appeared only on two server-rendered pages the
 * organization's own authorized human was reading.
 *
 *     UI LEGIBILITY != MODEL PROVIDER DISCLOSURE
 *     AUTHORIZED TO READ != NECESSARY TO DISCLOSE
 *
 * So this module now consumes `resolveHumanNames`, which projects `display_name → name` and stops
 * there. The two pages keep the released label, deliberately: showing an organization's own human
 * their own address is not a disclosure, and blanking those pickers would have been a worse product
 * for no privacy gained.
 *
 * The distinction is made in Identity by SELECTING DIFFERENT COLUMNS, never by inspecting a string
 * here. This module holds no `@` test, no regex, no local-part split and no heuristic, and it could
 * not tell a name from an address if it tried — which is exactly why it must not try.
 *
 * When Identity has no name for a human — none recorded, unresolvable, unauthorized, or Identity
 * unreachable — the item says the name is unavailable and shows the identifier. It never guesses,
 * never derives a name from an address, never abbreviates and never falls back to a blank.
 *
 *     UNKNOWN REMAINS UNKNOWN.         AN ADDRESS IS NOT A NAME.
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
import {
  readWorkEvidenceReferences,
  type WorkEvidenceReferenceView,
} from "./read-work-evidence.server";
import { resolveHumanNames } from "@/features/auth-runtime/human-label-read.server";
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

/**
 * Said when Identity holds no NAME for an id this register names. Never replaced by a guess.
 *
 * It covers four different situations on purpose — no name recorded, id unresolvable, caller
 * unauthorized, Identity unreachable — because a model must not be able to tell them apart, and
 * because the honest answer is the same in all four: Hebun does not know what to call this person.
 * The identifier is shown beside it every time, so the record stays fully referenceable.
 */
export const WORK_LABEL_UNAVAILABLE = "name unavailable";

export interface WorkGroundingDeps {
  readonly readRegister?: typeof readWorkRegister;
  readonly resolveNames?: typeof resolveHumanNames;
  /** WEV-1. The DECLARED relationships, with each referent resolved by its own authority. */
  readonly readEvidence?: typeof readWorkEvidenceReferences;
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
 * Three cases, kept apart: nobody recorded, recorded and named, recorded and unnamed. The
 * identifier is present in the last two, always, because the name is a rendering and the id is the
 * fact — and it is what keeps the record referenceable when there is no name to give.
 */
function accountableClause(item: WorkItemView, names: ReadonlyMap<string, string>): string {
  if (!item.accountableActorId) {
    return "No human is recorded accountable for this work.";
  }
  const name = names.get(item.accountableActorId);
  const named = name ?? WORK_LABEL_UNAVAILABLE;
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
function concernsClause(references: readonly WorkEvidenceReferenceView[]): string {
  /*
   * WEV-1 — WHAT A HUMAN DECLARED THIS WORK CONCERNS, and each referent's standing IN ITS OWNING
   * AUTHORITY'S WORDS.
   *
   * Three separations are load-bearing in this one sentence, and Heby's prose is built from it:
   *
   *   DECLARED BY A PERSON  != INFERRED BY HEBUN   — said outright, every time
   *   THE RELATIONSHIP      != THE REFERENT        — Work owns the first and nothing of the second
   *   RESOLVED              != CURRENT/AUTHORITATIVE — the standing is quoted, never summarized
   *
   * An UNRESOLVED referent is reported as unknown rather than dropped: a declaration whose referent
   * authority could not answer is still a declaration this organization made.
   */
  if (references.length === 0) return "Nobody has declared what this work concerns.";
  const declared = references
    .map((reference) => {
      const kind = reference.kind === "knowledge-fact" ? "knowledge" : "document";
      return reference.referent
        ? `${kind} "${reference.referent.label}" (${reference.referent.standing})`
        : `${kind} whose owning authority could not be read, so its standing is unknown`;
    })
    .join("; ");
  return (
    `A person declared that this work concerns: ${declared}. ` +
    "Hebun inferred none of these relationships, and declaring one says nothing about whether " +
    "what it names is current, ratified or authoritative — that is its own authority's answer."
  );
}

function workItem(
  item: WorkItemView,
  names: ReadonlyMap<string, string>,
  references: readonly WorkEvidenceReferenceView[],
): ResolvedSourceItem {
  const meaning = WORK_DECLARED_STATE_MEANING[item.declaredState as WorkDeclaredState];
  return {
    recordRef: `work-item/${item.workItemId}`,
    label: item.title,
    detail:
      `declared state: ${item.declaredState} — ${meaning} ` +
      `${departmentClause(item)} ${accountableClause(item, names)} ` +
      `The work is ${item.inService ? "in service" : "retired from service"}; recorded ` +
      `${item.recordedAt}, last changed ${item.updatedAt}. ` +
      `${concernsClause(references)} ` +
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
  const resolveNames = deps.resolveNames ?? resolveHumanNames;

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
   * ONE name read, for the ids this register already names.
   *
   * Scoped to those exact ids — it can neither list the organization's members nor reach another
   * tenant's. A failed, unauthorized or nameless read leaves the id ABSENT from the map, and every
   * such item then renders the identifier with `name unavailable` rather than a guess. Legibility
   * failing must never make the work itself unavailable, so this is deliberately not escalated.
   *
   * `resolveHumanNames`, NOT `resolveHumanLabels`: the address fallback is a product label and must
   * not leave this process. See the header.
   */
  const accountableIds = register.items
    .map((item) => item.accountableActorId)
    .filter((id): id is string => Boolean(id));
  let names: ReadonlyMap<string, string> = new Map();
  try {
    names = await resolveNames(tenant, accountableIds);
  } catch {
    names = new Map();
  }

  /*
   * WEV-1 — ONE evidence read, for this tenant's current declarations.
   *
   * Its failure is NOT escalated, for the reason legibility's is not: a work item whose
   * declarations could not be read is still a work item, and an unreadable relationship table must
   * not make the work itself unavailable. An unreadable read yields an EMPTY list, and the clause
   * then says nobody has declared anything — which is why the surface, not this source, is where
   * the read/absent distinction is rendered.
   */
  const readEvidence = deps.readEvidence ?? readWorkEvidenceReferences;
  let references: readonly WorkEvidenceReferenceView[] = [];
  try {
    const evidence = await readEvidence(tenant);
    if (evidence.status === "available") references = evidence.references;
  } catch {
    references = [];
  }

  const items = register.items.map((item) =>
    workItem(
      item,
      names,
      references.filter((reference) => reference.workItemId === item.workItemId),
    ),
  );

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
