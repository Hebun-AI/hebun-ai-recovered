/*
 * auth-runtime/heby-people-source.server.ts — IDENTITY'S read projection of WHO IS IN THIS
 * ORGANIZATION, shaped for Heby grounding (OSA-4).
 *
 * ── WHY IT LIVES ON THIS SIDE OF THE BOUNDARY ────────────────────────────────
 *
 * G6C settled it and E2-1, E2-5, AMA-3, WORK-2 and OSA-3 followed it: a projection belongs to the
 * authority that owns the facts, and the consumer imports the projection. The facts here are
 * `users` and `memberships`, which Identity and the Membership Authority own and which this
 * directory is the only place in the repository that reads. So the projection sits here, and Heby
 * imports one function from it.
 *
 * Heby therefore never holds `memberships`, never holds `users`, never holds a database handle for
 * membership truth, and holds no writer of either.
 *
 *     HEBY GROUNDS ON PEOPLE != HEBY HAS A PEOPLE WRITER
 *
 * ── READ-ONLY, AND PROVABLY ──────────────────────────────────────────────────
 *
 * No insert, no update, no delete, no transaction. It imports the READ SEAM, never a writer.
 *
 * ── WHY A NEW CLASS, AND NOT ONE OF THE THREE IT LOOKS LIKE ──────────────────
 *
 * The rule every class since `work-artifacts` has used is A DIFFERENT AUTHORITY OWNER, and
 * `SourceResolution.authoritative` is ONE boolean for a whole class, so a class cannot assert one
 * standing and cite under another.
 *
 *   `organization`  E2-1's class is the organization's IDENTITY — "what organization exists?" —
 *                   read from L3's Organization Authority. Its own registry entry says it "keeps
 *                   ONE item and no roster", deliberately. Folding people in would make "this
 *                   organization is called Hebun" and "these are its people" one claim under one
 *                   provenance sentence, owned by an authority that reads neither table.
 *
 *   `placement`     OSA-3's class is WHO WORKS WHERE, and its provenance says in its own words
 *                   that it "is a register of PLACEMENTS, not a roster of members — a human this
 *                   organization has not placed does not appear at all". This class is the other
 *                   half of that sentence, and merging them would destroy the distinction the
 *                   placement authority went out of its way to state.
 *
 *                       MEMBER REGISTER != PLACEMENT REGISTER
 *                       UNPLACED        != NOT A MEMBER
 *
 *   `workforce`     exists, is unconnected, and is declared by the `workforce` WORKSPACE only —
 *                   a surface the mock-surface gate withholds from a real tenant. Filing durable
 *                   membership rows behind it would make them invisible to the only tenants that
 *                   have any, which is the mistake E2-8 recorded about `operations`. And `/heby`
 *                   resolves to Command, not to that workspace.
 *
 *     NEW SOURCE CLASS != NEW AUTHORITY. This projects rows released authorities already own.
 *
 * ── A NAME, NEVER AN ADDRESS ─────────────────────────────────────────────────
 *
 * The third grounding projection to name a human, and it is built against WORK-2's boundary rather
 * than discovered to be violating it: `resolveHumanNames` — `display_name -> name` — and never
 * `resolveHumanLabels`, which floors at `users.email`.
 *
 *     UI LEGIBILITY != MODEL PROVIDER DISCLOSURE
 *     AUTHORIZED TO READ != NECESSARY TO DISCLOSE
 *
 * The distinction is made in Identity by SELECTING DIFFERENT COLUMNS, never by inspecting a string
 * here: no `@` test, no regex, no local-part split, no heuristic. When Identity has no name for a
 * human this module says the name is unavailable and shows the identifier. It never guesses, never
 * derives a name from an address, never abbreviates and never falls back to a blank.
 *
 *     UNKNOWN REMAINS UNKNOWN.        AN ADDRESS IS NOT A NAME.
 *     THE NAME IS NOT THE KEY.        RESOLVED != AUTHORIZED.
 *
 * ── WHAT IT STRUCTURALLY CANNOT SAY ──────────────────────────────────────────
 *
 * No credential, no auth identity, no email, no role, no permission, no Governance standing, no
 * manager, no reporting line, no team, no placement, no title, no salary, no presence and no
 * activity. Not because each is filtered here, but because the read seam carries none of them to
 * filter — it projects three fields, and two of them are identifiers.
 *
 * Server-only.
 */
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveHumanNames } from "./human-label-read.server";
import {
  PEOPLE_NONE_RECORDED,
  readPeopleRegister,
  type PersonView,
} from "./people-register-read.server";

/**
 * Named for what it is, and for what it is not.
 *
 * A reader who sees this line must not conclude that Hebun employs anybody, observed anybody, or
 * that being listed here confers anything. All three are said before anything else is.
 */
export const PEOPLE_GROUNDING_PROVENANCE =
  "Organizational People Register — the humans whose membership of this organization Hebun records " +
  "as in force, read tenant-scoped from the session and authoritative (authoritative: true). " +
  "MEMBERSHIP OF THIS ORGANIZATION IN HEBUN IS NOT EMPLOYMENT: Hebun holds no employment record, " +
  "no contract, no start date and no HR fact of any kind, and the timestamp on each line is when " +
  "Hebun's membership record was created — not a hire date. Appearing here grants nobody anything " +
  "— no permission, no role, no Governance authority, no approval right and no right to execute " +
  "anything. It does NOT say where anyone works: departmental placement is a separate record with " +
  "its own authority, and a person listed here may be placed nowhere. It is a CURRENT register: a " +
  "membership that was revoked is absent, and absence here is not a statement that somebody was " +
  "never a member. Hebun has not observed anybody working, present, available or active.";

