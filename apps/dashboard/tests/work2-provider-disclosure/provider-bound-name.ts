/*
 * WORK-2 POST-ACCEPTANCE PRIVACY HARDENING — WHAT LEAVES THIS PROCESS ABOUT A PERSON.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The human label Hebun puts into a model provider's request is a NAME the person was given —
 *    `display_name`, else `name` — or the exact words `name unavailable`. It is never their email
 *    address, never anything derived from one, and never a guess. The authoritative identifier
 *    still travels beside it, the work itself still grounds when no name exists, and the two
 *    released product surfaces keep the label they were accepted with."
 *
 * The pins:
 *
 *   UI LEGIBILITY      != MODEL PROVIDER DISCLOSURE
 *   AUTHORIZED TO READ != NECESSARY TO DISCLOSE
 *   AN ADDRESS         != A NAME
 *   UNKNOWN            REMAINS UNKNOWN
 *   THE NAME           != THE KEY
 *
 * ── WHAT THIS FILE CAN AND CANNOT MEASURE ────────────────────────────────────
 *
 * Pure: no database, no network, no model. So it proves the DISCLOSURE PATH — that whatever
 * Identity declines to name arrives at the provider as `name unavailable` with the identifier
 * intact — and it proves the SHAPE of the Identity expression by reading the shipped source.
 *
 * That an email-only human genuinely resolves to NOTHING through real SQL is proved where only a
 * real database can prove it: `tests/hlr-human-legibility/legibility-postgres.ts` §8, against the
 * same three fixtures (display_name, name-only, email-only) it already held.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { codeOf } from "../helpers/durable-write-detector";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import {
  WORK_LABEL_UNAVAILABLE,
  readWorkGroundingSource,
} from "../../src/features/organizational-work/heby-work-source.server";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import {
  HEBY_PROFILED_WORKSPACES,
  getHebyWorkspaceProfile,
} from "../../src/features/heby-integration/workspace-registry";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination/contracts";
import { GOVERNANCE_SUBJECT_TYPES } from "../../src/features/governance-decision/contracts";
import { ORGANIZATIONAL_WORK_AUTHORITY_MODEL } from "../../src/features/organizational-work/work-contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { WorkItemView, WorkRegister } from "../../src/features/organizational-work/read-work.server";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string => codeOf(s);

const IDENTITY = "src/features/auth-runtime/human-label-read.server.ts";
const GROUNDING = "src/features/organizational-work/heby-work-source.server.ts";
const MODEL_ANSWER = "src/features/heby-answer/model-answer.server.ts";
const ORGANIZATION_PAGE = "src/app/(dashboard)/director/organization/page.tsx";
const WORK_PAGE = "src/app/(dashboard)/director/work/page.tsx";
const JOURNAL = "src/db/migrations/meta/_journal.json";

const TENANT = { tenantId: "t-1", userId: "u-1" } as unknown as TenantContext;

/*
 * THE SHAPE OF THE PRODUCTION IDENTITY, as WORK-2's acceptance found it: no `display_name`, no
 * `name`, and therefore a released product label that IS this address. The whole point of this file
 * is that this string never reaches a provider, so it is written here once and hunted everywhere.
 */
const ADDRESS = "nameless@acme-disclosure.test";
const LOCAL_PART = "nameless";

const ITEM: WorkItemView = {
  workItemId: "w-1",
  title: "Hebun Era III development",
  declaredState: "active",
  lifecycleStatus: "active",
  inService: true,
  department: { departmentId: "d-1", name: "Engineering" },
  accountableActorId: "u-1",
  accountableCurrentlyActiveMember: true,
  recordedAt: "2026-09-01T14:23:21.224Z",
  updatedAt: "2026-09-01T14:23:21.224Z",
};

const available = (items: readonly WorkItemView[]): WorkRegister => ({
  status: "available",
  items,
  truncated: false,
  detail: "detail",
});

/** Identity answering with a name for `u-1`, or — with an empty map — declining to name them. */
const naming = (names: Record<string, string>) => async (): Promise<ReadonlyMap<string, string>> =>
  new Map(Object.entries(names));

