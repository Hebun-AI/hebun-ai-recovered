/*
 * THE ORGANIZATIONAL PEOPLE REGISTER — THE WHOLE PATH IS CONNECTED, AND NOTHING ELSE MOVED.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A member travels Identity's read seam -> projection -> source resolution -> Command workspace
 *    -> MODEL CONTEXT -> answer, end to end, AND onto a product surface. And it took nothing with
 *    it: no schema, no migration, no writer, no membership mutation, no Governance decision, no
 *    action kind, no permit, no mandate, no execution, no provider capability, no dormant legacy
 *    authority and no second source of truth."
 *
 * A DECLARED SOURCE CLASS WITH NO RUNTIME SUBSTITUTION IS NOT CONNECTED.
 * A SUBSTITUTION WITH NO WORKSPACE REACHABILITY IS NOT AVAILABLE.
 * A CONTEXT ITEM THAT NEVER REACHES THE ANSWER PATH IS NOT PRODUCT REACHABILITY.
 * A BACKEND SEAM WITH NO SURFACE IS NOT A CAPABILITY.
 *
 * Structural assertions run over COMMENT-STRIPPED source, so this capability's own honest prose
 * about what it refuses to do can never satisfy — or trip — a check about what it does.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { codeOf } from "../helpers/durable-write-detector";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import { readPeopleGroundingSource } from "../../src/features/auth-runtime/heby-people-source.server";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination/contracts";
import { GOVERNANCE_SUBJECT_TYPES } from "../../src/features/governance-decision/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { PeopleRegister } from "../../src/features/auth-runtime/people-register-read.server";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string => codeOf(s);

const FEATURE = "src/features/auth-runtime";
const READER = `${FEATURE}/people-register-read.server.ts`;
const GROUNDING = `${FEATURE}/heby-people-source.server.ts`;
const LEGIBILITY = `${FEATURE}/human-label-read.server.ts`;
const ELIGIBILITY = `${FEATURE}/member-eligibility.ts`;
const MODEL_ANSWER = "src/features/heby-answer/model-answer.server.ts";
const RESOLVER = "src/features/heby-runtime/source-resolver.ts";
const REGISTRY = "src/features/heby-integration/workspace-registry.ts";
const PAGE = "src/app/(dashboard)/director/organization/page.tsx";
const PANEL = "src/components/organization-domain/people-register.tsx";
const JOURNAL = "src/db/migrations/meta/_journal.json";

const TENANT = { tenantId: "t-1", userId: "u-1" } as unknown as TenantContext;

const REGISTER: PeopleRegister = {
  status: "available",
  truncated: false,
  detail: "detail",
  people: [{ userId: "u-1", membershipId: "m-1", membershipRecordedAt: "2026-01-02T03:04:05.000Z" }],
};

/* ── the import-graph walker, the shape OSA-1, WORK-1, WORK-2 and OSA-3 established ── */
function valueEdges(file: string): string[] {
  const source = withoutComments(read(file));
  const specifiers: string[] = [];
  const re = /^\s*(import|export)\s+(type\s+)?((?:(?!\bfrom\b)[\s\S])*?)\s*from\s*["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m[2]) continue;
    const clause = m[3] ?? "";
    if (clause.includes("=")) continue;
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named && !/(^|,)\s*(?!type\s)[A-Za-z_$]/.test(named[1]!) && !/^[^{]*[A-Za-z_$]/.test(clause)) {
      continue;
    }
    specifiers.push(m[4]!);
  }
  return specifiers;
}
function resolveSpecifier(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join("src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.normalize(path.join(path.dirname(from), specifier));
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    const abs = path.join(ROOT, c);
    if (existsSync(abs) && statSync(abs).isFile()) return c;
  }
  return null;
}
function transitiveGraph(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of valueEdges(file)) {
      const r = resolveSpecifier(file, spec);
      if (r && !seen.has(r)) queue.push(r);
    }
  }
  return seen;
}
function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "synthetic-test-model",
  HEBUN_MODEL_CREDENTIAL: "synthetic-not-a-real-key",
  HEBUN_MODEL_TRANSPORT: "fake",
};

