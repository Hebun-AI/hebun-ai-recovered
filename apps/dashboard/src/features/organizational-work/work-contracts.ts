/*
 * organizational-work/work-contracts.ts — the vocabulary, bounds, refusals and boundary model of
 * the Organizational Work Authority (WORK-1).
 *
 * PURE. It holds no database handle, opens no connection, runs no query and exports no function
 * that touches one. It is deliberately NOT a `.server.ts` module so the read seam, the writer, the
 * audit sibling, the surface and the tests can all name one vocabulary without any of them
 * importing a writer.
 *
 * ── THE AUTHORITY, IN ONE SENTENCE ───────────────────────────────────────────
 *
 * "This organization has declared that this piece of work exists, under this title, belonging to
 *  this part of itself, with this human accountable for it, in the state this human declared."
 *
 * ── WHY THERE IS NO GOVERNANCE DECISION ──────────────────────────────────────
 *
 * Recording that work exists MOVES NO AUTHORITY. It grants no permission, reaches nothing outside
 * Hebun, touches no provider, and is reversible by the same authority that performed it. The
 * released precedents are OSA-1 and R6D — Knowledge source retraction — which both write an audit
 * row and NO `decision_records` row for exactly this reason.
 *
 * The permit chain (`heby_action_requests` -> `action_permits` -> `action_execution_attempts`)
 * exists for consequential IRREVERSIBLE acts in the world; its whole point is that a sent email
 * cannot be recalled. Manufacturing a decision record for an administrative state change would make
 * Governance a workflow step instead of an authority, and would put rows in `decision_records` that
 * decide nothing.
 *
 * So: NO Governance decision, NO permit, NO action request, NO execution attempt, NO new
 * `governance_domain` value, NO new `GOVERNANCE_SUBJECT_TYPES` entry, NO schema change to
 * Governance. The administrative gate is the tenant's EXISTING Governance authority holder,
 * consumed as a permission to write work and never as a decision.
 */

/** The `audit_log.entity_type` every WORK-1 event carries. Its own type, borrowed from nothing. */
export const WORK_ITEM_ENTITY_TYPE = "work_item" as const;

/** The `audit_log.action` vocabulary. Closed: an act with no verb here cannot be recorded. */
export const WORK_AUDIT_RECORDED = "work.recorded" as const;
export const WORK_AUDIT_RETITLED = "work.retitled" as const;
export const WORK_AUDIT_STATE_DECLARED = "work.state-declared" as const;
export const WORK_AUDIT_ACCOUNTABLE_SET = "work.accountable-set" as const;
export const WORK_AUDIT_RETIRED = "work.retired" as const;
/**
 * WEV-1 — a human declared what a work item concerns, and a human withdrew that declaration.
 *
 * TWO verbs, not one with a flag: declaring and withdrawing are different acts by possibly
 * different people at different times, and a ledger that could not tell them apart would be unable
 * to answer "who said this work was about that, and who stopped saying it".
 */
export const WORK_AUDIT_REFERENCE_DECLARED = "work.reference-declared" as const;
export const WORK_AUDIT_REFERENCE_WITHDRAWN = "work.reference-withdrawn" as const;

export type WorkAuditAction =
  | typeof WORK_AUDIT_RECORDED
  | typeof WORK_AUDIT_RETITLED
  | typeof WORK_AUDIT_STATE_DECLARED
  | typeof WORK_AUDIT_ACCOUNTABLE_SET
  | typeof WORK_AUDIT_RETIRED
  | typeof WORK_AUDIT_REFERENCE_DECLARED
  | typeof WORK_AUDIT_REFERENCE_WITHDRAWN;

export const WORK_AUDIT_ACTIONS: readonly WorkAuditAction[] = Object.freeze([
  WORK_AUDIT_RECORDED,
  WORK_AUDIT_RETITLED,
  WORK_AUDIT_STATE_DECLARED,
  WORK_AUDIT_ACCOUNTABLE_SET,
  WORK_AUDIT_RETIRED,
  WORK_AUDIT_REFERENCE_DECLARED,
  WORK_AUDIT_REFERENCE_WITHDRAWN,
]);

/* ═══════════════════════════════════════════════════════════════════════════
 * WEV-1 — WHAT A WORK ITEM MAY DECLARE IT CONCERNS
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The CLOSED referent vocabulary. Two members, each a thing this repository already owns, reads and
 * can anchor a tenant-safe foreign key to.
 *
 * IT IS NOT STORED. `work_evidence_references` holds two typed nullable columns and the kind is
 * DERIVED from which one is populated, so a stored kind can never disagree with the referent. This
 * type is the read vocabulary and the writer's input discriminator — never a column.
 *
 * `external-record` is deliberately absent: `knowledge_external_references` already owns external
 * identity per knowledge fact, so a provider record reaches work THROUGH the fact that declares it.
 * `knowledge-node` and `work-artifact-revision` are absent because both are VERSIONS, and a
 * declaration about what work concerns must not go stale when its subject is revised.
 */
