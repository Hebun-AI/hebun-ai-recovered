/*
 * auth-runtime/people-register-read.server.ts — WHO IS IN THIS ORGANIZATION (OSA-4).
 *
 * ── THE QUESTION, AND WHY NOTHING COULD ANSWER IT ────────────────────────────
 *
 * Hebun could already say what parts an organization has (OSA-1), who owns each of them (HLR),
 * which department it records each person as working in (OSA-3), and what work it has declared
 * (WORK-1). It could not say WHO IS IN IT. Three released modules say so in their own words, and
 * each says it as a BOUND on itself rather than as an omission:
 *
 *   read-work.server.ts        "it cannot enumerate the organization's people"
 *   read-structure.server.ts   the same sentence, about department owners
 *   placement-contracts.ts     "PLACEMENT REGISTER != MEMBER ROSTER", "UNPLACED != NOT A MEMBER"
 *   workspace-registry.ts      "`organization` … keeps ONE item and no roster"
 *
 * This module is that roster, and the last of those four sentences is the reason it is a NEW read
 * rather than a widened one: a register of PEOPLE and a register of PLACEMENTS answer different
 * questions, and merging them would make "this organization has not placed you anywhere" and "you
 * do not belong to this organization" one indistinguishable answer.
 *
 * ── IT CREATES NO AUTHORITY, AND HOLDS NO FACT ───────────────────────────────
 *
 * Identity owns `users`; the Membership Authority owns `memberships`. This module contains no
 * insert, no update, no delete and no transaction: it is a READ PROJECTION over rows two released
 * authorities already own, and it stores nothing anywhere. It lives beside
 * `identity-repository.server.ts` and the Human Legibility Reach module, for the reason the latter
 * records — the modules that read these two tables belong in one directory rather than inside
 * whichever consumer needed one first.
 *
 *     A REGISTER IS NOT AN AUTHORITY.        LISTED != AUTHORIZED.
 *     A MEMBER IS NOT AN EMPLOYEE.           PRESENT IN A REGISTER != PRESENT AT WORK.
 *
 * ── WHY IT IS NOT `readSelectableMembers` UNDER A SECOND NAME ────────────────
 *
 * That read exists to fill a PICKER: it answers "who may be made accountable", it projects a
 * product LABEL for a `<select>`, and its own header forbids it from becoming a directory — "Not a
 * roster authority. Not a people directory." That sentence stays true, because this is a different
 * module answering a different question, and the two share the ONE thing that must never diverge:
 * the eligibility rule itself, which neither of them owns. `member-eligibility.ts` owns it, and its
 * header already anticipated this caller in as many words — "a caller enumerating a tenant's
 * members adds nothing".
 *
 * ── IT PROJECTS NO COLUMN OF `users`, AND THAT IS THE PRIVACY DESIGN ─────────
 *
 * `users` is JOINED, because two of the six eligibility conditions are facts about the identity —
 * a soft-deleted or archived human is not an eligible member. But NOT ONE COLUMN OF `users`
 * REACHES THE RESULT. No name, no display name, and above all no email: this register cannot leak
 * an address because it never selects one.
 *
 * Legibility is composed by the CALLER, from the released Identity projections, and the two callers
 * deliberately compose different ones — the split WORK-2's production acceptance forced:
 *
 *     the page   ->  resolveHumanLabels   (display_name -> name -> email)  product legibility
 *     Heby       ->  resolveHumanNames    (display_name -> name)           provider-safe
 *
 *     UI LEGIBILITY != MODEL PROVIDER DISCLOSURE
 *     AUTHORIZED TO READ != NECESSARY TO DISCLOSE
 *
 * ── ENUMERATION IS THE GATED ACT ─────────────────────────────────────────────
 *
 * `readPlacementRegister` needs no Governance gate: it enumerates PLACEMENTS, which are records
 * this organization wrote about itself. This enumerates PEOPLE, which is precisely the act
 * the Human Legibility Reach module gates in its own words — "an unauthorized caller gets an empty
 * list rather than a directory". So the same released gate applies here, in the same order:
 * authority
 * FIRST, before any subject is looked at, so an unauthorized caller cannot use the outcome as an
 * oracle for who belongs to a tenant.
 *
 * ── WHAT A ROW MEANS, AND THE FOUR THINGS IT DOES NOT ───────────────────────
 *
 * "This human currently holds a membership of this organization that is in force, and their
 *  identity is live." That is all. In particular:
 *
 *   MEMBER            != EMPLOYEE        Hebun records membership of a workspace, not employment.
 *   MEMBERSHIP RECORDED != HIRE DATE     The timestamp is when the ROW was created, nothing else.
 *   MEMBER            != PLACED          Where they work is OSA-3's register, not this one.
 *   ABSENT            != NEVER A MEMBER  This is a CURRENT register; a revoked membership is gone
 *                                        from it, and the register says so rather than implying it.
 *
 * Server-only.
 */
