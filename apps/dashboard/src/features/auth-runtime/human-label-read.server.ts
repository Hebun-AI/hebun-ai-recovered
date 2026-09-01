/*
 * auth-runtime/human-label-read.server.ts — resolving a human identifier this organization ALREADY
 * NAMES to something a person can read (Human Legibility Reach).
 *
 * ── THIS CREATES NO AUTHORITY ────────────────────────────────────────────────
 *
 * Identity owns human identity, and `users` is the only place it lives. This module holds no table,
 * no writer, no transaction and no fact: it contains no insert, no update, no delete and no
 * transaction, and it is a READ PROJECTION over rows Identity already owns.
 *
 * It lives HERE, beside `identity-repository.server.ts`, for one reason: that is the module which
 * reads `users`, and a second reader of the same table belongs in the same directory rather than
 * inside whichever consumer happens to need it first. The released precedent is the one G6C set and
 * E2-1, E2-5 and AMA-3 followed — a projection belongs to the authority that owns the facts, and
 * the consumer imports the projection. Organization imports this; it does not re-implement it.
 *
 * `_base.ts` pre-shaped this work when it wrote of the polymorphic actor pair that "resolution of
 * the pair to a concrete actor is the Identity domain's job (later stage)". This is that job, taken
 * for humans only and for one product surface.
 *
 *     A LABEL IS NOT AN IDENTITY KEY.       A READABLE NAME GRANTS NOTHING.
 *     RESOLVED != AUTHORIZED.               UNRESOLVED != NOBODY.
 *
 * ── THE GATE IS THE ONE THAT ALREADY EXISTS ──────────────────────────────────
 *
 * `resolveGovernanceAuthority` — the same resolver `write-structure.server.ts` consumes before it
 * records a department, and the same one `readDelegationCandidates` consumes before it names a
 * member. No new Governance domain, no decision record, no permit, no new permission semantics. An
 * unauthorized caller receives an empty result rather than a directory, which is the released
 * posture of the delegation candidate read, quoted in its own words: "an unauthorized caller gets
 * an empty list rather than a directory".
 *
 * ── THREE READS: TWO PREDICATES, AND TWO DISCLOSURE POSTURES ─────────────────
 *
 * `readSelectableMembers` answers "who may be made accountable" and offers ACTIVE members only.
 * `resolveHumanLabels` answers "who is this identifier" for ids a record already names, and
 * deliberately does NOT filter on membership status — a department keeps naming the human recorded
 * as accountable after their membership ends, and rendering that person as a bare uuid because they
 * left would erase from the surface what the record still says. All are tenant-scoped by
 * predicate, so none can reach another organization's people.
 *
 * `resolveHumanNames` answers the SAME question as `resolveHumanLabels`, over the same rows through
 * the same gate and the same predicate, and differs in ONE thing: it projects the NAME columns only
 * and never the address. It exists because a value a surface may show is not automatically a value
 * that may be sent to a third party.
 *
 *     PRODUCT LEGIBILITY != EXTERNAL DISCLOSURE
 *     AUTHORIZED TO READ != NECESSARY TO DISCLOSE
 *
 * ── WHAT THIS IS NOT, AND MUST NOT BECOME ────────────────────────────────────
 *
 * Not a roster authority. Not a people directory. Not a search. Not a paging API — every read is
 * bounded by a constant and none accepts an offset or a cursor. Not a second identity store:
 * nothing here is written anywhere, and no label is ever persisted onto a department.
 *
 * No secret, no credential, no `auth_id`, no auth-identity internal and no membership internal is
 * projected. The shape a caller receives is `{ userId, label }` and nothing else.
 *
 * Server-only.
 */
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { memberships } from "@/db/schema/membership";
import { users } from "@/db/schema/user";
/*
 * The eligibility rule, shared with the Organization Structure Authority's owner writer. One
 * definition, two consumers: a picker that offered somebody the writer refuses would produce a
 * refusal no human could explain, and the alignment is now structural rather than coincidental.
 */
import {
  eligibleTenantMemberConditions,
  joinUsersToMemberships,
} from "./member-eligibility";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";

/**
 * THE LABEL, and its precedence, stated once.
 *
 * `display_name → name → email`, which is `readDelegationCandidates`' released precedence verbatim.
 * It is reused rather than re-decided: two places rendering the same human differently would be two
 * answers to one question. `email` is the floor because `users.email` is the only NOT NULL name-ish
 * column, so this expression can never produce null and no caller has to handle an empty label.
 *
 * Nothing is invented. A human with no `display_name` and no `name` reads as their address, which
 * is what Hebun actually knows about them.
 */
