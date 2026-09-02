/*
 * WORK-ACTIVITY-1 — DECLARED AND OBSERVED, FOLLOWED THROUGH A CHAIN HUMANS BUILT.
 *
 * Every case runs the RELEASED executor with all four of its seams injected, so the work register,
 * the declared references, the Knowledge external reference and the live GitHub read can each answer
 * in every way they really can — with no network, no key, no credential and no database.
 *
 * ── THE CONFUSIONS THIS FILE EXISTS TO PREVENT ───────────────────────────────
 *
 *   ZERO OPEN PULL REQUESTS  IS NOT  PROVIDER UNAVAILABLE
 *   ZERO OPEN PULL REQUESTS  IS NOT  WORK INACTIVE / COMPLETE / NOT PROGRESSING
 *   NO DECLARED CONCERN      IS NOT  READ FAILURE
 *   OBSERVED ACTIVITY        IS NOT  PROGRESS != COMPLETION != VERIFICATION
 *   UNAVAILABLE              IS NOT  EMPTY
 *
 * Pure: no database, no network, no model.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { findHebyCommandById } from "../../src/features/heby-commands/registry";
import {
  WORK_ACTIVITY_NON_INFERENCE,
  WORK_ACTIVITY_PROVENANCE,
  runHebyCrossSourceCommand,
} from "../../src/features/heby-commands/cross-source-commands.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const ROOT_MODULE = "src/features/heby-commands/cross-source-commands.server.ts";

const COMMAND_ID = "work-activity";
const WORK_ID = "983d1cb2-4720-41bd-b430-0da7a5d7c344";
const WORK_REF = `work-item/${WORK_ID}`;
const FACT_ID = "dc8d3795-c506-444f-8acf-20f457934af3";
const REPO_ID = 1300480452;

const TENANT: TenantContext = asHumanTenantContext({
  tenantId: "10000000-0000-4000-8000-00000000wa01".replace("wa01", "aa01"),
  userId: "20000000-0000-4000-8000-00000000aa01",
  authIdentityId: "identity",
  membershipId: "membership",
  membershipVersion: 1,
  roleId: "role",
  sessionContextId: "session",
  provider: "local",
  assuranceLevel: "aal1",
  mfaVerified: false,
  requestId: "work-activity-1",
  authenticatedAt: "2026-09-02T20:00:00.000Z",
});

const WORK_ITEM = {
  workItemId: WORK_ID,
  title: "Hebun governed internal execution development",
  declaredState: "planned",
  inService: true,
  department: { departmentId: "d-1", name: "Engineering" },
  accountableActorId: null,
  recordedAt: "2026-09-02T14:03:35.963Z",
  updatedAt: "2026-09-02T14:03:35.963Z",
};

const REFERENCE = {
  referenceId: "r-1",
  workItemId: WORK_ID,
  kind: "knowledge-fact" as const,
  referentId: FACT_ID,
  declaredAt: "2026-09-02T19:26:23.720Z",
  referent: {
    label: "hebun-repository — Hebun AI source repository",
    standing: "provisional (NOT settled truth) · draft · no ratification recorded",
  },
};

type Deps = Parameters<typeof runHebyCrossSourceCommand>[1];

function deps(overrides: Partial<Deps> = {}): Deps {
  return {
    resolveTenant: async () => TENANT,
    readRegister: (async () => ({
      status: "available",
      items: [WORK_ITEM],
      truncated: false,
      detail: "",
    })) as never,
    readEvidence: (async () => ({ status: "available", references: [REFERENCE] })) as never,
    recordsForFacts: (async () => ({
      status: "resolved",
      records: [{ knowledgeFactId: FACT_ID, recordId: String(REPO_ID) }],
      queried: [FACT_ID],
    })) as never,
    readActivity: (async () => ({
      ok: true,
      value: {
        repository: { repositoryId: REPO_ID, fullName: "Hebun-AI/hebun-ai-recovered" },
        openPullRequests: [],
        truncated: false,
      },
    })) as never,
    ...overrides,
  } as Deps;
}

async function run(args: readonly string[], overrides: Partial<Deps> = {}) {
  const outcome = await runHebyCrossSourceCommand({ commandId: COMMAND_ID, args }, deps(overrides));
  assert.equal(outcome.status, "ok", "the command is runnable");
  if (outcome.status !== "ok") throw new Error("unreachable");
  return outcome.result;
}

async function main(): Promise<void> {
  /* ═══════════════════════════════════════════════════════════════════════
   * 1. THE COMMAND IS DECLARED, CROSS-SOURCE, AND TAKES A WORK REFERENCE.
   * ═════════════════════════════════════════════════════════════════════ */
  const command = findHebyCommandById(COMMAND_ID)!;
  assert.ok(command, "the command is registered");
  assert.equal(command.slash, "/work-activity");
  assert.equal(command.kind, "cross-source-read", "it is the released cross-source kind");
  assert.equal(command.availability, "available");
  assert.equal(command.reachesProvider, true, "it declares its provider reach");
  assert.equal(command.requiresModel, false, "it asks the model nothing");
  assert.equal(command.requiresExecution, false, "and it executes nothing");
  assert.equal(command.args.length, 1, "exactly one argument");
  assert.equal(command.args[0]!.name, "work");
  assert.ok(command.args[0]!.pattern!.test(WORK_REF), "a work reference is accepted");
  for (const rejected of [
    String(REPO_ID),
    "Hebun-AI/hebun-ai-recovered",
    `work-item/${WORK_ID.toUpperCase()}`,
    `work-item/${WORK_ID} `,
    FACT_ID,
    "work-item/not-a-uuid",
  ]) {
    assert.equal(
      command.args[0]!.pattern!.test(rejected),
      false,
      `"${rejected}" is not an address this command accepts`,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 2. ZERO OPEN PULL REQUESTS IS A SUCCESSFUL OBSERVATION.
   *
   * The mandatory negative semantic, and the case a reader is most tempted to over-read.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    const result = await run([WORK_REF]);
    const text = result.lines.join("\n");
    assert.equal(result.tone, "info", "ZERO IS NOT AN OUTAGE — it is an informational result");
    assert.equal(result.provenance, WORK_ACTIVITY_PROVENANCE);

    /* DECLARED, from the organization's own record. */
    assert.match(text, /DECLARED/);
    assert.match(text, /Hebun governed internal execution development/);
    assert.match(text, /Declared state: planned/);
    assert.match(text, /Department: Engineering/);
    assert.match(text, /hebun-repository — Hebun AI source repository/);
    /* THE STANDING IS KNOWLEDGE'S OWN WORDS, carried through unaltered. */
    assert.match(text, /provisional \(NOT settled truth\) · draft · no ratification recorded/);

    /* OBSERVED, from the provider, and named as such. */
    assert.match(text, /OBSERVED/);
    assert.match(text, /Provider: GitHub/);
    assert.match(text, /Hebun-AI\/hebun-ai-recovered/);
    assert.match(text, new RegExp(`repository/${REPO_ID}`), "the immutable id the join used");
    assert.match(text, /Open pull requests: 0\./);
    assert.match(text, /GitHub answered/, "a live answer, not a failure");

    /* AND THE THINGS IT MAY NEVER SAY. */
    for (const forbidden of [
      /unavailable/i, /could not/i, /no evidence/i, /inactive/i, /complete\b/i,
      /not progressing/i, /stalled\b/i, /repository (is )?missing/i,
    ]) {
      assert.ok(!forbidden.test(text), `zero must not read as "${forbidden}"`);
    }
    assert.ok(text.includes(WORK_ACTIVITY_NON_INFERENCE), "the non-inference sentence is present");
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 3. OPEN PULL REQUESTS ARE REPORTED, AND STILL PROVE NOTHING.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    const result = await run([WORK_REF], {
      readActivity: (async () => ({
        ok: true,
        value: {
          repository: { repositoryId: REPO_ID, fullName: "Hebun-AI/hebun-ai-recovered" },
          openPullRequests: [
            {
              number: 7,
              title: "Work evidence reference",
              state: "open",
              isDraft: false,
              authorLogin: "senolsevim",
              createdAt: "2026-09-01T10:00:00.000Z",
              updatedAt: "2026-09-02T10:00:00.000Z",
            },
          ],
          truncated: false,
        },
      })) as never,
    });
    const text = result.lines.join("\n");
    assert.match(text, /Open pull requests: 1\./);
    assert.match(text, /#7 Work evidence reference/);
    assert.match(text, /senolsevim/);
    assert.ok(text.includes(WORK_ACTIVITY_NON_INFERENCE), "still says activity verifies nothing");
    assert.match(text, /Declared state: planned/, "and the declared state is untouched by it");
    for (const forbidden of [/in progress/i, /progressing/i, /on track/i, /verified/i]) {
      assert.ok(!forbidden.test(text), `activity must not be read as "${forbidden}"`);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 4. EVERY BROKEN LINK IS A DIFFERENT, HONEST ANSWER.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    /* (a) A malformed address contacts nothing. */
    const bad = await run(["1300480452"]);
    assert.equal(bad.tone, "unavailable");
    assert.match(bad.lines.join("\n"), /no provider was contacted/i);

    /* (b) The register is unreadable — UNAVAILABLE IS NOT NONE. */
    const noRegister = await run([WORK_REF], {
      readRegister: (async () => ({ status: "unavailable", detail: "" })) as never,
    });
    assert.equal(noRegister.tone, "unavailable");
    assert.match(noRegister.lines.join("\n"), /UNAVAILABLE IS NOT NONE/);

    /* (c) The work is not on the register — and another tenant's is identical from here. */
    const absent = await run([`work-item/11111111-2222-3333-4444-555555555555`]);
    assert.equal(absent.tone, "unavailable");
    assert.match(absent.lines.join("\n"), /No work item of this organization carries that identity/);

    /* (d) Declarations unreadable — a READ FAILURE, never "concerns nothing". */
    const noEvidence = await run([WORK_REF], {
      readEvidence: (async () => ({ status: "unavailable", detail: "" })) as never,
    });
    assert.equal(noEvidence.tone, "unavailable");
    assert.match(noEvidence.lines.join("\n"), /read failure, not work that concerns nothing/);

    /* (e) NOTHING DECLARED — a real absence, and it says why, in an informational tone. */
    const nothingDeclared = await run([WORK_REF], {
      readEvidence: (async () => ({ status: "available", references: [] })) as never,
    });
    assert.equal(nothingDeclared.tone, "info", "a real absence is a result, not an outage");
    const nd = nothingDeclared.lines.join("\n");
    assert.match(nd, /Nobody in your organization has declared/);
    assert.match(nd, /real absence, not a failed read/);
    assert.match(nd, /no provider was contacted/);

    /* (f) The fact names no repository — also a real absence, also contacts nothing. */
    const noRecord = await run([WORK_REF], {
      recordsForFacts: (async () => ({ status: "resolved", records: [], queried: [FACT_ID] })) as never,
    });
    assert.equal(noRecord.tone, "info");
    assert.match(noRecord.lines.join("\n"), /recorded no GitHub repository relationship/);

    /* (g) The external-reference lookup FAILED — UNKNOWN, not absent. */
    const lookupDown = await run([WORK_REF], {
      recordsForFacts: (async () => ({ status: "unavailable", reason: "query-failed" })) as never,
    });
    assert.equal(lookupDown.tone, "unavailable");
    assert.match(lookupDown.lines.join("\n"), /UNKNOWN, not absent/);

    /* (h) The provider REFUSED — reusing the released refusal vocabulary, never reworded. */
    const refused = await run([WORK_REF], {
      readActivity: (async () => ({ ok: false, refusal: "not-connected" })) as never,
    });
    assert.equal(refused.tone, "unavailable");
    assert.ok(
      !/Open pull requests/.test(refused.lines.join("\n")),
      "a refusal never renders a count",
    );

    /* (i) The provider FAILED — and this may never become "no activity". */
    const failed = await run([WORK_REF], {
      readActivity: (async () => ({ ok: false, failure: "unreachable" })) as never,
    });
    assert.equal(failed.tone, "unavailable");
    assert.match(failed.lines.join("\n"), /will not present that as no activity/);
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 5. NO TENANT, NO ANSWER. And the command kind cannot be borrowed.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    const anonymous = await runHebyCrossSourceCommand(
      { commandId: COMMAND_ID, args: [WORK_REF] },
      { ...deps(), resolveTenant: async () => null },
    );
    assert.equal(anonymous.status, "unauthorized", "no tenant, nothing read, nothing contacted");

    const wrongKind = await runHebyCrossSourceCommand(
      { commandId: "pull-requests", args: [WORK_REF] },
      deps(),
    );
    assert.equal(wrongKind.status, "rejected");
    assert.equal(wrongKind.status === "rejected" ? wrongKind.reason : "", "not-a-cross-source-command");
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 6. THE MODULE OWNS NOTHING AND WRITES NOTHING.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    const code = read(ROOT_MODULE)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const banned of [
      ".insert(", ".update(", ".delete(", ".transaction(", "pgTable",
      "recordWork", "declareWorkEvidenceReference", "withdrawWorkEvidenceReference",
      "knowledgeExternalReferences", "workEvidenceReferences", "workItems",
      "approveActionRequest", "consumeActionPermit", "executeRecordWork",
      "@/features/heby-model", "@/features/heby-answer", "@/features/agent-",
    ]) {
      assert.ok(!code.includes(banned), `the cross-source root must not reach ${banned}`);
    }
    /* The provenance names both standings and claims neither is the other. */
    assert.match(WORK_ACTIVITY_PROVENANCE, /DECLARED/);
    assert.match(WORK_ACTIVITY_PROVENANCE, /OBSERVED/);
    assert.match(WORK_ACTIVITY_PROVENANCE, /authoritative: false/);
    assert.match(WORK_ACTIVITY_PROVENANCE, /stored nowhere/);
    assert.match(WORK_ACTIVITY_PROVENANCE, /wrote nothing anywhere/);
    assert.match(WORK_ACTIVITY_NON_INFERENCE, /does not change or verify/);
  }

  console.log("work-activity-1/command-and-truth-classes: OK");
}

void main();