async function main(): Promise<void> {
  /* ═════════════════════════════════════════════════════════════════════════
   * 1. END TO END — THE CLASS REACHES THE MODEL REQUEST.
   *
   * The REAL answer flow with the REAL projection; only Identity's own read seams are injected.
   * ═══════════════════════════════════════════════════════════════════════ */
  let captured: ModelGenerationRequest | undefined;
  await answerHebyModelRequest(
    { prompt: "Who is in this organization?", route: "/heby" },
    {
      resolveTenant: async () => TENANT,
      readOverview: () => undefined,
      getConversationRepo: () => null,
      resolveDirectorEnabled: async () => true,
      env: MODEL_ENV,
      resolvePeople: async (tenant) =>
        readPeopleGroundingSource(tenant, {
          readRegister: async () => REGISTER,
          resolveNames: async () => new Map([["u-1", "Pat Preferred"]]),
        }),
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
  const grounding = captured!.evidence.join("\n");
  assert.match(grounding, /\[people\/member\/m-1\]/, "the membership citation reaches the model");
  assert.match(grounding, /Pat Preferred/, "the human's PROVIDER-SAFE name reaches the model");
  assert.match(grounding, /\(u-1\)/, "and the identifier travels beside it");
  assert.match(grounding, /IS NOT EMPLOYMENT/, "the provenance reaches the model");
  assert.match(
    grounding,
    /not a hire date/,
    "the truth semantics reach the model as data, not as prompt prose",
  );

  /* NO ADDRESS, ANYWHERE IN THE WHOLE REQUEST. The disclosure boundary, applied at design time. */
  assert.ok(
    !JSON.stringify(captured).includes("@"),
    "no email address reaches the provider through this class",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. A THROWING READ DEGRADES; IT NEVER INVENTS OR DENIES.
   * ═══════════════════════════════════════════════════════════════════════ */
  let degraded: ModelGenerationRequest | undefined;
  await answerHebyModelRequest(
    { prompt: "Who is in this organization?", route: "/heby" },
    {
      resolveTenant: async () => TENANT,
      readOverview: () => undefined,
      getConversationRepo: () => null,
      resolveDirectorEnabled: async () => true,
      env: MODEL_ENV,
      resolvePeople: async () => {
        throw new Error("people read exploded");
      },
      generate: async (request) => {
        degraded = request;
        return {
          status: "unavailable" as const,
          state: "TRANSPORT_UNAVAILABLE" as const,
          modelStatus: { available: false, reason: "provider-unavailable" as const, detail: "test" },
        };
      },
    },
  );
  const degradedText = JSON.stringify(degraded);
  assert.ok(
    !/has no people|nobody is a member|no members/i.test(degradedText),
    "a failed read must never become a claim that this organization has no people",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. THE READ SEAM IS A READ, AND IT PROJECTS NO COLUMN OF `users`.
   * ═══════════════════════════════════════════════════════════════════════ */
  const readerCode = withoutComments(read(READER));
  for (const verb of ["insert", "update", "delete", "transaction"]) {
    assert.ok(!new RegExp(`\\.${verb}\\(`).test(readerCode), `the register holds no ${verb}`);
  }
  for (const forbidden of [
    "users.email",
    "users.name",
    "users.displayName",
    "displayName",
    "display_name",
    "email",
  ]) {
    assert.ok(
      !readerCode.includes(forbidden),
      `the register cannot leak what it never selects: ${forbidden}`,
    );
  }
  assert.ok(
    readerCode.includes("eligibleTenantMemberConditions"),
    "it uses the SHARED eligibility rule rather than a second copy that can drift",
  );
  assert.ok(
    !/eq\(\s*memberships\.status/.test(readerCode) && !/isNull\(\s*memberships\.revokedAt/.test(readerCode),
    "and it re-states none of that rule's conditions itself",
  );

  /* THE GATE COMES FIRST — before any subject is looked at. Order is the guarantee. */
  const gateAt = readerCode.indexOf("resolveGovernanceAuthority");
  const selectAt = readerCode.indexOf(".select(");
  assert.ok(gateAt > 0 && selectAt > gateAt, "authority is resolved BEFORE anything is selected");

  /* THE GROUNDING PROJECTION IS A READ TOO, AND IT NEVER REACHES A WRITER. */
  const groundingCode = withoutComments(read(GROUNDING));
  for (const verb of ["insert", "update", "delete", "transaction"]) {
    assert.ok(!new RegExp(`\\.${verb}\\(`).test(groundingCode), `the projection holds no ${verb}`);
  }
  assert.ok(
    groundingCode.includes("readPeopleRegister"),
    "the projection consumes the read seam rather than re-reading memberships",
  );
  /*
   * Asserted by SEAM, not by vocabulary. The projection's own honest sentence about how many
   * memberships this organization holds contains the table's word, and a bare-substring ban on it
   * would forbid the evidence rather than the reach — the collision R6D, AMA-2 and E2-5 each
   * recorded. What matters is that no schema module and no database handle is imported.
   */
  assert.ok(
    !groundingCode.includes("db/schema") && !groundingCode.includes("getControlPlaneDb"),
    "and it holds no table and no database handle of its own",
  );
  assert.ok(!/\.from\(/.test(groundingCode), "it constructs no query");
  assert.ok(
    groundingCode.includes("resolveHumanNames") && !groundingCode.includes("resolveHumanLabels"),
    "it names humans through the PROVIDER-SAFE read only — UI LEGIBILITY != DISCLOSURE",
  );

  /* NOTHING IN EITHER IMPORT GRAPH IS A WRITER. */
  const graph = transitiveGraph([GROUNDING]);
  for (const file of graph) {
    assert.ok(
      !/\/write-[a-z-]+\.server\.ts$/.test(file),
      `${file}: the people grounding graph reaches no writer`,
    );
  }
  assert.ok(graph.has(READER) && graph.has(LEGIBILITY) && graph.has(ELIGIBILITY),
    "and it does reach the three released reads it is built from");

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. ZERO SCHEMA. THE LEDGER DID NOT MOVE.
   * ═══════════════════════════════════════════════════════════════════════ */
  const journal = JSON.parse(read(JOURNAL)) as { entries: readonly { tag: string }[] };
  assert.equal(journal.entries.length, 46, "the ledger carries no OSA-4 migration"); /* WEV-1 grew the ledger 44 -> 45; PBGA-1 45 -> 46 (`heby_action_requests` purpose columns). */
  const sqlFiles = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  assert.equal(sqlFiles.length, 46, "and the files agree");
  /*
   * PHASE-RELATIVE, NOT ABSOLUTE. "The newest migration is still X" is falsified by the next phase
   * that authors one, and the claim here is about OSA-4: it authored none.
   */
  assert.equal(
    journal.entries.filter((entry) => /osa4|people_register/i.test(entry.tag)).length,
    0,
    "no migration in the ledger bears OSA-4's name",
  );

  for (const file of [READER, GROUNDING, PANEL]) {
    assert.ok(!withoutComments(read(file)).includes("pgTable"), `${file} declares no table`);
  }
  assert.ok(
    !walk("src/db/schema").some((f) => /people|roster|person/.test(path.basename(f))),
    "no schema module was authored for this capability",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 5. NO WRITER EXISTS. MEMBERSHIP IS STILL WRITTEN WHERE IT ALWAYS WAS.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.ok(
    !existsSync(path.join(ROOT, `${FEATURE}/write-people.server.ts`)) &&
      !existsSync(path.join(ROOT, `${FEATURE}/people-register-write.server.ts`)),
    "OSA-4 authored no writer — it gives nobody a second way to make somebody a member",
  );
  const actions = "src/app/(dashboard)/director/organization/actions.ts";
  assert.ok(
    !withoutComments(read(actions)).includes("PeopleRegister") &&
      !withoutComments(read(actions)).includes("readPeopleRegister"),
    "and it added no server action",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 6. GOVERNANCE, ACTION AND MANDATE VOCABULARIES ARE UNTOUCHED.
   * ═══════════════════════════════════════════════════════════════════════ */
  /* GIA-1 admitted `record-work`. OSA-4 admitted neither member, which is what this pins. */
  assert.deepEqual(
    [...AGENT_ORIGINABLE_ACTION_KINDS],
    ["send", "record-work"],
    "no action kind was added by OSA-4",
  );
  assert.deepEqual(
    [...GOVERNANCE_SUBJECT_TYPES],
    ["knowledge_node"],
    "no Governance subject type was added",
  );
  for (const file of [READER, GROUNDING]) {
    const code = withoutComments(read(file));
    for (const forbidden of [
      "decision_records",
      "decisionRecords",
      "action_permits",
      "actionPermits",
      "agent_mandates",
      "agentMandates",
      "audit_log",
      "auditLog",
    ]) {
      assert.ok(!code.includes(forbidden), `${file}: names no ${forbidden}`);
    }
  }

  /* NO DORMANT LEGACY AUTHORITY WAS ACTIVATED. */
  for (const file of [READER, GROUNDING]) {
    const code = withoutComments(read(file));
    for (const dead of ["tasks", "goals", "plans", "missions", "workflows", "commands", "executions"]) {
      assert.ok(
        !new RegExp(`schema/${dead}`).test(code),
        `${file}: the dead ${dead} island stays dead`,
      );
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 7. THE RUNTIME SUBSTITUTION EXISTS AND IS IN THE CHAIN.
   * ═══════════════════════════════════════════════════════════════════════ */
  const answer = withoutComments(read(MODEL_ANSWER));
  assert.ok(answer.includes("readPeopleGroundingSource"), "the real projection is the default");
  assert.ok(answer.includes("async function withPeople"), "the substitution exists");
  assert.ok(
    answer.indexOf("withPeople(placementResolutions") > 0,
    "and it runs on the SAME evidence set, after the placements it is composed beside",
  );
  assert.ok(
    answer.includes("withOperations(peopleResolutions"),
    "and the chain carries its result forward rather than dropping it",
  );
  assert.ok(
    withoutComments(read(RESOLVER)).includes('case "people":'),
    "the pure resolver handles the class explicitly",
  );
  assert.ok(
    withoutComments(read(REGISTRY)).includes('"people",'),
    "and a workspace declares it",
  );
  assert.ok(HEBY_SOURCE_CLASSES.includes("people"));

  /* ═════════════════════════════════════════════════════════════════════════
   * 8. THE SURFACE: A BACKEND SEAM WITH NO SURFACE IS NOT A CAPABILITY.
   * ═══════════════════════════════════════════════════════════════════════ */
  const page = withoutComments(read(PAGE));
  assert.ok(page.includes("readPeopleRegister("), "the page performs the read on the server");
  assert.ok(page.includes("<PeopleRegisterPanel"), "and renders the panel");
  assert.ok(
    page.includes("resolveHumanLabels(tenant, peopleIds)"),
    "the PAGE composes the product label, which is the surface's own posture",
  );

  const panel = read(PANEL);
  const panelCode = withoutComments(panel);
  for (const forbidden of [
    "readPeopleRegister(",
    "resolveHumanLabels(",
    "resolveHumanNames(",
    "getControlPlaneDb",
    "memberships",
  ]) {
    assert.ok(!panelCode.includes(forbidden), `the panel performs no read: ${forbidden}`);
  }
  assert.match(panel, /person\.userId/, "the identifier is never erased from the surface");
  assert.match(panel, /name unavailable/, "and an unnamed human is named unavailable, never guessed");

  /*
   * THE ONE INFERENCE THIS SURFACE MAKES IS GUARDED. "Not placed anywhere" is read from an ABSENCE
   * in the placement register, which is only true when that register answered AND was complete.
   */
  assert.ok(
    panelCode.includes("placements.status === \"available\" && !placements.truncated"),
    "absence is only read as absence when the placement register answered in full",
  );
  assert.match(
    panel,
    /not a statement that they are placed nowhere/,
    "and when it did not, the surface says unknown — UNAVAILABLE != NONE",
  );
  assert.match(
    panel,
    /not employment|is not employment/i,
    "the surface states the boundary the register carries",
  );
  assert.match(
    panel,
    /retired from service; the placement is kept/,
    "and a placement into a retired department says so rather than reading as current",
  );

  console.log("PASS osa4-people-register/firewall");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