export const WORK_REFERENCE_KINDS = ["knowledge-fact", "work-artifact"] as const;
export type WorkReferenceKind = (typeof WORK_REFERENCE_KINDS)[number];

export function isWorkReferenceKind(value: unknown): value is WorkReferenceKind {
  return typeof value === "string" && (WORK_REFERENCE_KINDS as readonly string[]).includes(value);
}

/**
 * What declaring a reference DOES and DOES NOT do, stated in code so a surface quotes it rather
 * than inventing it and a test can assert the claim matches the repository.
 */
export const WORK_REFERENCE_NON_CLAIMS: readonly string[] = Object.freeze([
  "Declaring a reference does not make this work the owner of what it names.",
  "It does not say the referent is current, ratified, or authoritative.",
  "It does not change the referent in any way.",
  "It was declared by a person; Hebun inferred nothing.",
]);

/**
 * What WITHDRAWAL means, and the three things it does not. `withdrawn` is the word most likely to
 * be read as "deleted" or "wrong", and it is neither.
 */
export const WORK_REFERENCE_WITHDRAWAL_MEANING: readonly string[] = Object.freeze([
  "Withdrawing means this work no longer declares that reference as current.",
  "The referent is untouched, and is neither deleted nor invalid.",
  "The declaration stays in the record, with who made it and who withdrew it.",
]);

/* ═══════════════════════════════════════════════════════════════════════════
 * DECLARED STATE
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The four states, and the one rule that governs all of them: every value is something a HUMAN
 * SAID. Hebun observed nothing, verified nothing and measured nothing.
 *
 * Mirrors `workDeclaredStateEnum` exactly. A firewall test pins the two equal, because a value the
 * database would admit and this list does not — or the reverse — is a divergence that would surface
 * first as a runtime error on a real tenant.
 */
export type WorkDeclaredState = "planned" | "active" | "blocked" | "complete";

export const WORK_DECLARED_STATES: readonly WorkDeclaredState[] = Object.freeze([
  "planned",
  "active",
  "blocked",
  "complete",
]);

/** The state a work item carries when it is first recorded and nothing else was said. */
export const DEFAULT_WORK_DECLARED_STATE: WorkDeclaredState = "planned";

export function isWorkDeclaredState(value: unknown): value is WorkDeclaredState {
  return typeof value === "string" && (WORK_DECLARED_STATES as readonly string[]).includes(value);
}

/**
 * What each state MEANS, in the words a surface must use.
 *
 * Every sentence names the declarer, because a label reading "Complete" beside a title is the one
 * place a reader is most likely to read a verified outcome into a declaration.
 */
export const WORK_DECLARED_STATE_MEANING: Readonly<Record<WorkDeclaredState, string>> =
  Object.freeze({
    planned: "Declared to exist and not yet started.",
    active: "Declared underway.",
    blocked: "Declared stopped and needing something. Hebun did not detect this — a human said it.",
    complete:
      "Declared complete by an authorized human. Hebun did not verify it, did not observe it, " +
      "and holds no record of whether it succeeded.",
  });

/**
 * The claims this authority is FORBIDDEN from making, frozen so a test can read them and a surface
 * can render them rather than paraphrase them.
 *
 * The released `WORK_ARTIFACT_NON_EFFECTS` pattern: the honest bound is a value in the code, not a
 * sentence in a comment nobody ships.
 */
export const WORK_NON_CLAIMS: readonly string[] = Object.freeze([
  "A declared state is what a human said, never what Hebun observed.",
  "Declared complete is not verified, not successful, and not an outcome Hebun can confirm.",
  "Hebun holds no record of what happened in the world after a work item was declared complete.",
  "Naming an accountable human grants that human nothing — no permission, no Governance authority, no approval right.",
  "Naming a department records a relationship; it does not make this work the department's property.",
  "Nothing here is organizational Knowledge: a work item is declared, is mutable, and is never ratified.",
  "Recording, changing or retiring work performs no external act of any kind.",
]);

/* ═══════════════════════════════════════════════════════════════════════════
 * REFUSALS
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Why a work mutation was refused. A CLOSED product vocabulary: these are what a caller reads, what
 * a test matches on, and what a bite-proof must see before it may claim a guard bit.
 */
