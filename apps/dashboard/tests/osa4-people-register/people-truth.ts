/*
 * THE ORGANIZATIONAL PEOPLE REGISTER — WHO IS IN THIS ORGANIZATION, AND WHAT THAT DOES NOT MEAN.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Heby can state who this organization records as a member, from the membership record itself.
 *    It names each human by a PROVIDER-SAFE name or says `name unavailable`, never by an address
 *    and never by a guess, and the identifier always travels beside it. It distinguishes recorded
 *    members, a measured empty register, a refused read and an unreachable authority, and merges
 *    none of them. Every item carries the denial that membership is employment, that being listed
 *    grants anything, or that Hebun has observed anybody."
 *
 * The pins:
 *
 *   MEMBER              != EMPLOYEE
 *   MEMBER REGISTER     != PLACEMENT REGISTER
 *   MEMBERSHIP RECORDED != HIRE DATE
 *   LISTED              != AUTHORIZED
 *   ABSENT              != NEVER A MEMBER
 *   UNAVAILABLE         != NONE RECORDED
 *   NOT AUTHORIZED      != NOBODY IS A MEMBER
 *   AN ADDRESS          != A NAME
 *
 * Pure: no database, no network, no model. Every read seam is injected.
 */
import assert from "node:assert/strict";
import {
  PEOPLE_GROUNDING_PROVENANCE,
  PEOPLE_LABEL_UNAVAILABLE,
  PEOPLE_NON_CLAIM,
  PEOPLE_NONE_STATEMENT,
  readPeopleGroundingSource,
} from "../../src/features/auth-runtime/heby-people-source.server";
import {
  MAX_PEOPLE_REGISTER,
  PEOPLE_NON_CLAIMS,
  PEOPLE_NOT_AUTHORIZED,
  PEOPLE_NO_TENANT,
  PEOPLE_UNAVAILABLE,
  readPeopleRegister,
  type PeopleRegister,
  type PersonView,
} from "../../src/features/auth-runtime/people-register-read.server";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import { resolveSource } from "../../src/features/heby-runtime/source-resolver";
import {
  HEBY_PROFILED_WORKSPACES,
  getHebyWorkspaceProfile,
} from "../../src/features/heby-integration/workspace-registry";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "t-1", userId: "u-1" } as unknown as TenantContext;

const PERSON: PersonView = {
  userId: "u-1",
  membershipId: "m-1",
  membershipRecordedAt: "2026-01-02T03:04:05.000Z",
};

const available = (people: readonly PersonView[], truncated = false): PeopleRegister => ({
  status: "available",
  people,
  truncated,
  detail: "detail",
});

const naming = (names: Record<string, string>) => async (): Promise<ReadonlyMap<string, string>> =>
  new Map(Object.entries(names));

