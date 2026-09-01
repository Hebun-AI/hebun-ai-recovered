/*
 * DEPARTMENTAL PLACEMENT — WHO WORKS WHERE, AND WHAT THAT DOES NOT MEAN.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Heby can state which department this organization has RECORDED each human as working in, from
 *    the placement authority's own authoritative record. It names the human by a PROVIDER-SAFE
 *    name or says `name unavailable`, never by an address and never by a guess, and the identifier
 *    always travels beside it. It distinguishes recorded placements, a measured empty register and
 *    an unreachable authority, and never merges the last two. Every item carries the denial that a
 *    placement is a role, an authority, a reporting line or an observation."
 *
 * The pins:
 *
 *   RECORDED PLACEMENT != OBSERVED WORK
 *   PLACEMENT          != ROLE, AUTHORITY, PERMISSION, REPORTING LINE, MANAGER, WORK ASSIGNMENT
 *   PLACED             != STILL AN ACTIVE MEMBER
 *   UNPLACED           != NOT A MEMBER
 *   PLACEMENT REGISTER != MEMBER ROSTER
 *   UNAVAILABLE        != NONE RECORDED
 *   AN ADDRESS         != A NAME
 *
 * Pure: no database, no network, no model. Every read seam is injected.
 */
import assert from "node:assert/strict";
import {
  PLACEMENT_GROUNDING_PROVENANCE,
  PLACEMENT_LABEL_UNAVAILABLE,
  PLACEMENT_NON_CLAIM,
  PLACEMENT_NONE_STATEMENT,
  readPlacementGroundingSource,
} from "../../src/features/organization-authority/heby-placement-source.server";
import {
  DEPARTMENTAL_PLACEMENT_AUTHORITY_MODEL,
  MAX_PLACEMENTS_READ,
  PLACEMENT_AUDIT_ACTIONS,
  PLACEMENT_ENTITY_TYPE,
} from "../../src/features/organization-authority/placement-contracts";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import { resolveSource } from "../../src/features/heby-runtime/source-resolver";
import {
  HEBY_PROFILED_WORKSPACES,
  getHebyWorkspaceProfile,
} from "../../src/features/heby-integration/workspace-registry";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type {
  PlacementRegister,
  PlacementView,
} from "../../src/features/organization-authority/read-placement.server";

const TENANT = { tenantId: "t-1", userId: "u-1" } as unknown as TenantContext;

const PLACEMENT: PlacementView = {
  placementId: "p-1",
  userId: "u-1",
  departmentId: "d-1",
  departmentName: "Engineering",
  departmentSlug: "engineering",
  departmentInService: true,
  currentlyActiveMember: true,
};

const available = (placements: readonly PlacementView[], truncated = false): PlacementRegister => ({
  status: "available",
  placements,
  truncated,
  detail: "detail",
});

const naming = (names: Record<string, string>) => async (): Promise<ReadonlyMap<string, string>> =>
  new Map(Object.entries(names));

