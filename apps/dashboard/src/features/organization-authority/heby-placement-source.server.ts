/*
 * organization-authority/heby-placement-source.server.ts — the placement register's read projection
 * of itself, shaped for Heby grounding.
 *
 * ── WHY A NEW SOURCE CLASS AND NOT `organization` ────────────────────────────
 *
 * Same authority owner, and still a different class — because the `organization` class is chartered
 * around a shape this fact does not have, and folding placements in would falsify three of its
 * released claims at once:
 *
 *   "EXACTLY ONE ITEM, ALWAYS"        an organization is one record; a placement register is a
 *                                     bounded list of people
 *   "no member roster is carried"     its provenance sentence, which reaches the model
 *   "the owner is an IDENTIFIER"      it deliberately resolves no human to a name
 *
 * This is WORK-2's own rejection argument applied unchanged: *work names a department; it is not a
 * department*. A placement names a department and a human; it is neither. One provenance sentence
 * cannot honestly cover "this organization has an Engineering department" and "these people are
 * recorded as working in it" — a reader could not tell which claim carried which weight.
 *
 * So `heby-organization-source.server.ts` is UNTOUCHED, byte for byte, and every sentence above
 * stays true of it.
 *
 * ── READ-ONLY, AND PROVABLY ──────────────────────────────────────────────────
 *
 * No insert, no update, no delete, no transaction. It imports the READ SEAM, never the writer, so
 * `placeHumanInDepartment` and `withdrawPlacement` stay out of Heby's import graph entirely.
 *
 *     HEBY GROUNDS ON PLACEMENT != HEBY CAN PLACE ANYBODY
 *
 * ── THE HUMAN'S NAME IS PROVIDER-SAFE, BY DESIGN AND NOT BY ACCIDENT ─────────
 *
 * This module resolves names through `resolveHumanNames` — `display_name -> name`, and NOTHING
 * else. It can never reach `resolveHumanLabels`, whose released floor is the person's EMAIL
 * ADDRESS. That boundary was established one milestone earlier, when WORK-2's production acceptance
 * found the address reaching a model provider, and it is applied here at design time rather than
 * discovered at acceptance.
 *
 *     UI LEGIBILITY != MODEL PROVIDER DISCLOSURE
 *     AUTHORIZED TO READ != NECESSARY TO DISCLOSE
 *
 * When Identity has no name — none recorded, unresolvable, unauthorized, or Identity unreachable —
 * the item says `name unavailable` and shows the identifier. Nothing is derived from an address: no
 * local-part, no initials, no username, no guess. This module holds no address vocabulary at all
 * and could not tell a name from an address if it tried, which is exactly why it must not try.
 *
 * ── IT IS A PLACEMENT REGISTER, NOT A MEMBER ROSTER ──────────────────────────
 *
 * An UNPLACED member is invisible to it. It cannot enumerate this organization's people; it lists
 * the placements this organization has RECORDED, and resolves names only for the ids that register
 * already names. L3's "a COUNT, never a roster" rule about MEMBERS is untouched.
 *
 * ── THE FOUR DISTINCTIONS IT CARRIES AS DATA ─────────────────────────────────
 *
 * Not as prompt prose. Each travels in a provenance sentence or a per-item `detail` string, because
 * a model forgets an instruction and cannot forget a field.
 *
 *     RECORDED PLACEMENT != OBSERVED WORK
 *     PLACEMENT          != ROLE, AUTHORITY, PERMISSION OR REPORTING LINE
 *     PLACED             != STILL AN ACTIVE MEMBER
 *     UNPLACED           != NOT A MEMBER
 *
 * Server-only.
 */
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveHumanNames } from "@/features/auth-runtime/human-label-read.server";
import { readPlacementRegister, type PlacementView } from "./read-placement.server";
import { PLACEMENT_NONE_RECORDED } from "./read-placement.server";

/**
 * Named for what it is, and for what it is not.
 *
 * A reader who sees this line must not conclude that Hebun watched anybody work anywhere, nor that
 * a placement confers anything. Both are said before anything else is.
 */
export const PLACEMENT_GROUNDING_PROVENANCE =
  "Departmental Placement — this organization's recorded statement of which department each human " +
  "works in, read tenant-scoped from the session and authoritative (authoritative: true). Every " +
  "placement was RECORDED BY AN AUTHORIZED HUMAN through the product: Hebun did not observe anyone " +
  "working anywhere and verified nothing. A placement is attribution and grants that person " +
  "NOTHING — no permission, no Governance authority, no approval right, no right to execute " +
  "anything. IT IS NOT A ROLE, NOT A JOB TITLE, NOT A REPORTING LINE, NOT A MANAGER, NOT A TEAM " +
  "AND NOT A WORK ASSIGNMENT: Hebun holds no authority for any of those and carries none of them " +
  "here. This is a register of PLACEMENTS, not a roster of members — a human this organization has " +
  "not placed does not appear at all, so nothing here says who does or does not belong to it.";

/** The refusal carried on every placement item, held as its own constant so a test can pin it. */
export const PLACEMENT_NON_CLAIM =
  "This is a RECORDED placement, not an observed one. It says where this organization declared " +
  "this person works; it does not say what they do, who they report to, what they may decide, or " +
  "that Hebun watched any of it.";

/** Said when Identity holds no NAME for an id this register names. Never replaced by a guess. */
export const PLACEMENT_LABEL_UNAVAILABLE = "name unavailable";