const LABEL_EXPRESSION = sql<string>`coalesce(${users.displayName}, ${users.name}, ${users.email})`;

/**
 * THE NAME, WITHOUT THE ADDRESS. The same precedence with the floor REMOVED, and nothing else.
 *
 * `display_name → name`, and NULL when a human has neither. It is a strict prefix of
 * `LABEL_EXPRESSION` — the same two columns in the same order — so the two reads can never disagree
 * about what a person is CALLED. They differ in exactly one thing: whether an unnamed human falls
 * back to their address.
 *
 *     PRODUCT LEGIBILITY != EXTERNAL DISCLOSURE
 *
 * WORK-2's production acceptance is what made the difference matter. The identity in production has
 * neither name column set, so the released label resolves to an EMAIL — correct on a page the
 * organization's own authorized human is reading, and a disclosure the moment the same string is
 * put into a model provider's request. `users.email` is a CONTACT ADDRESS and a login credential
 * half; `display_name` and `name` are what a person chose to be called. Being entitled to READ a
 * field is not a reason to SEND it.
 *
 *     AUTHORIZED TO READ != NECESSARY TO DISCLOSE
 *
 * The distinction is made by SELECTING DIFFERENT COLUMNS, never by inspecting a resolved string: no
 * `@` test, no regex, no heuristic. A human legitimately named "someone@example.com" would be
 * rendered by a heuristic as unnamed; here they are named, because `display_name` said so.
 */
const HUMAN_NAME_EXPRESSION = sql<string | null>`coalesce(${users.displayName}, ${users.name})`;

/**
 * The most members the picker will offer. The same bound `readDelegationCandidates` uses, for the
 * same reason: this is a selection control, not a directory, and a surface that needs paging needs
 * a different design decision than this milestone is authorized to take.
 */
export const MAX_SELECTABLE_MEMBERS = 50;

/**
 * The most identifiers one label resolution will answer. A defensive bound on a list the caller
 * derives from records it already holds — department owners are few — so it is a ceiling that
 * should never be reached rather than a page size.
 */
export const MAX_RESOLVABLE_LABELS = 100;

/** One human, as a surface may show them. Identifier FIRST: the id is the key, the label is not. */
export interface HumanLabel {
  readonly userId: string;
  readonly label: string;
}

/**
 * Why a legibility read could not answer. Closed, and each value is a fact about this request.
 *
 * There is no "empty" reason: a tenant whose authorized caller sees zero selectable members is a
 * `read` carrying an empty list, which is a measured answer and not a failure.
 */
export type HumanLabelUnavailableReason =
  /** No server-resolved tenant + human. There is no parameter through which a caller supplies one. */
  | "no-authorized-tenant-context"
  /** The caller does not hold this tenant's Governance authority. Fail closed. */
  | "not-authorized"
  /** The control plane is not reachable. Never falls back to memory, never to a guess. */
  | "authority-unavailable";

export type SelectableMembersRead =
  | { readonly status: "read"; readonly members: readonly HumanLabel[] }
  | { readonly status: "unavailable"; readonly reason: HumanLabelUnavailableReason };

export interface HumanLabelReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveAuthority?: typeof resolveGovernanceAuthority;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Human label reads are server-only.");
  }
}