/** Drive the REAL answer flow and hand back exactly what would have gone to the provider. */
async function providerBoundGrounding(
  resolveNames: () => Promise<ReadonlyMap<string, string>>,
): Promise<string> {
  let captured: ModelGenerationRequest | undefined;
  await answerHebyModelRequest(
    { prompt: "Who is accountable for Hebun Era III development?", route: "/heby" },
    {
      resolveTenant: async () => TENANT,
      readOverview: () => undefined,
      getConversationRepo: () => null,
      resolveDirectorEnabled: async () => true,
      env: {
        HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
        HEBUN_MODEL_PROVIDER: "claude",
        HEBUN_MODEL_ID: "synthetic-test-model",
        HEBUN_MODEL_CREDENTIAL: "synthetic-not-a-real-key",
        HEBUN_MODEL_TRANSPORT: "fake",
      },
      resolveWork: async (tenant) =>
        readWorkGroundingSource(tenant, { readRegister: async () => available([ITEM]), resolveNames }),
      generate: async (request) => {
        captured = request;
        return {
          status: "unavailable" as const,
          state: "TRANSPORT_UNAVAILABLE" as const,
          modelStatus: { available: false, reason: "provider-unavailable" as const, detail: "test" },
        };
      },
    },
  );
  assert.ok(captured, "the answer flow must have composed a model request");
  /*
   * THE WHOLE REQUEST, not just the evidence. A disclosure that arrived through the instruction,
   * the question or the history would be exactly as much of a disclosure, and asserting on one
   * field would be measuring the path I happen to expect.
   */
  return JSON.stringify(captured);
}

function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