/** The refusal carried on every person item, held as its own constant so a test can pin it. */
export const PEOPLE_NON_CLAIM =
  "This is a RECORDED membership, not an observation. It says this organization's records name " +
  "this person as one of its members; it does not say what they do, where they work, who they " +
  "report to, what they may decide, or that Hebun has seen them.";

/** Said when Identity holds no NAME for an id this register names. Never replaced by a guess. */
export const PEOPLE_LABEL_UNAVAILABLE = "name unavailable";

/** The measured absence. A real answer about the organization, and never an outage. */
export const PEOPLE_NONE_STATEMENT = PEOPLE_NONE_RECORDED;

export interface PeopleGroundingDeps {
  readonly readRegister?: typeof readPeopleRegister;
  readonly resolveNames?: typeof resolveHumanNames;
}

function base(
  state: SourceResolution["state"],
  items: readonly ResolvedSourceItem[],
  unavailableReason?: string,
): SourceResolution {
  return {
    sourceClass: "people",
    state,
    provenance: PEOPLE_GROUNDING_PROVENANCE,
    /*
     * TRUE, on the same basis as `organization`, `work`, `placement` and `agent-mandate`:
     * `memberships` IS the record, and every field cited below is a stored column of a row a
     * released authority wrote. `authoritative` describes WHOSE RECORD IT IS, never whether the
     * world matches it, and the provenance above carries that second half explicitly.
     */
    authoritative: true,
    items,
    ...(unavailableReason === undefined ? {} : { unavailableReason }),
  };
}

/**
 * One member, as a grounding item.
 *
 * `label` carries the human-authored NAME, which is the released convention. `detail` is
 * machine-derived and flows into Heby's own deterministic prose, so every clause in it is a fact a
 * released authority stores plus the standing non-claim. Nothing in it is inferred.
 */
function personItem(person: PersonView, names: ReadonlyMap<string, string>): ResolvedSourceItem {
  const named = names.get(person.userId) ?? PEOPLE_LABEL_UNAVAILABLE;
  return {
    recordRef: `member/${person.membershipId}`,
    label: named,
    detail:
      `${named} (${person.userId}) is recorded as a member of this organization, and Hebun's ` +
      `record of that membership was created ${person.membershipRecordedAt} — which is not a hire ` +
      `date and not a start date. ${PEOPLE_NON_CLAIM}`,
    lifecycle: "settled",
  };
}

/**
 * Read this organization's people, for Heby grounding.
 *
 * Tenant-scoped through the released read seam — this module passes the server-resolved context
 * straight through and constructs no query. There is no parameter by which a caller could name
 * another tenant, so that is not refused here; it is UNREPRESENTABLE. The seam's Governance gate
 * applies unchanged, so an unauthorized session grounds on nothing rather than on a directory.
 *
 * THE THREE STATES SURVIVE INTO GROUNDING UNMERGED. An unreachable or refused register becomes
 * `unavailable` with its own sentence; a register that answered with nobody becomes `resolved`
 * carrying the measured-absence statement. Collapsing those two would let Heby state, on a database
 * outage or an authorization refusal, that an organization has no people.
 */
export async function readPeopleGroundingSource(
  tenant: TenantContext | null,
  deps: PeopleGroundingDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("People grounding reads are server-only.");
  }
  if (!tenant?.tenantId) {
    return base("unavailable", [], "no-authorized-tenant-context");
  }

  const readRegister = deps.readRegister ?? readPeopleRegister;
  const resolveNames = deps.resolveNames ?? resolveHumanNames;

  const register = await readRegister(tenant);
  if (register.status !== "available") {
    return base(
      "unavailable",
      [],
      "The Organizational People Register could not be read, so who belongs to this organization " +
        "is unknown. UNAVAILABLE IS NOT NONE: nothing here says whether anyone is a member.",
    );
  }

  if (register.people.length === 0) {
    /*
     * RESOLVED, NOT UNAVAILABLE. Hebun looked and holds no eligible membership. A real, measured
     * answer, and reporting it as an outage would be the mirror of the fabricated absence this
     * class exists to avoid.
     */
    return base("resolved", [
      {
        recordRef: "member:none-recorded",
        label: "No membership is recorded as in force",
        detail: `${PEOPLE_NONE_STATEMENT} ${PEOPLE_NON_CLAIM}`,
        lifecycle: "settled",
      },
    ]);
  }

  /*
   * ONE name read, for the ids this register already names.
   *
   * `resolveHumanNames`, NOT `resolveHumanLabels`: the address fallback is a product label and must
   * not leave this process. A failed, unauthorized or nameless read leaves the id ABSENT from the
   * map, and that item then renders the identifier with `name unavailable` rather than a guess.
   * Legibility failing must never make the register unavailable, so it is deliberately not
   * escalated.
   */
  const userIds = register.people.map((person) => person.userId);
  let names: ReadonlyMap<string, string> = new Map();
  try {
    names = await resolveNames(tenant, userIds);
  } catch {
    names = new Map();
  }

  const items = register.people.map((person) => personItem(person, names));

  if (register.truncated) {
    /*
     * THE BOUND IS DECLARED, NEVER SILENT. A model handed a truncated list with no statement that
     * it is truncated will answer "this organization has N people" and be wrong.
     */
    return base("resolved", [
      ...items,
      {
        recordRef: "member:bound-reached",
        label: "More people than are listed",
        detail:
          "This organization holds more memberships in force than are listed here. The list is " +
          "bounded, so it must not be read as the complete set of this organization's people.",
        lifecycle: "unknown",
      },
    ]);
  }

  return base("resolved", items);
}