export type WorkRefusal =
  /** No server-resolved tenant + human. There is no parameter through which a caller supplies one. */
  | "no-authorized-tenant-context"
  /** The caller does not hold this tenant's Governance authority. Fail closed. */
  | "not-authorized"
  /** The control-plane database is not reachable. Never falls back to memory. */
  | "authority-unavailable"
  /** Title absent, blank, padded, or longer than the bound. Never trimmed into validity. */
  | "malformed-work-title"
  /** A value outside the closed declared-state vocabulary. */
  | "malformed-declared-state"
  /** No live work item of this tenant carries that id. Another tenant's looks identical. */
  | "work-unresolved"
  /** The work item is already retired. Retirement is not re-appliable and not reversible here. */
  | "work-retired"
  /** No ACTIVE department of this tenant carries that id. */
  | "department-unresolved"
  /** The proposed accountable human is not a currently eligible member of this tenant. */
  | "accountable-not-eligible-member"
  /** WEV-1. The named referent is not a live referent of this tenant. Another tenant's is identical. */
  | "referent-unresolved"
  /** WEV-1. This work already declares that exact referent, and a declaration is not repeatable. */
  | "reference-already-declared"
  /** WEV-1. No current declaration of this tenant carries that id — absent, or already withdrawn. */
  | "reference-unresolved";

/* ═══════════════════════════════════════════════════════════════════════════
 * BOUNDS
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * THE LONGEST A WORK TITLE MAY BE.
 *
 * `work_items.title` is `text` with no database bound, so the bound is this constant's job — the
 * same reasoning `MAX_DEPARTMENT_NAME_LENGTH` and `MAX_AGENT_NAME_LENGTH` record. Chosen to match
 * `MAX_DEPARTMENT_NAME_LENGTH`, because a title and a department name occupy the same display slot
 * on the same kind of surface and two different bounds would be an arbitrary difference.
 */
export const MAX_WORK_TITLE_LENGTH = 120;

/**
 * The most work items one read returns.
 *
 * A bound rather than paging: WORK-1 ships a register a Director reads in one screen, not a
 * queryable backlog. When the bound is reached the read SAYS SO rather than silently truncating —
 * `truncated` on the read result — because a list that quietly stops is a list that lies about what
 * the organization holds.
 */
export const MAX_WORK_ITEMS_READ = 200;

/**
 * A title is accepted EXACTLY as given or refused. Nothing is trimmed, folded or repaired: a
 * repaired title is a different title, and this authority has no mandate to rename anybody's work
 * behind their back. The same rule `isWellFormedDepartmentName` states.
 */
export function isWellFormedWorkTitle(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_WORK_TITLE_LENGTH) return false;
  return value.trim() === value;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE BOUNDARY MODEL
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The boundary, frozen so a test can read it and a later phase must change it deliberately. Every
 * field is a MEASUREMENT of what WORK-1 actually did, not an intention.
 */
export const ORGANIZATIONAL_WORK_AUTHORITY_MODEL = Object.freeze({
  owns: Object.freeze([
    "work-identity",
    "work-title",
    "work-lifecycle",
    "work-declared-state",
    "work-accountable-assignment",
    "work-department-reference",
  ]),
  /** WORK-1 writes exactly one table. */
  writesTables: Object.freeze(["work_items"]),
  /** No Governance decision row is written by any Organizational Work path. */
  writesGovernanceDecision: false as const,
  /** No permit, no action request, no execution attempt. */
  writesActionAuthorization: false as const,
  writesExecutionAttempt: false as const,
  /** No `governance_domain` value and no `GOVERNANCE_SUBJECT_TYPES` entry was added. */
  governanceDomainAdded: false as const,
  governanceSubjectTypeAdded: false as const,
  /** The dead work island is untouched: no FK to it, no import of it, no row in it. */
  deadWorkIslandActivated: false as const,
  /** WORK-1 ships no Heby source class, no workspace change and no Live Map change. */
  hebySourceClassAdded: false as const,
  liveMapChanged: false as const,
  /** No agent may create, change, propose about, or be accountable for work. */
  agentAuthorityAdded: false as const,
  agentAccountablePossible: false as const,
  /** No outcome, no verification, no success and no measurement is recorded anywhere. */
  recordsOutcome: false as const,
  recordsVerification: false as const,
  limitation:
    "This authority records that a unit of work exists, what it is called, which department it " +
    "belongs to, which human is accountable for it, and what state that human declared. It " +
    "confers no permission, decides no authorization, verifies nothing, measures nothing, and " +
    "cannot mutate any other subsystem's state.",
});

/** The sentence a surface renders when the authority could not be reached. NOT "no work". */
export const WORK_REGISTER_UNAVAILABLE_DETAIL =
  "Hebun could not read this organization's recorded work, so it is unknown — not absent. " +
  "Nothing here says whether any work exists.";

/** The sentence when the authority answered and this organization has recorded no work. */
export const WORK_REGISTER_EMPTY_DETAIL =
  "This organization has recorded no work. Hebun looked and found none — a measured answer, not " +
  "an unread state.";