async function main(): Promise<void> {
  /* ═════════════════════════════════════════════════════════════════════════
   * 1. A `display_name` IS ALLOWED INTO PROVIDER-BOUND GROUNDING.
   * ═══════════════════════════════════════════════════════════════════════ */
  const withDisplayName = await providerBoundGrounding(naming({ "u-1": "Pat Preferred" }));
  assert.match(withDisplayName, /Pat Preferred/, "a display name reaches the provider-bound request");
  assert.match(withDisplayName, /\(u-1\)/, "and the identifier travels beside it");
  assert.ok(
    !withDisplayName.includes(WORK_LABEL_UNAVAILABLE),
    "a named human is never reported as unnamed",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. A LEGAL `name` IS ALLOWED WHEN `display_name` IS ABSENT.
   *
   * Identity decides which of the two it hands over; this asserts that whatever NAME it hands over
   * is carried through unaltered rather than re-derived here.
   * ═══════════════════════════════════════════════════════════════════════ */
  const withName = await providerBoundGrounding(naming({ "u-1": "Sam Only Name" }));
  assert.match(withName, /Sam Only Name/, "a legal name reaches the provider-bound request");
  assert.match(withName, /\(u-1\)/);

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. AN ADDRESS IS NOT A FALLBACK — THE FINDING THIS HARDENING EXISTS FOR.
   *
   * Identity declines to name an email-only human, so nothing here has an address to leak. Proved
   * over the WHOLE request, and proved twice: the exact address, and the `@` that any address has.
   * ═══════════════════════════════════════════════════════════════════════ */
  const unnamed = await providerBoundGrounding(naming({}));
  assert.ok(
    !unnamed.includes(ADDRESS),
    "THE EMAIL ADDRESS IS ABSENT from everything bound for the model provider",
  );
  assert.ok(!unnamed.includes("@"), "and so is any address at all — no `@` anywhere in the request");

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. THE UNKNOWN NAME IS SAID IN EXACTLY THESE WORDS.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.equal(WORK_LABEL_UNAVAILABLE, "name unavailable", "the released constant, pinned by value");
  assert.ok(
    unnamed.includes(`accountable human: ${WORK_LABEL_UNAVAILABLE} (u-1)`),
    "an unnamed human reads as `name unavailable` with their identifier, and nothing else",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 5. THE AUTHORITATIVE IDENTIFIER IS PRESERVED — THE NAME NEVER REPLACED IT.
   *
   * WORK-2 uses it for reference integrity, so withholding it is a SEPARATE decision and this
   * milestone deliberately did not take it. Asserted in all three cases, not only the unnamed one.
   * ═══════════════════════════════════════════════════════════════════════ */
  for (const [request, who] of [
    [withDisplayName, "a human with a display name"],
    [withName, "a human with only a legal name"],
    [unnamed, "a human Identity will not name"],
  ] as const) {
    assert.match(request, /\(u-1\)/, `the identifier reaches the provider for ${who}`);
    assert.match(request, /work-item\/w-1/, `and so does the work record reference for ${who}`);
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 6. NO NAME IS EVER GUESSED FROM AN ADDRESS.
   *
   * `senoltr@gmail.com` must not become `senoltr`, `Senol` or `Şenol`. The fixture's local-part is
   * hunted in every casing, along with the domain and the initial-shaped forms.
   * ═══════════════════════════════════════════════════════════════════════ */
  const lowered = unnamed.toLowerCase();
  for (const guess of [LOCAL_PART, "Nameless", "acme-disclosure", "disclosure.test"]) {
    assert.ok(!lowered.includes(guess.toLowerCase()), `no name is derived from an address: ${guess}`);
  }
  /* And the module could not do it if it wanted to: it holds no address vocabulary at all. */
  const groundingCode = withoutComments(read(GROUNDING));
  for (const heuristic of ['"@"', "'@'", "indexOf(\"@\")", "split(\"@\")", "@[^\\s]+", "isEmail", "email"]) {
    assert.ok(
      !groundingCode.includes(heuristic),
      `the projection performs no address heuristic: ${heuristic}`,
    );
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 7. WORK STILL GROUNDS WHEN THERE IS NO NAME TO GIVE.
   *
   * A privacy control that took the answer down with it would be a worse product AND a worse
   * privacy story — the Director would simply ask somewhere else.
   * ═══════════════════════════════════════════════════════════════════════ */
  const resolution = await readWorkGroundingSource(TENANT, {
    readRegister: async () => available([ITEM]),
    resolveNames: naming({}),
  });
  assert.equal(resolution.state, "resolved", "the work is still grounded");
  assert.equal(resolution.items.length, 1);
  assert.match(unnamed, /Hebun Era III development/, "the title still reaches the provider");
  assert.match(unnamed, /declared state: active/, "and the declared state");
  assert.match(unnamed, /Engineering/, "and the department");
  assert.match(unnamed, /EVERY STATE IS A DECLARATION/, "and every released truth semantic");

  /* An Identity outage is the same answer, not a different one — and never an escalation. */
  const identityDown = await readWorkGroundingSource(TENANT, {
    readRegister: async () => available([ITEM]),
    resolveNames: async () => { throw new Error("identity down"); },
  });
  assert.equal(identityDown.state, "resolved", "an Identity failure never takes the work down");
  assert.match(identityDown.items[0]!.detail, new RegExp(WORK_LABEL_UNAVAILABLE));

  /* ═════════════════════════════════════════════════════════════════════════
   * 8. THE POLICY LIVES IN IDENTITY, AS A COLUMN CHOICE — NOT AS A STRING TEST.
   * ═══════════════════════════════════════════════════════════════════════ */
  const identity = read(IDENTITY);
  const identityCode = withoutComments(identity);

  assert.match(
    identityCode,
    /const HUMAN_NAME_EXPRESSION = sql<string \| null>`coalesce\(\$\{users\.displayName\}, \$\{users\.name\}\)`/,
    "the disclosable expression is display_name -> name, and it ENDS there",
  );
  const nameExpression = identityCode.slice(
    identityCode.indexOf("const HUMAN_NAME_EXPRESSION"),
    identityCode.indexOf(";", identityCode.indexOf("const HUMAN_NAME_EXPRESSION")),
  );
  assert.ok(
    !nameExpression.includes("email"),
    "THE DISCLOSABLE EXPRESSION NAMES NO ADDRESS COLUMN — this is the whole control",
  );

  /* The distinction is field provenance. No regex, no `@`, no local-part arithmetic, anywhere. */
  for (const heuristic of ["includes(\"@\")", "split(\"@\")", "indexOf(\"@\")", "/@/", "isEmail"]) {
    assert.ok(
      !identityCode.includes(heuristic),
      `the name read inspects no string to decide what a value is: ${heuristic}`,
    );
  }

  /* AND THE PRODUCT LABEL IS UNTOUCHED — asserted by its exact released text. */
  assert.match(
    identityCode,
    /const LABEL_EXPRESSION = sql<string>`coalesce\(\$\{users\.displayName\}, \$\{users\.name\}, \$\{users\.email\}\)`/,
    "the released product label still floors at the address, exactly as accepted",
  );

  /*
   * ONE GATE, ONE PREDICATE, TWO PROJECTIONS. The name read must not be a second, looser door: both
   * exported reads delegate to the SAME private resolver, so a gate or predicate change cannot
   * apply to one and miss the other.
   */
  assert.match(
    identityCode,
    /export async function resolveHumanLabels\([\s\S]*?\): Promise<ReadonlyMap<string, string>> \{\s*return resolveByExpression\(tenant, userIds, LABEL_EXPRESSION, deps\);\s*\}/,
    "the label read delegates to the shared resolver",
  );
  assert.match(
    identityCode,
    /export async function resolveHumanNames\([\s\S]*?\): Promise<ReadonlyMap<string, string>> \{\s*return resolveByExpression\(tenant, userIds, HUMAN_NAME_EXPRESSION, deps\);\s*\}/,
    "and so does the name read — the difference is the EXPRESSION and nothing else",
  );

  /* Identity gained no writer by any of this. */
  for (const verb of ["insert", "update", "delete", "transaction"]) {
    assert.ok(
      !new RegExp(`\\.${verb}\\(`).test(identityCode),
      `the legibility module holds no ${verb} — it is still a read projection`,
    );
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 9. THE GROUNDING PROJECTION CONSUMES THE NAME READ, AND ONLY THAT.
   *
   * WORK-2's firewall said EXACTLY ONE authority-owned projection resolves a human for grounding.
   * That claim is retained and NARROWED: it is still exactly one, and the one it is may resolve
   * only the provider-safe read.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.ok(
    groundingCode.includes("resolveHumanNames"),
    "the work projection resolves NAMES for the model",
  );
  assert.ok(
    !groundingCode.includes("resolveHumanLabels"),
    "and must NEVER reach the address-floored product label — that is the disclosure this closed",
  );

  const groundingConsumers = walk("src/features")
    .filter((file) => /heby-[a-z-]*source\.server\.ts$/.test(file))
    .filter((file) => withoutComments(read(file)).includes("human-label-read"));
  /*
   * TWO NOW, AND BOTH PROVIDER-SAFE. Departmental Placement is the second, and it was BUILT against
   * this boundary rather than discovered to be violating it. The list stays EXACT: a third fails.
   */
  const PLACEMENT_GROUNDING = "src/features/organization-authority/heby-placement-source.server.ts";
  /*
   * THREE NOW, AND ALL PROVIDER-SAFE. OSA-4's people projection is the third, and it too was BUILT
   * against this boundary rather than discovered to be violating it. The list stays EXACT: a fourth
   * fails.
   */
  const PEOPLE_GROUNDING = "src/features/auth-runtime/heby-people-source.server.ts";
  assert.deepEqual(
    groundingConsumers.sort(),
    [GROUNDING, PLACEMENT_GROUNDING, PEOPLE_GROUNDING].sort(),
    "exactly THREE grounding projections reach Identity legibility, and all are named",
  );

  /* No OTHER grounding source resolves a human by any route. A second one still fails here. */
  const namingSources = walk("src/features")
    .filter((file) => /heby-[a-z-]*source\.server\.ts$/.test(file))
    .filter((file) => {
      const code = withoutComments(read(file));
      return code.includes("resolveHumanNames") || code.includes("resolveHumanLabels");
    });
  assert.deepEqual(
    namingSources.sort(),
    [GROUNDING, PLACEMENT_GROUNDING, PEOPLE_GROUNDING].sort(),
    "and no FOURTH source learned to name a human",
  );
  /* Both name humans through the provider-safe read, and neither through the product label. */
  for (const source of namingSources) {
    assert.ok(
      !withoutComments(read(source)).includes("resolveHumanLabels"),
      `${source} names humans only through the provider-safe read`,
    );
  }

  /* The Heby subsystem still holds no legibility read of its own. IT RECEIVES; IT DOES NOT READ. */
  const hebyOwn = walk("src/features")
    .filter((file) => file.startsWith("src/features/heby"))
    .filter((file) => read(file).includes("human-label-read"));
  assert.deepEqual(hebyOwn, [], "Heby gained no identity read authority of its own");

  const answerCode = withoutComments(read(MODEL_ANSWER));
  for (const forbidden of ["human-label-read", "resolveHumanNames", "resolveHumanLabels", "users.email"]) {
    assert.ok(!answerCode.includes(forbidden), `the answer path holds no identity read: ${forbidden}`);
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 10. THE RELEASED UI LEGIBILITY POLICY IS UNCHANGED.
   *
   * Two pages, two components, the same read they were production-accepted with. A privacy change
   * that silently blanked the organization's own pickers would have been a different milestone.
   * ═══════════════════════════════════════════════════════════════════════ */
  for (const page of [ORGANIZATION_PAGE, WORK_PAGE]) {
    const code = withoutComments(read(page));
    assert.ok(code.includes("resolveHumanLabels"), `${page} still uses the released product label`);
    assert.ok(
      !code.includes("resolveHumanNames"),
      `${page} was deliberately NOT switched — UI LEGIBILITY != PROVIDER DISCLOSURE`,
    );
  }

  const uiConsumers = [...walk("src/app"), ...walk("src/components")]
    .filter((file) => withoutComments(read(file)).includes("resolveHumanNames"));
  assert.deepEqual(uiConsumers, [], "no product surface adopted the provider-safe read by accident");

  /* ═════════════════════════════════════════════════════════════════════════
   * 11. OWNERSHIP IS UNCHANGED ON BOTH SIDES.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.deepEqual(
    ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesTables,
    ["work_items"],
    "the Work Authority still writes exactly one table, and no identity table",
  );
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesGovernanceDecision, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesActionAuthorization, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesExecutionAttempt, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.agentAccountablePossible, false);

  /* Identity still owns human identity: the only module reading `users` for a label is Identity's. */
  const labelReaders = walk("src/features").filter((file) =>
    withoutComments(read(file)).includes("users.displayName"),
  );
  assert.deepEqual(
    labelReaders,
    [IDENTITY],
    "exactly one module projects a human's name columns, and it lives in Identity",
  );

  /* No work mutation became reachable from any of this. */
  for (const mutation of [
    "recordWork",
    "retitleWork",
    "setWorkDeclaredState",
    "setWorkAccountableHuman",
    "retireWork",
    "workItems",
  ]) {
    assert.ok(!groundingCode.includes(mutation), `the projection names no work mutation: ${mutation}`);
    assert.ok(!identityCode.includes(mutation), `and neither does Identity: ${mutation}`);
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 12. ZERO AUTHORITY EXPANSION, AND ZERO SCHEMA.
   * ═══════════════════════════════════════════════════════════════════════ */
  /* GIA-1 admitted `record-work`. This hardening admitted neither member, which is what this pins. */
  assert.deepEqual(
    [...AGENT_ORIGINABLE_ACTION_KINDS],
    ["send", "record-work"],
    "no action kind was added by this hardening",
  );
  assert.deepEqual([...GOVERNANCE_SUBJECT_TYPES], ["knowledge_node"], "no Governance subject type was added");
  /* Twenty since OSA-4 added `people`. Pinned here only so an undeclared class still fails. */
  assert.equal(HEBY_SOURCE_CLASSES.length, 20, "no source class was added or removed by this milestone");
  assert.ok(HEBY_SOURCE_CLASSES.includes("work"), "and `work` is still one of them");

  const carrying = HEBY_PROFILED_WORKSPACES.filter((w) =>
    getHebyWorkspaceProfile(w).sourceClasses.includes("work"),
  );
  assert.deepEqual(carrying, ["command"], "Command remains the ONLY workspace carrying `work`");
  assert.equal(HEBY_PROFILED_WORKSPACES.length, 8, "no ninth workspace was created");

  const journal = JSON.parse(read(JOURNAL)) as { entries: readonly unknown[] };
  assert.equal(journal.entries.length, 44, "the ledger is where GIA-1 left it; this hardening authored none of it"); /* GIA-1 grew the ledger 43 -> 44: the `record-work` mandate-scope CHECK. */
  const sqlFiles = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  assert.equal(sqlFiles.length, 44, "and this hardening authored no migration of its own");

  console.log("PASS work2-provider-disclosure/provider-bound-name");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