import { and, asc } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { memberships } from "@/db/schema/membership";
import { users } from "@/db/schema/user";
/*
 * The eligibility rule, shared with the picker and with the placement register's standing probe.
 * One definition, several consumers: a register that listed somebody the picker refuses to offer
 * would be two answers to one question.
 */
import {
  eligibleTenantMemberConditions,
  joinUsersToMemberships,
} from "./member-eligibility";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";

/**
 * The most people one read will answer with.
 *
 * A CEILING, NOT A PAGE SIZE. There is no offset, no cursor and no filter parameter, so a caller
 * cannot page through an organization's people; a register that needs paging needs a design
 * decision this milestone is not authorized to take. When the bound is reached the register SAYS
 * SO — `truncated` — because a list that quietly stops is a list that lies about who is here.
 */
export const MAX_PEOPLE_REGISTER = 200;

/** Why a people read could not answer. Closed, and each value is a fact about THIS request. */
export type PeopleRegisterUnavailableReason =
  /** No server-resolved tenant + human. There is no parameter through which a caller supplies one. */
  | "no-authorized-tenant-context"
  /** The caller does not hold this tenant's Governance authority. Fail closed. */
  | "not-authorized"
  /** The control plane is not reachable. Never falls back to memory, never to a guess. */
  | "authority-unavailable";

/**
 * ONE person of this organization, as a register names them.
 *
 * IDENTIFIERS ONLY. There is no name field here and there never will be one: a label is Identity's
 * answer, composed beside this read by whichever consumer is entitled to which projection.
 */
export interface PersonView {
  /** The human. THE KEY, and the only thing this register asserts about them. */
  readonly userId: string;
  /** The membership row that makes them a member. The record this line is drawn from. */
  readonly membershipId: string;
  /**
   * When the MEMBERSHIP ROW was created, ISO-8601.
   *
   * NOT a hire date, NOT a start date, NOT when this person joined the organization in the world.
   * It is when Hebun's record of the membership came into existence, and nothing else.
   */
  readonly membershipRecordedAt: string;
}

export type PeopleRegister =
  | {
      readonly status: "available";
      readonly people: readonly PersonView[];
      readonly truncated: boolean;
      readonly detail: string;
    }
  | {
      readonly status: "unavailable";
      readonly reason: PeopleRegisterUnavailableReason;
      readonly detail: string;
    };

/**
 * Said when the register answered and this organization has no eligible member at all.
 *
 * A MEASURED ANSWER, never an outage. It is close to impossible in practice — an organization with
 * no eligible member has nobody who could be reading this — and it is handled anyway, because the
 * one thing this register must never do is report an empty result as a failure or a failure as an
 * empty result.
 */
export const PEOPLE_NONE_RECORDED =
  "Hebun holds no eligible membership for this organization. That is a measured absence in " +
  "Hebun's own records — it is not a statement that this organization has no people.";

/** Said when the read itself could not answer. UNAVAILABLE IS NOT NONE. */
export const PEOPLE_UNAVAILABLE =
  "Hebun could not read this organization's people, so who belongs to it is unknown — not absent. " +
  "Nothing here says whether anyone is a member.";

/** Said when the caller does not hold this organization's Governance authority. */
export const PEOPLE_NOT_AUTHORIZED =
  "Listing this organization's people requires its Governance authority. Nothing was read, and " +
  "nothing here says who does or does not belong to it.";

/** Said when no organization is resolved for the session. */
export const PEOPLE_NO_TENANT =
  "No organization is resolved for this session, so there is nobody to list.";

const UNAVAILABLE_DETAIL: Readonly<Record<PeopleRegisterUnavailableReason, string>> = Object.freeze({
  "no-authorized-tenant-context": PEOPLE_NO_TENANT,
  "not-authorized": PEOPLE_NOT_AUTHORIZED,
  "authority-unavailable": PEOPLE_UNAVAILABLE,
});

