/*
 * WORK-2 — THE WHOLE PATH IS CONNECTED, AND HEBY GAINED NO AUTHORITY BY IT.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Recorded work travels Organizational Work Authority -> projection -> source resolution ->
 *    Command workspace -> MODEL CONTEXT -> answer, end to end, with the title, the declared state,
 *    the department and the accountable human's readable label all arriving. And Heby gained
 *    nothing: no work writer is in its import graph, no action kind was added, no mandate changed,
 *    no permit or execution authority exists, no schema and no migration were authored."
 *
 * A DECLARED SOURCE CLASS WITH NO RUNTIME SUBSTITUTION IS NOT CONNECTED.
 * A SUBSTITUTION WITH NO WORKSPACE REACHABILITY IS NOT AVAILABLE.
 * A CONTEXT ITEM THAT NEVER REACHES THE ANSWER PATH IS NOT PRODUCT REACHABILITY.
 *
 * Structural assertions run over COMMENT-STRIPPED source, so this milestone's own honest prose
 * about what it refuses to do can never satisfy — or trip — a check about what it does.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { codeOf } from "../helpers/durable-write-detector";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import { readWorkGroundingSource } from "../../src/features/organizational-work/heby-work-source.server";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination/contracts";
import { GOVERNANCE_SUBJECT_TYPES } from "../../src/features/governance-decision/contracts";
import { ORGANIZATIONAL_WORK_AUTHORITY_MODEL } from "../../src/features/organizational-work/work-contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { WorkRegister } from "../../src/features/organizational-work/read-work.server";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string => codeOf(s);

const FEATURE = "src/features/organizational-work";
const GROUNDING = `${FEATURE}/heby-work-source.server.ts`;
const WRITER = `${FEATURE}/write-work.server.ts`;
const MODEL_ANSWER = "src/features/heby-answer/model-answer.server.ts";
const JOURNAL = "src/db/migrations/meta/_journal.json";

const TENANT = { tenantId: "t-1", userId: "u-1" } as unknown as TenantContext;

const REGISTER: WorkRegister = {
  status: "available",
  truncated: false,
  detail: "detail",
  items: [
    {
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
    },
  ],
};

/* ── the import-graph walker, the shape OSA-1 and WORK-1 established ── */
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