/** The measured absence. A real answer about the organization, and never an outage. */
export const PLACEMENT_NONE_STATEMENT = PLACEMENT_NONE_RECORDED;

export interface PlacementGroundingDeps {
  readonly readRegister?: typeof readPlacementRegister;
  readonly resolveNames?: typeof resolveHumanNames;
}

function base(
  state: SourceResolution["state"],
  items: readonly ResolvedSourceItem[],
  unavailableReason?: string,
): SourceResolution {
  return {
    sourceClass: "placement",
    state,
    provenance: PLACEMENT_GROUNDING_PROVENANCE,
    /*
     * TRUE, on the same basis as `organization`, `work` and `agent-mandate`: `department_placements`
     * IS the record. Every field cited below is a stored column of a row an authorized human wrote.
     * `authoritative` describes WHOSE RECORD IT IS, never whether the world matches it, and the
     * provenance above carries that second half explicitly.
     */
    authoritative: true,
    items,
    ...(unavailableReason === undefined ? {} : { unavailableReason }),
  };
}

/**
 * One recorded placement, as a grounding item.
 *
 * The DEPARTMENT NAME travels in `label`, which is the released convention for a human-authored
 * NAME. `detail` is machine-derived and flows into Heby's own deterministic prose, so every clause
 * in it is a fact this authority stores plus the standing non-claim. Nothing in it is inferred.
 */
function placementItem(
  placement: PlacementView,
  names: ReadonlyMap<string, string>,
): ResolvedSourceItem {
  const name = names.get(placement.userId);
  const named = name ?? PLACEMENT_LABEL_UNAVAILABLE;
  const standing = placement.currentlyActiveMember
    ? ""
    : " — recorded placed, and no longer an active member of this organization; the record still " +
      "names them because erasing them would destroy the record that anyone ever worked there";
  const retired = placement.departmentInService
    ? ""
    : " The department itself is retired from service; the placement is kept so the record survives.";

  return {
    recordRef: `placement/${placement.placementId}`,
    label: placement.departmentName,
    detail:
      `${named} (${placement.userId}) is recorded as working in ${placement.departmentName} ` +
      `[${placement.departmentSlug}] (${placement.departmentId})${standing}.${retired} ` +
      PLACEMENT_NON_CLAIM,
    lifecycle: placement.departmentInService ? "settled" : "retired",
  };
}

/**
 * Read this organization's recorded placements, for Heby grounding.
 *
 * Tenant-scoped through the released read seam — this module passes the server-resolved context
 * straight through and constructs no query. There is no parameter by which a caller could name
 * another tenant, so that is not refused here; it is UNREPRESENTABLE.
 *
 * THE THREE STATES SURVIVE INTO GROUNDING UNMERGED. An unreachable authority becomes `unavailable`
 * with its own sentence; a register that answered with nothing becomes `resolved` carrying the
 * measured-absence statement. Collapsing those two would let Heby state, on a database outage, that
 * nobody in the organization works anywhere.
 */
export async function readPlacementGroundingSource(
  tenant: TenantContext | null,
  deps: PlacementGroundingDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Departmental placement grounding reads are server-only.");
  }
  if (!tenant?.tenantId) {
    return base("unavailable", [], "no-authorized-tenant-context");
  }

  const readRegister = deps.readRegister ?? readPlacementRegister;
  const resolveNames = deps.resolveNames ?? resolveHumanNames;

  const register = await readRegister(tenant);
  if (register.status !== "available") {
    return base(
      "unavailable",
      [],
      "The Departmental Placement register could not be reached, so who works where is unknown. " +
        "UNAVAILABLE IS NOT NONE: nothing here says whether any placement exists.",
    );
  }

  if (register.placements.length === 0) {
    /*
     * RESOLVED, NOT UNAVAILABLE. Hebun looked and this organization has recorded no placements. A
     * real, measured answer, and reporting it as an outage would be the mirror of the fabricated
     * absence this class exists to avoid.
     */
    return base("resolved", [
      {
        recordRef: "placement:none-recorded",
        label: "No placements have been recorded",
        detail: `${PLACEMENT_NONE_STATEMENT} ${PLACEMENT_NON_CLAIM}`,
        lifecycle: "settled",
      },
    ]);
  }

  /*
   * ONE name read, for the ids this register already names.
   *
   * `resolveHumanNames`, NOT `resolveHumanLabels`: the address fallback is a product label and must
   * not leave this process. See the header. A failed, unauthorized or nameless read leaves the id
   * ABSENT from the map, and that item then renders the identifier with `name unavailable` rather
   * than a guess. Legibility failing must never make the placements unavailable, so it is
   * deliberately not escalated.
   */
  const userIds = register.placements.map((placement) => placement.userId);
  let names: ReadonlyMap<string, string> = new Map();
  try {
    names = await resolveNames(tenant, userIds);
  } catch {
    names = new Map();
  }

  const items = register.placements.map((placement) => placementItem(placement, names));

  if (register.truncated) {
    /*
     * A BOUNDED LIST THAT SAYS SO. A model handed a silently truncated list would answer "that is
     * everybody" about a partial one.
     */
    items.push({
      recordRef: "placement:bounded",
      label: "This list is bounded",
      detail:
        "The register returned its maximum and this organization holds more recorded placements " +
        "than are listed here. Any count derived from this list is a count of what was listed, " +
        "never of what the organization holds.",
      lifecycle: "unknown",
    });
  }

  return base("resolved", items);
}