export interface PeopleRegisterReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveAuthority?: typeof resolveGovernanceAuthority;
}

function unavailable(reason: PeopleRegisterUnavailableReason): PeopleRegister {
  return { status: "unavailable", reason, detail: UNAVAILABLE_DETAIL[reason] };
}

/** The sentence for a register that answered. Counts, never a claim about anybody's work. */
function describe(count: number, truncated: boolean): string {
  if (count === 0) return PEOPLE_NONE_RECORDED;
  return (
    `This organization has ${count} ${count === 1 ? "person" : "people"} whose membership Hebun ` +
    `holds in force${truncated ? ", and it holds more than are listed here" : ""}. Membership of ` +
    "this organization in Hebun is not employment, and it says nothing about what anyone does, " +
    "where they work, what they may decide, or whether Hebun has seen them today."
  );
}

/**
 * Read this organization's people.
 *
 * Tenant-scoped by the shared eligibility predicate. There is no tenant parameter and no user
 * parameter, so a cross-organization read is not refused here — it is UNREPRESENTABLE.
 */
export async function readPeopleRegister(
  tenant: TenantContext | null,
  deps: PeopleRegisterReadDeps = {},
): Promise<PeopleRegister> {
  if (typeof window !== "undefined") {
    throw new Error("People register reads are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) {
    return unavailable("no-authorized-tenant-context");
  }

  /*
   * AUTHORITY FIRST, before any subject is looked at. The order is the guarantee: a caller who is
   * refused learns nothing at all about who is in this organization.
   */
  const authority = await (deps.resolveAuthority ?? resolveGovernanceAuthority)(tenant);
  if (!authority.authorized) return unavailable("not-authorized");

  let db: ControlPlaneDatabase | null;
  try {
    db = deps.getDb ? deps.getDb() : getControlPlaneDb();
  } catch {
    db = null;
  }
  if (!db) return unavailable("authority-unavailable");

  try {
    const rows = await db
      /*
       * NOT ONE COLUMN OF `users`. The table is joined for the two identity halves of the
       * eligibility rule and contributes nothing to the result — see the header.
       */
      .select({
        userId: memberships.userId,
        membershipId: memberships.id,
        recordedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, joinUsersToMemberships())
      .where(and(...eligibleTenantMemberConditions(tenant.tenantId)))
      .orderBy(asc(memberships.createdAt), asc(memberships.id))
      .limit(MAX_PEOPLE_REGISTER + 1);

    const truncated = rows.length > MAX_PEOPLE_REGISTER;
    const kept = truncated ? rows.slice(0, MAX_PEOPLE_REGISTER) : rows;

    /*
     * `memberships_tenant_user_uq` already makes a second membership row for the same human in the
     * same tenant unrepresentable. Deduping anyway costs nothing and keeps "one line per person"
     * true of THIS function rather than true of an index somewhere else.
     */
    const seen = new Set<string>();
    const people: PersonView[] = [];
    for (const row of kept) {
      if (seen.has(row.userId)) continue;
      seen.add(row.userId);
      people.push({
        userId: row.userId,
        membershipId: row.membershipId,
        membershipRecordedAt: new Date(row.recordedAt).toISOString(),
      });
    }

    return {
      status: "available",
      people,
      truncated,
      detail: describe(people.length, truncated),
    };
  } catch {
    return unavailable("authority-unavailable");
  }
}

/**
 * The claims this register is FORBIDDEN from making, frozen so a test can read them and a surface
 * can render them rather than paraphrase them.
 *
 * The released `WORK_NON_CLAIMS` / `PLACEMENT` pattern: the honest bound is a value in the code,
 * not a sentence in a comment nobody ships.
 */
export const PEOPLE_NON_CLAIMS: readonly string[] = Object.freeze([
  "Membership of this organization in Hebun is not employment, and this is not an HR record.",
  "Appearing here grants nobody anything — no permission, no role, no Governance authority, no approval right.",
  "The timestamp is when Hebun's membership record was created; it is not a hire date and not a start date.",
  "This register does not say where anybody works: departmental placement is a separate record.",
  "Somebody absent from this register may still have been a member once; a revoked membership is not shown here.",
  "Hebun has not observed anybody working, present, available or active.",
]);