async function main(): Promise<void> {
  /* ═════════════════════════════════════════════════════════════════════════
   * 1. END TO END — THE CLASS REACHES THE MODEL REQUEST.
   *
   * This is the assertion that makes "connected" mean something. It drives the REAL answer flow
   * with the REAL projection (only the authority's own read seam is injected) and reads what
   * actually landed in the model's grounding context.
   * ═══════════════════════════════════════════════════════════════════════ */
  let captured: ModelGenerationRequest | undefined;
  await answerHebyModelRequest(
    { prompt: "What work has this organization recorded, and what state has it declared each to be in?", route: "/heby" },
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
      /* THE REAL PROJECTION, over an injected authority read. Nothing about Heby is stubbed. */
      resolveWork: async (tenant) =>
        readWorkGroundingSource(tenant, {
          readRegister: async () => REGISTER,
          resolveLabels: async () => new Map([["u-1", "Şenol Sevim"]]),
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

  assert.match(grounding, /\[work\/work-item\/w-1\]/, "the work citation reaches the model");
  assert.match(grounding, /Hebun Era III development/, "the TITLE reaches the model");
  assert.match(grounding, /declared state: active/, "the DECLARED STATE reaches the model");
  assert.match(grounding, /Engineering/, "the DEPARTMENT reaches the model");
  assert.match(grounding, /Şenol Sevim/, "the ACCOUNTABLE HUMAN'S LABEL reaches the model");
  assert.match(grounding, /\(u-1\)/, "and the identifier travels beside it");
  assert.match(grounding, /EVERY STATE IS A DECLARATION/, "the provenance reaches the model");
  assert.match(
    grounding,
    /DECLARED COMPLETE IS NOT VERIFIED, NOT SUCCESSFUL, AND NOT AN OUTCOME/,
    "the truth semantics reach the model as data, not as prompt prose",
  );
  assert.ok(
    !/declared state: blocked/.test(grounding),
    "no blocked work is manufactured for a register that has none",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. A THROWING READ DEGRADES; IT NEVER INVENTS OR DENIES.
   * ═══════════════════════════════════════════════════════════════════════ */
  let degraded: ModelGenerationRequest | undefined;
  await answerHebyModelRequest(
    { prompt: "What are we working on?", route: "/heby" },
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
      resolveWork: async () => { throw new Error("work read exploded"); },
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
  const degradedGrounding = degraded!.evidence.join("\n");
  assert.match(degradedGrounding, /\[work\] unavailable/, "the class degrades to the pure resolution");
  assert.match(degradedGrounding, /tenant-scoped on the server/);
  assert.ok(
    !/no work|none recorded|nothing recorded|is doing nothing/i.test(degradedGrounding),
    "A THROWN READ MUST NEVER READ AS 'THIS ORGANIZATION HAS NO WORK'",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. HEBY HAS NO WORK WRITER — measured over the REAL import graph.
   * ═══════════════════════════════════════════════════════════════════════ */
  const answerGraph = transitiveGraph([MODEL_ANSWER]);
  assert.ok(answerGraph.has(GROUNDING), "the answer path reaches the work PROJECTION");
  assert.ok(!answerGraph.has(WRITER), "and it must NEVER reach the work WRITER");

  const answerCode = withoutComments(read(MODEL_ANSWER));
  for (const mutation of [
    "recordWork",
    "retitleWork",
    "setWorkDeclaredState",
    "setWorkAccountableHuman",
    "retireWork",
    "workItems",
  ]) {
    assert.ok(
      !answerCode.includes(mutation),
      `the answer path must not name ${mutation} — HEBY GROUNDS ON WORK != HEBY HAS A WORK WRITER`,
    );
  }

  /* The projection itself is read-only, and provably. */
  const groundingCode = withoutComments(read(GROUNDING));
  for (const verb of ["insert", "update", "delete", "transaction"]) {
    assert.ok(
      !new RegExp(`\\.${verb}\\(`).test(groundingCode),
      `the work projection must contain no ${verb}`,
    );
  }
  assert.ok(
    !groundingCode.includes("write-work.server"),
    "the projection imports the READ seam, never the writer",
  );
  assert.ok(
    !groundingCode.includes("@/db/schema"),
    "and holds no table — the authority keeps its own handle",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. WORK-2 ADDED NO AUTHORITY OF ANY KIND.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.deepEqual(
    [...AGENT_ORIGINABLE_ACTION_KINDS],
    ["send"],
    "no action kind was added — Heby may not propose a work mutation",
  );
  assert.deepEqual(
    [...GOVERNANCE_SUBJECT_TYPES],
    ["knowledge_node"],
    "no Governance subject type was added",
  );
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesGovernanceDecision, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesActionAuthorization, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesExecutionAttempt, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.agentAccountablePossible, false);
  assert.deepEqual(
    ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesTables,
    ["work_items"],
    "the authority still writes exactly one table",
  );

  /* NO SCHEMA, NO MIGRATION. WORK-2 is a read. */
  const journal = JSON.parse(read(JOURNAL)) as { entries: readonly unknown[] };
  assert.equal(journal.entries.length, 42, "WORK-2 authored no migration — a grounding read needs none");
  const sql = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  assert.equal(sql.length, 42, "and the ledger is unchanged by this phase");

  /* ═════════════════════════════════════════════════════════════════════════
   * 5. THE CLASS IS TENANT-SCOPED, AND CROSS-TENANT IS UNREPRESENTABLE.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.ok(
    !/tenantId\s*[:=]\s*["'`]/.test(groundingCode),
    "the projection never names a tenant id literal",
  );
  const noTenant = await readWorkGroundingSource(null);
  assert.equal(noTenant.state, "unavailable", "no tenant, no read");
  assert.equal(noTenant.items.length, 0);

  /* ═════════════════════════════════════════════════════════════════════════
   * 6. WORK ITEM != WORK ARTIFACT — two classes, and they stay two.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.ok(HEBY_SOURCE_CLASSES.includes("work"));
  assert.ok(HEBY_SOURCE_CLASSES.includes("work-artifacts"));
  assert.notEqual(
    HEBY_SOURCE_CLASSES.indexOf("work"),
    HEBY_SOURCE_CLASSES.indexOf("work-artifacts"),
    "they are distinct classes and were never merged",
  );
  assert.ok(
    !groundingCode.includes("work-artifacts") && !groundingCode.includes("workArtifacts"),
    "the work projection reaches no artifact — a commitment is not a draft",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 7. NO OTHER FEATURE LEARNED ABOUT WORK GROUNDING.
   * ═══════════════════════════════════════════════════════════════════════ */
  const consumers = [...walk("src/features"), ...walk("src/app"), ...walk("src/components")]
    .filter((f) => f !== GROUNDING)
    .filter((f) => withoutComments(read(f)).includes("heby-work-source"));
  assert.deepEqual(
    consumers,
    [MODEL_ANSWER],
    "exactly one consumer imports the work projection: the answer path, and nothing else",
  );

  console.log("PASS work2-heby-work-grounding/reachability-and-firewall");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