async function main(): Promise<void> {
  /* ═════════════════════════════════════════════════════════════════════════
   * 1. `people` IS A DECLARED SOURCE CLASS, AND THE PURE RESOLVER KNOWS IT.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.ok(HEBY_SOURCE_CLASSES.includes("people"), "`people` is a declared source class");
  assert.equal(HEBY_SOURCE_CLASSES.length, 20, "the census grew by exactly one");

  const pure = resolveSource("people");
  assert.equal(pure.sourceClass, "people");
  assert.equal(pure.state, "unavailable", "the PURE resolver holds no tenant, so it reads nothing");
  assert.match(
    pure.unavailableReason ?? "",
    /tenant-scoped on the server/,
    "and it explains the SEAM rather than claiming this organization has no people",
  );
  assert.ok(
    !/nobody|no one|no member|empty|has no people/i.test(pure.unavailableReason ?? ""),
    "UNAVAILABLE != NONE RECORDED — the pure default must never read as an absence",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. WORKSPACE SCOPE IS EXACT: COMMAND, AND ONLY COMMAND.
   * ═══════════════════════════════════════════════════════════════════════ */
  const carrying = HEBY_PROFILED_WORKSPACES.filter((w) =>
    getHebyWorkspaceProfile(w).sourceClasses.includes("people"),
  );
  assert.deepEqual(carrying, ["command"], "exactly one workspace declares `people`");
  assert.equal(HEBY_PROFILED_WORKSPACES.length, 8, "no ninth workspace was created");

  /*
   * `workforce` IS THE ONE THAT LOOKS RIGHT AND IS NOT — sharper here than for any predecessor,
   * because that class is literally chartered for "the humans an organization is made of". It is
   * unconnected vocabulary on a workspace the mock-surface gate withholds from a real tenant, and
   * `/heby` resolves to Command, so a durable membership filed behind it would be invisible to the
   * only tenants that have any.
   */
  assert.ok(
    !getHebyWorkspaceProfile("workforce").sourceClasses.includes("people"),
    "the workforce workspace is not where membership is answered",
  );
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
      !getHebyWorkspaceProfile(w).sourceClasses.includes("people"),
      `${w} must not gain \`people\` — scope is exact, not convenient`,
    );
  }

  /* THE CLASS IS BESIDE `placement`, NEVER INSTEAD OF IT. Both, in the same workspace. */
  const command = getHebyWorkspaceProfile("command").sourceClasses;
  assert.ok(command.includes("placement") && command.includes("people"),
    "MEMBER REGISTER != PLACEMENT REGISTER — Command carries both, and they answer different questions");

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. A RECORDED MEMBER REACHES THE MODEL, WITH EVERY FACT AND ITS DENIALS.
   * ═══════════════════════════════════════════════════════════════════════ */
  const resolved = await readPeopleGroundingSource(TENANT, {
    readRegister: async () => available([PERSON]),
    resolveNames: naming({ "u-1": "Pat Preferred" }),
  });
  assert.equal(resolved.state, "resolved");
  assert.equal(resolved.authoritative, true, "`memberships` IS the record");
  assert.equal(resolved.items.length, 1);

  const item = resolved.items[0]!;
  assert.equal(item.recordRef, "member/m-1", "the reference is the membership row, never the human");
  assert.equal(item.label, "Pat Preferred", "the PROVIDER-SAFE name is the label");
  assert.match(item.detail, /\(u-1\)/, "THE NAME IS NOT THE KEY — the identifier travels beside it");
  assert.match(item.detail, /2026-01-02T03:04:05\.000Z/, "the membership timestamp is carried");
  assert.match(item.detail, /not a hire\s*\n?\s*date and not a start date/,
    "and it says what that timestamp is NOT, on the item itself");
  assert.ok(item.detail.includes(PEOPLE_NON_CLAIM), "the standing non-claim rides on every item");
  assert.equal(item.lifecycle, "settled");

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. THE PROVENANCE CARRIES THE DISTINCTIONS AS DATA, NOT AS PROMPT PROSE.
   * ═══════════════════════════════════════════════════════════════════════ */
  for (const [claim, pattern] of [
    ["membership is not employment", /IS NOT EMPLOYMENT/],
    ["no HR fact of any kind", /no HR fact of any kind/],
    ["the timestamp is not a hire date", /not a hire date/],
    ["being listed grants nothing", /grants nobody anything/],
    ["placement is a separate record", /placement is a separate record/],
    ["a member may be placed nowhere", /may be placed nowhere/],
    ["absence is not never-a-member", /absence here is not a statement/],
    ["nothing was observed", /has not observed anybody/],
  ] as const) {
    assert.match(PEOPLE_GROUNDING_PROVENANCE, pattern, `the provenance states: ${claim}`);
  }
  assert.match(PEOPLE_GROUNDING_PROVENANCE, /authoritative: true/,
    "and it says whose record this is, in the same sentence that bounds it");

  /* The non-claims are FROZEN DATA a surface can render rather than paraphrase. */
  assert.ok(Object.isFrozen(PEOPLE_NON_CLAIMS), "the non-claims are frozen");
  assert.equal(PEOPLE_NON_CLAIMS.length, 6, "six of them, exactly");
  assert.ok(PEOPLE_NON_CLAIMS.some((c) => /not employment/.test(c)));
  assert.ok(PEOPLE_NON_CLAIMS.some((c) => /not a hire date/.test(c)));
  assert.ok(PEOPLE_NON_CLAIMS.some((c) => /does not say where anybody works/.test(c)));

  /* ═════════════════════════════════════════════════════════════════════════
   * 5. AN UNNAMED HUMAN IS UNNAMED. NEVER A GUESS, NEVER AN ADDRESS.
   * ═══════════════════════════════════════════════════════════════════════ */
  const unnamed = await readPeopleGroundingSource(TENANT, {
    readRegister: async () => available([PERSON]),
    resolveNames: naming({}),
  });
  assert.equal(unnamed.items[0]!.label, PEOPLE_LABEL_UNAVAILABLE, "UNKNOWN REMAINS UNKNOWN");
  assert.match(unnamed.items[0]!.detail, /\(u-1\)/, "and the identifier is still there to act on");
  assert.equal(PEOPLE_LABEL_UNAVAILABLE, "name unavailable");

  /* A THROWING NAME READ NEVER ESCALATES INTO AN UNAVAILABLE REGISTER. */
  const namesExploded = await readPeopleGroundingSource(TENANT, {
    readRegister: async () => available([PERSON]),
    resolveNames: async () => {
      throw new Error("legibility exploded");
    },
  });
  assert.equal(namesExploded.state, "resolved", "legibility failing does not un-record a member");
  assert.equal(namesExploded.items[0]!.label, PEOPLE_LABEL_UNAVAILABLE);

  /* ═════════════════════════════════════════════════════════════════════════
   * 6. THE THREE ABSENCES SURVIVE UNMERGED.
   * ═══════════════════════════════════════════════════════════════════════ */
  const none = await readPeopleGroundingSource(TENANT, {
    readRegister: async () => available([]),
    resolveNames: naming({}),
  });
  assert.equal(none.state, "resolved", "a measured empty register is an ANSWER, never an outage");
  assert.equal(none.items.length, 1);
  assert.ok(none.items[0]!.detail.includes(PEOPLE_NONE_STATEMENT));
  assert.match(PEOPLE_NONE_STATEMENT, /measured absence/);
  assert.match(PEOPLE_NONE_STATEMENT, /not a statement that this organization has no people/);

  for (const reason of ["authority-unavailable", "not-authorized"] as const) {
    const down = await readPeopleGroundingSource(TENANT, {
      readRegister: async () => ({ status: "unavailable", reason, detail: "d" }) as PeopleRegister,
      resolveNames: naming({}),
    });
    assert.equal(down.state, "unavailable", `a ${reason} register grounds as unavailable`);
    assert.equal(down.items.length, 0, "and carries no item that could be read as an answer");
    assert.match(down.unavailableReason ?? "", /UNAVAILABLE IS NOT NONE/);
    assert.ok(
      !/no member|nobody|has no people/i.test(down.unavailableReason ?? ""),
      "REFUSED AND UNREACHABLE ARE NOT ABSENCES",
    );
  }

  const noTenant = await readPeopleGroundingSource(null, {
    readRegister: async () => available([PERSON]),
  });
  assert.equal(noTenant.state, "unavailable");
  assert.equal(noTenant.unavailableReason, "no-authorized-tenant-context");
  assert.equal(noTenant.items.length, 0);

  /* ═════════════════════════════════════════════════════════════════════════
   * 7. THE BOUND IS DECLARED, NEVER SILENT.
   * ═══════════════════════════════════════════════════════════════════════ */
  const bounded = await readPeopleGroundingSource(TENANT, {
    readRegister: async () => available([PERSON], true),
    resolveNames: naming({ "u-1": "Pat Preferred" }),
  });
  assert.equal(bounded.items.length, 2, "the people, plus the statement that there are more");
  assert.equal(bounded.items[1]!.recordRef, "member:bound-reached");
  assert.match(bounded.items[1]!.detail, /must not be read as the complete set/);
  assert.equal(MAX_PEOPLE_REGISTER, 200, "the ceiling is a constant, not a page size");

  /* ═════════════════════════════════════════════════════════════════════════
   * 8. THE READ SEAM FAILS CLOSED, AND EACH REFUSAL SAYS WHAT IT IS NOT.
   *
   * Injected end to end: no database is opened by any branch below.
   * ═══════════════════════════════════════════════════════════════════════ */
  const noContext = await readPeopleRegister(null);
  assert.equal(noContext.status, "unavailable");
  assert.equal(noContext.status === "unavailable" && noContext.reason, "no-authorized-tenant-context");
  assert.equal(noContext.detail, PEOPLE_NO_TENANT);

  const refused = await readPeopleRegister(TENANT, {
    resolveAuthority: async () =>
      ({
        authorized: false,
        bootstrapDecisionId: null,
        authorityActorId: null,
        via: "none",
        delegationDecisionId: null,
        grantedByActorId: null,
      }) as Awaited<ReturnType<typeof import("../../src/features/governance-decision/authority-read.server").resolveGovernanceAuthority>>,
    getDb: () => {
      throw new Error("the gate must refuse BEFORE any database is touched");
    },
  });
  assert.equal(refused.status, "unavailable");
  assert.equal(refused.status === "unavailable" && refused.reason, "not-authorized");
  assert.equal(refused.detail, PEOPLE_NOT_AUTHORIZED);
  assert.match(PEOPLE_NOT_AUTHORIZED, /nothing here says who does or does not belong/,
    "NOT AUTHORIZED != NOBODY IS A MEMBER");

  const noDb = await readPeopleRegister(TENANT, {
    resolveAuthority: async () =>
      ({
        authorized: true,
        bootstrapDecisionId: "d-1",
        authorityActorId: "u-1",
        via: "bootstrap",
        delegationDecisionId: null,
        grantedByActorId: null,
      }) as Awaited<ReturnType<typeof import("../../src/features/governance-decision/authority-read.server").resolveGovernanceAuthority>>,
    getDb: () => null,
  });
  assert.equal(noDb.status, "unavailable");
  assert.equal(noDb.status === "unavailable" && noDb.reason, "authority-unavailable");
  assert.equal(noDb.detail, PEOPLE_UNAVAILABLE);
  assert.match(PEOPLE_UNAVAILABLE, /unknown — not absent/);

  console.log("PASS osa4-people-register/people-truth");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