function resolveDbOrNull(deps: HumanLabelReadDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * The gate, applied identically by both reads.
 *
 * ORDER IS THE GUARANTEE, and it is the order `write-structure.server.ts` already applies for K2's
 * reason: authorization BEFORE any subject is looked at, so an unauthorized caller cannot use the
 * outcome as an oracle for who belongs to a tenant.
 */
async function gate(
  tenant: TenantContext | null,
  deps: HumanLabelReadDeps,
): Promise<
  | { readonly ok: true; readonly db: ControlPlaneDatabase; readonly tenantId: string }
  | { readonly ok: false; readonly reason: HumanLabelUnavailableReason }
> {
  assertServerOnly();
  if (!tenant?.tenantId || !tenant.userId) {
    return { ok: false, reason: "no-authorized-tenant-context" };
  }

  const authority = await (deps.resolveAuthority ?? resolveGovernanceAuthority)(tenant);
  if (!authority.authorized) return { ok: false, reason: "not-authorized" };

  const db = resolveDbOrNull(deps);
  if (!db) return { ok: false, reason: "authority-unavailable" };

  return { ok: true, db, tenantId: tenant.tenantId };
}

/**
 * The humans of this organization who may be made accountable for a part of it.
 *
 * ── IT INCLUDES THE CALLER, AND THAT IS THE POINT ────────────────────────────
 *
 * `readDelegationCandidates` excludes the current authority holder — `u.id <> authorityActorId` —
 * because self-delegation is invalid and a control offering it would offer a refusal. Department
 * ownership has the OPPOSITE semantics: naming yourself accountable for a department you run is
 * ordinary, and OSA-2 recorded exactly that in production, where the tenant's only human owns
 * Engineering. Inheriting delegation's exclusion here would have made this control return an empty
 * list for the one organization that exists, and it would have looked like a broken feature rather
 * than a wrong predicate.
 *
 * It also does NOT inherit delegation's "does not already hold Governance authority" exclusion,
 * which is a fact about delegation and says nothing about accountability.
 *
 * ── IT IS STRICTER THAN THE WRITER, NEVER LOOSER ─────────────────────────────
 *
 * `setDepartmentOwner`'s own check is `memberships.lifecycle_status = 'active'` for the tenant. This
 * read additionally requires `status = 'active'`, `revoked_at is null` and a live, undeleted user —
 * the membership predicate `readDelegationCandidates` already uses. The direction matters and only
 * one direction is safe: a control that offers somebody the writer would refuse is a control that
 * produces refusals a human cannot explain. Offering a subset is never that.
 *
 * ── WHAT IT DOES NOT DO ──────────────────────────────────────────────────────
 *
 * It requires no auth identity, deliberately. Delegation does, because authority granted to
 * somebody who cannot sign in is authority nobody holds; accountability is an attribution and needs
 * no session. Narrowing this read by a rule borrowed from a different act would hide legitimate
 * people for no reason this milestone can state.
 *
 * Bounded, ordered by label, tenant-scoped by predicate. No offset, no cursor, no filter parameter:
 * a caller cannot point this at another organization, and cannot page through this one.
 */
export async function readSelectableMembers(
  tenant: TenantContext | null,
  deps: HumanLabelReadDeps = {},
): Promise<SelectableMembersRead> {
  const opened = await gate(tenant, deps);
  if (!opened.ok) return { status: "unavailable", reason: opened.reason };

  try {
    const rows = await opened.db
      .select({ userId: users.id, label: LABEL_EXPRESSION })
      .from(users)
      .innerJoin(memberships, joinUsersToMemberships())
      .where(and(...eligibleTenantMemberConditions(opened.tenantId)))
      .orderBy(asc(LABEL_EXPRESSION))
      .limit(MAX_SELECTABLE_MEMBERS);

    /*
     * A human with two membership rows in one tenant would otherwise appear twice in a picker. The
     * join can produce that; the surface must not. Deduped by id, keeping the first — the rows are
     * already ordered, so "first" is stable rather than arbitrary.
     */
    const seen = new Set<string>();
    const members: HumanLabel[] = [];
    for (const row of rows) {
      if (seen.has(row.userId)) continue;
      seen.add(row.userId);
      members.push({ userId: row.userId, label: row.label });
    }
    return { status: "read", members };
  } catch {
    return { status: "unavailable", reason: "authority-unavailable" };
  }
}

/**
 * Resolve identifiers this organization's records ALREADY NAME to readable labels.
 *
 * ── IT ANSWERS ONLY WHAT IT WAS ASKED ────────────────────────────────────────
 *
 * The caller supplies ids it already holds. This reads no record to discover an id, enumerates
 * nobody, and returns a map whose keys are a SUBSET of the input. An id that is not a member of the
 * caller's own tenant is simply absent from the result — the caller learns nothing about it, and
 * cross-tenant identity is therefore unreachable rather than filtered afterwards.
 *
 * ── IT DOES NOT FILTER ON MEMBERSHIP STATUS, DELIBERATELY ────────────────────
 *
 * OSA keeps naming a department's owner after their membership ends, with `currentlyActiveMember`
 * false, "because erasing them would destroy the record that anyone ever was". A label read that
 * dropped former members would put a bare uuid on exactly the row whose history matters most, so
 * membership here is a TENANT PREDICATE — did this person ever belong to my organization — and the
 * separate question of whether they still do is already answered by OSA's own derived flag.
 *
 * Deleted users are excluded: a soft-deleted identity is one Identity has withdrawn, and no surface
 * should re-publish it.
 *
 * An unauthorized caller, an unresolvable tenant and an unreachable database all yield an EMPTY
 * map. That is the same outcome as "none of these ids resolved", and the caller renders the
 * identifier in both cases, so no distinction is lost on the surface and none is leaked to a caller
 * who should not have it.
 */
export async function resolveHumanLabels(
  tenant: TenantContext | null,
  userIds: readonly string[],
  deps: HumanLabelReadDeps = {},
): Promise<ReadonlyMap<string, string>> {
  return resolveByExpression(tenant, userIds, LABEL_EXPRESSION, deps);
}

/**
 * Resolve the same identifiers to a human's NAME — and to nothing else if they have none.
 *
 * ── WHY THIS EXISTS BESIDE `resolveHumanLabels` AND NOT INSTEAD OF IT ────────
 *
 * Two questions that look like one:
 *
 *   `resolveHumanLabels`  "what should this organization's own surface CALL this person?"
 *                          Answered for a human who is already authorized to see them, inside
 *                          Hebun. An address is a true and useful answer there, and the two
 *                          released pickers keep it.
 *
 *   `resolveHumanNames`   "what may be SENT OUTSIDE this process about this person?"
 *                          Answered for a caller that is about to put the string into a third
 *                          party's request. A contact address is not necessary to that purpose,
 *                          so it is not offered.
 *
 * Collapsing them would force one of two wrongs: a picker that stops naming the only human this
 * organization has, or an address that leaves the process on every model call. Both are worse than
 * two reads over the same rows.
 *
 * ── IT IS NOT A SECOND IDENTITY AUTHORITY, AND NOT A SECOND PREDICATE ────────
 *
 * Same gate, same tenant predicate, same soft-delete exclusion, same bound, same table, same
 * module, same shared query. THE ONLY DIFFERENCE IS THE PROJECTED EXPRESSION. It reads no column
 * the sibling does not read, reaches no row the sibling cannot reach, and writes nothing.
 *
 * ── AN ABSENT ENTRY IS THE ANSWER, NOT A FAILURE ─────────────────────────────
 *
 * A human with neither name column is simply ABSENT from the map — the same shape the caller
 * already handles for an unresolvable id, an unauthorized caller and an unreachable database. The
 * caller therefore says "unknown" in exactly the words it already had, and NOTHING IS INVENTED
 * HERE: no local-part, no initials, no username, no role, no department, no guess.
 *
 *     UNKNOWN REMAINS UNKNOWN.       AN ADDRESS IS NOT A NAME.
 */
export async function resolveHumanNames(
  tenant: TenantContext | null,
  userIds: readonly string[],
  deps: HumanLabelReadDeps = {},
): Promise<ReadonlyMap<string, string>> {
  return resolveByExpression(tenant, userIds, HUMAN_NAME_EXPRESSION, deps);
}

/**
 * The one resolution both reads perform, with the projected expression as its only parameter.
 *
 * Written once so the gate, the tenant predicate, the soft-delete exclusion and the bound cannot
 * drift apart between the two callers — the same reason `member-eligibility.ts` exists for the
 * picker and the writer. A row whose expression is null contributes NO ENTRY, which is how the name
 * read reports "this person has no name" without inventing a value or a second return shape.
 */
async function resolveByExpression(
  tenant: TenantContext | null,
  userIds: readonly string[],
  expression: typeof LABEL_EXPRESSION | typeof HUMAN_NAME_EXPRESSION,
  deps: HumanLabelReadDeps,
): Promise<ReadonlyMap<string, string>> {
  const empty: ReadonlyMap<string, string> = new Map();

  const wanted = [...new Set(userIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (wanted.length === 0) return empty;
  if (wanted.length > MAX_RESOLVABLE_LABELS) return empty;

  const opened = await gate(tenant, deps);
  if (!opened.ok) return empty;

  try {
    const rows = await opened.db
      .select({ userId: users.id, label: expression })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.tenantId, opened.tenantId),
          inArray(users.id, wanted),
          isNull(users.deletedAt),
        ),
      );

    const resolved = new Map<string, string>();
    for (const row of rows) {
      if (typeof row.label !== "string" || row.label.length === 0) continue;
      resolved.set(row.userId, row.label);
    }
    return resolved;
  } catch {
    return empty;
  }
}