async function main(): Promise<void> {
  /* ═════════════════════════════════════════════════════════════════════════
   * 1. `placement` IS A DECLARED SOURCE CLASS, AND THE PURE RESOLVER KNOWS IT.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.ok(HEBY_SOURCE_CLASSES.includes("placement"), "`placement` is a declared source class");
  assert.equal(HEBY_SOURCE_CLASSES.length, 19, "the census grew by exactly one");

  const pure = resolveSource("placement");
  assert.equal(pure.sourceClass, "placement");
  assert.equal(pure.state, "unavailable", "the PURE resolver holds no tenant, so it reads nothing");
  assert.match(
    pure.unavailableReason ?? "",
    /tenant-scoped on the server/,
    "and it explains the SEAM rather than claiming nobody is placed anywhere",
  );
  assert.ok(
    !/nobody|no one|none|no placement|unplaced/i.test(pure.unavailableReason ?? ""),
    "UNAVAILABLE != NONE RECORDED — the pure default must never read as an absence",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. WORKSPACE SCOPE IS EXACT: COMMAND, AND ONLY COMMAND.
   * ═══════════════════════════════════════════════════════════════════════ */
  const carrying = HEBY_PROFILED_WORKSPACES.filter((w) =>
    getHebyWorkspaceProfile(w).sourceClasses.includes("placement"),
  );
  assert.deepEqual(carrying, ["command"], "exactly one workspace declares `placement`");
  for (const w of [
    "workforce",
    "operations",
    "intelligence",
    "knowledge",
    "governance",
    "platform",
    "decisions",
  ] as const) {
    assert.ok(
      !getHebyWorkspaceProfile(w).sourceClasses.includes("placement"),
      `${w} must not gain \`placement\` — scope is exact, not convenient`,
    );
  }
  assert.equal(HEBY_PROFILED_WORKSPACES.length, 8, "no ninth workspace was created");

  /*
   * `workforce` IS THE ONE THAT LOOKS RIGHT AND IS NOT. Asserted by name, because "it seemed
   * related" is exactly how a placement would become indistinguishable from a person's remit.
   */
  assert.ok(
    !getHebyWorkspaceProfile("workforce").sourceClasses.includes("placement"),
    "PLACEMENT != REMIT — the workforce workspace is not where a placement is answered",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. A RECORDED PLACEMENT REACHES THE MODEL, WITH EVERY FACT AND ITS DENIALS.
   * ═══════════════════════════════════════════════════════════════════════ */
  const resolved = await readPlacementGroundingSource(TENANT, {
    readRegister: async () => available([PLACEMENT]),
    resolveNames: naming({ "u-1": "Pat Preferred" }),
  });
  assert.equal(resolved.state, "resolved");
  assert.equal(resolved.sourceClass, "placement");
  assert.equal(resolved.authoritative, true, "`department_placements` IS the record; the class says so");
  assert.equal(resolved.provenance, PLACEMENT_GROUNDING_PROVENANCE, "provenance carried unchanged");
  assert.equal(resolved.items.length, 1);

  const item = resolved.items[0]!;
  assert.equal(item.recordRef, "placement/p-1", "a reference the model can never invent");
  assert.equal(item.label, "Engineering", "the DEPARTMENT NAME is the label");
  assert.equal(item.lifecycle, "settled");
  assert.match(item.detail, /Pat Preferred/, "the human's PROVIDER-SAFE name reaches context");
  assert.match(item.detail, /\(u-1\)/, "THE NAME IS NOT THE KEY — the identifier travels beside it");
  assert.match(item.detail, /Engineering/, "the department name reaches context");
  assert.match(item.detail, /\[engineering\]/, "and its slug");
  assert.match(item.detail, /\(d-1\)/, "and its identifier");

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. THE TRUTH SEMANTICS TRAVEL AS DATA, NOT AS PROMPT PROSE.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.ok(item.detail.includes(PLACEMENT_NON_CLAIM), "the standing non-claim rides on every item");
  assert.match(item.detail, /RECORDED placement, not an observed one/);
  assert.match(item.detail, /does not say what they do, who they report to/);

  for (const phrase of [
    /RECORDED BY AN AUTHORIZED HUMAN/,
    /did not observe anyone working anywhere/,
    /grants that person\s+NOTHING/,
    /NOT A ROLE, NOT A JOB TITLE, NOT A REPORTING LINE, NOT A MANAGER, NOT A TEAM/,
    /NOT A WORK ASSIGNMENT/,
    /register of PLACEMENTS, not a roster of members/,
  ]) {
    assert.match(PLACEMENT_GROUNDING_PROVENANCE, phrase, `provenance carries ${phrase}`);
  }

  /* NOTHING IN THE CLASS MAY READ AS AN AUTHORIZATION OR AN OBSERVATION. */
  const everything = `${PLACEMENT_GROUNDING_PROVENANCE} ${item.detail}`;
  /*
   * BANNED AS AFFIRMATIONS, NEVER AS BARE WORDS.
   *
   * A bare `/verified/` ban FAILED here — against the provenance's own "Hebun … verified nothing",
   * which is the sentence the ban exists to protect. That collision is recorded at E2-5, E2-8 and
   * AMA-2 and it recurred exactly as predicted. The honest form asks whether the class ASSERTS the
   * thing, so the denial passes and an affirmation still cannot.
   */
  for (const forbidden of [
    /\bis authorized to\b/i,
    /\bmay approve\b/i,
    /\breports to\b/i,
    /\bmanages\b/i,
    /\bobserved working\b/i,
    /\b(?:is|was|has been) verified\b/i,
    /\bverified that\b/i,
    /\bHebun (?:observed|watched) (?:them|this person|the human)\b/i,
  ]) {
    assert.ok(!forbidden.test(everything), `the class never claims: ${forbidden}`);
  }

  /* AND THE DENIALS ARE PRESENT — the other half, so the ban above can never pass by silence. */
  assert.match(PLACEMENT_GROUNDING_PROVENANCE, /verified nothing/, "the class denies verification");
  assert.match(PLACEMENT_NON_CLAIM, /not an observed one/, "and denies observation, per item");

  /* ═════════════════════════════════════════════════════════════════════════
   * 5. THE NAME IS PROVIDER-SAFE. AN ADDRESS IS NEVER A FALLBACK.
   *
   * Identity declines to name a human with no `display_name` and no `name`, so this class has no
   * address to leak. Proved over the composed item, and proved by the module holding no address
   * vocabulary at all.
   * ═══════════════════════════════════════════════════════════════════════ */
  const unnamed = await readPlacementGroundingSource(TENANT, {
    readRegister: async () => available([PLACEMENT]),
    resolveNames: naming({}),
  });
  const unnamedDetail = unnamed.items[0]!.detail;
  assert.equal(PLACEMENT_LABEL_UNAVAILABLE, "name unavailable", "the constant, pinned by value");
  assert.ok(
    unnamedDetail.startsWith(`${PLACEMENT_LABEL_UNAVAILABLE} (u-1)`),
    "an unnamed human reads as `name unavailable` with their identifier, and nothing else",
  );
  assert.ok(!unnamedDetail.includes("@"), "NO ADDRESS reaches the model through this class");
  for (const guess of ["u1", "user", "pat", "p."]) {
    assert.ok(
      !new RegExp(`\\b${guess}\\b`, "i").test(unnamedDetail),
      `no name is guessed from an identifier: ${guess}`,
    );
  }

  /* A legibility outage must not take the placements down with it. */
  const namesThrew = await readPlacementGroundingSource(TENANT, {
    readRegister: async () => available([PLACEMENT]),
    resolveNames: async () => {
      throw new Error("identity down");
    },
  });
  assert.equal(namesThrew.state, "resolved", "placements survive a legibility failure");
  assert.match(namesThrew.items[0]!.detail, new RegExp(PLACEMENT_LABEL_UNAVAILABLE));
  assert.match(namesThrew.items[0]!.detail, /\(u-1\)/, "the identifier is still there");

  /* ═════════════════════════════════════════════════════════════════════════
   * 6. AN EMPTY REGISTER IS A MEASURED ANSWER. AN OUTAGE IS NOT.
   * ═══════════════════════════════════════════════════════════════════════ */
  const empty = await readPlacementGroundingSource(TENANT, {
    readRegister: async () => available([]),
    resolveNames: naming({}),
  });
  assert.equal(empty.state, "resolved", "looked, found none — a REAL answer, never an outage");
  assert.equal(empty.items.length, 1);
  assert.ok(empty.items[0]!.detail.includes(PLACEMENT_NONE_STATEMENT));
  assert.match(
    empty.items[0]!.detail,
    /never a statement that nobody works anywhere/,
    "the measured absence refuses to become a claim about the organization",
  );

  const down = await readPlacementGroundingSource(TENANT, {
    readRegister: async () => ({ status: "unavailable", detail: "d" }) as PlacementRegister,
    resolveNames: naming({}),
  });
  assert.equal(down.state, "unavailable", "an unreachable authority is UNAVAILABLE");
  assert.equal(down.items.length, 0, "and contributes no item a model could read as a placement");
  assert.match(down.unavailableReason ?? "", /UNAVAILABLE IS NOT NONE/);
  assert.notEqual(
    down.unavailableReason,
    empty.items[0]!.detail,
    "the outage sentence and the measured-absence sentence are never the same words",
  );

  const noTenant = await readPlacementGroundingSource(null);
  assert.equal(noTenant.state, "unavailable");
  assert.equal(noTenant.unavailableReason, "no-authorized-tenant-context");

  /* ═════════════════════════════════════════════════════════════════════════
   * 7. A HUMAN WHO HAS SINCE LEFT IS STILL NAMED, AND THEIR STANDING IS STATED.
   * ═══════════════════════════════════════════════════════════════════════ */
  const departed = await readPlacementGroundingSource(TENANT, {
    readRegister: async () => available([{ ...PLACEMENT, currentlyActiveMember: false }]),
    resolveNames: naming({ "u-1": "Pat Preferred" }),
  });
  assert.match(departed.items[0]!.detail, /no longer an active member/);
  assert.match(departed.items[0]!.detail, /Pat Preferred/, "history is not rewritten");
  assert.match(
    departed.items[0]!.detail,
    /erasing them would destroy the record that anyone ever worked there/,
  );

  /* A retired department keeps its placements, labelled. */
  const retired = await readPlacementGroundingSource(TENANT, {
    readRegister: async () => available([{ ...PLACEMENT, departmentInService: false }]),
    resolveNames: naming({}),
  });
  assert.equal(retired.items[0]!.lifecycle, "retired");
  assert.match(retired.items[0]!.detail, /department itself is retired from service/);

  /* ═════════════════════════════════════════════════════════════════════════
   * 8. A BOUNDED LIST SAYS SO.
   * ═══════════════════════════════════════════════════════════════════════ */
  const bounded = await readPlacementGroundingSource(TENANT, {
    readRegister: async () => available([PLACEMENT], true),
    resolveNames: naming({}),
  });
  const boundedItem = bounded.items.find((i) => i.recordRef === "placement:bounded");
  assert.ok(boundedItem, "a truncated register contributes an explicit bound item");
  assert.match(boundedItem!.detail, /never of what the organization holds/);
  assert.ok(MAX_PLACEMENTS_READ > 0, "the bound is a real number");

  /* ═════════════════════════════════════════════════════════════════════════
   * 9. THE AUTHORITY MODEL SAYS WHAT IT OWNS AND WHAT IT REFUSES TO BE.
   * ═══════════════════════════════════════════════════════════════════════ */
  const model = DEPARTMENTAL_PLACEMENT_AUTHORITY_MODEL;
  assert.deepEqual([...model.writesTables], ["department_placements"], "exactly one table");
  assert.equal(model.writesMemberships, false, "it never writes the session's own row");
  assert.equal(model.writesDepartments, false, "and never the structural authority's table");
  assert.equal(model.writesGovernanceDecision, false);
  assert.equal(model.governanceDomainAdded, false);
  assert.equal(model.memberRoster, false, "PLACEMENT REGISTER != MEMBER ROSTER");
  assert.equal(model.agentPlacement, false, "an agent is placed by Agent Identity, not here");
  assert.equal(model.readToAuthorize, false, "nothing reads a placement to decide anything");
  assert.match(model.limitation, /declaration by an authorized human, not an observation/);
  assert.match(model.limitation, /confers no permission/);

  assert.equal(PLACEMENT_ENTITY_TYPE, "department_placement", "the audit subject is the placement");
  assert.deepEqual(
    [...PLACEMENT_AUDIT_ACTIONS],
    ["organization.placement.set", "organization.placement.withdrawn"],
    "exactly two audit actions, named exactly",
  );

  console.log("PASS osa3-departmental-placement/placement-truth");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
