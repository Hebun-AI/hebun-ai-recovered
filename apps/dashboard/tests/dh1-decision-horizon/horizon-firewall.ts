/*
 * DH-1 — THE HORIZON COMPOSES AND NEVER ACQUIRES.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The decision horizon travels three released authorities -> read model -> projection -> the
 *    `decision-records` class -> the model request, AND onto `/approvals`. And it took nothing with
 *    it: no schema, no migration, no table, no writer, no decision authority, no second source of
 *    truth, no new source class, no control on the surface, and no clock."
 *
 * A READ MODEL THAT CAN WRITE IS AN AUTHORITY.
 * A CLASS THAT CITES THREE OWNERS MUST NAME ALL THREE.
 * A SURFACE THAT OFFERS A CONTROL HAS TAKEN OWNERSHIP.
 *
 * Structural assertions run over COMMENT-STRIPPED source.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { codeOf } from "../helpers/durable-write-detector";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import { readDecisionHorizonGroundingSource } from "../../src/features/decision-horizon/heby-decision-horizon-source.server";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import { DECISION_SOURCE_KEYS } from "../../src/features/decision-horizon/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string => codeOf(s);

const FEATURE = "src/features/decision-horizon";
const CONTRACTS = `${FEATURE}/contracts.ts`;
const MODEL = `${FEATURE}/read-decision-horizon.server.ts`;
const PROJECTION = `${FEATURE}/heby-decision-horizon-source.server.ts`;
const QUEUE = "src/features/action-authorization/heby-decision-queue-source.server.ts";
const ANSWER = "src/features/heby-answer/model-answer.server.ts";
const PAGE = "src/app/(dashboard)/approvals/page.tsx";
const PANEL = "src/components/decision-workspace/decision-horizon-panel.tsx";
const JOURNAL = "src/db/migrations/meta/_journal.json";

const TENANT = { tenantId: "t-1", userId: "u-1" } as unknown as TenantContext;

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
    if (named && !/(^|,)\s*(?!type\s)[A-Za-z_$]/.test(named[1]!) && !/^[^{]*[A-Za-z_$]/.test(clause)) continue;
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
function graphFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
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
   * 1. END TO END — ALL THREE OWNERS REACH THE MODEL REQUEST.
   * ═══════════════════════════════════════════════════════════════════════ */
  let captured: ModelGenerationRequest | undefined;
  await answerHebyModelRequest(
    { prompt: "What needs my decision?", route: "/heby" },
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
      resolveDecisionQueue: async (tenant) =>
        readDecisionHorizonGroundingSource(tenant, {
          readQueue: async () =>
            ({
              sourceClass: "decision-records", state: "resolved", provenance: "p", authoritative: true,
              items: [{ recordRef: "heby-action-request/r-1", label: "send — awaiting a human decision", detail: "an irreversible external act", lifecycle: "settled" }],
            }) as never,
          readHorizon: async () =>
            ({
              status: "read", completeness: "complete", unavailableSources: [], answeredTotal: 1,
              blocks: [
                { source: "improvement-hypotheses", status: "answered", total: 1, truncated: false, items: [{ source: "improvement-hypotheses", recordId: "h-1", label: "Scout — Reduce refusals", recordedAt: "2026-09-01T09:30:00Z" }] },
                { source: "knowledge-review", status: "answered", total: 1, truncated: false, items: [{ source: "knowledge-review", recordId: "n-1", label: "Current Knowledge version with no recorded Governance decision", recordedAt: null }] },
              ],
            }) as never,
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
  /*
   * EXTERNAL-AI-DATA-USE-B2 changed what this pinned, on purpose. The decision-records class is not a
   * class the platform can ALLOW for assistance, so the model-facing projection WITHHOLDS it: the model
   * sees one fixed line naming the class and nothing it says. Wiring is still proven — the line is there
   * only because the class was resolved — and the human-facing answer and evidence are unchanged.
   */
  assert.match(grounding, /^\[decision-records\] withheld — not disclosed to the external model$/m, "the decision-records class is wired, and withheld");
  assert.ok(
    !/heby-action-request\/r-1|improvement-hypotheses\/h-1|knowledge-review\/n-1|COMPOSED, NOT OWNED|DIFFERENT KINDS OF DECISION|decision-horizon:complete/.test(grounding),
    "nothing the horizon says reaches the model",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. NO WRITER, NO DECISION AUTHORITY, NO TABLE, ANYWHERE IN THE GRAPH.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const graph = graphFrom(PROJECTION);
    const writers = [...graph].filter((f) => /\/(write|decide|ratify)-[a-z-]+\.server\.ts$/.test(f));
    assert.deepEqual(writers, [], "the horizon's whole graph reaches no writer");

    for (const file of [MODEL, PROJECTION, CONTRACTS]) {
      const code = withoutComments(read(file));
      for (const banned of [
        ".insert(", ".update(", ".delete(", ".transaction(", "@/db", "getControlPlaneDb",
        "decideActionRequest", "ratifyKnowledgeVersion", "fileImprovementHypothesis",
        "pgTable", "Date.now(",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not contain "${banned}"`);
      }
    }
    /* THE CONTRACTS MODULE IS PURE AND SAYS SO BY ITS NAME. */
    assert.ok(!/\.server\.ts$/.test(CONTRACTS), "the vocabulary is deliberately not a server module");
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. IT COMPOSES RELEASED READERS — IT DOES NOT RE-DERIVE THEM.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const model = withoutComments(read(MODEL));
    for (const seam of [
      "readPendingActionRequests",
      "readImprovementHypotheses",
      "readCurrentKnowledgeVersions",
      "readDecidedKnowledgeVersions",
    ]) {
      assert.ok(model.includes(seam), `the model composes the released ${seam}`);
    }
    /* It names no table of any owner: it asks, it does not query. */
    for (const table of ["hebyActionRequests", "knowledgeNodes", "improvementHypotheses", "decisionRecords"]) {
      assert.ok(!model.includes(table), `the model names no table: ${table}`);
    }

    /* THE ACTION HALF IS THE RELEASED PROJECTION, VERBATIM AND UNBYPASSED. */
    const projection = withoutComments(read(PROJECTION));
    assert.ok(
      projection.includes("readDecisionQueueGroundingSource"),
      "the projection consumes the released queue projection rather than re-deriving action items",
    );
    assert.ok(
      !projection.includes("readPendingActionRequests"),
      "and it never reaches past it to the raw seam — that would be a second interpreter",
    );
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. NO NEW SOURCE CLASS. THE CLASS WAS ALWAYS THIS QUESTION.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    /* SUITE-RECOVERY-1 B4a: the twenty-one classes in their historical order, then exactly HEBY-MEDIA-1's `content-media` (3328a7f0) as the 22nd. None is this phase's; any other addition, removal or reordering fails. */
    assert.deepEqual([...HEBY_SOURCE_CLASSES], [
        "knowledge", "memory", "intelligence", "operations", "workforce", "governance", "platform", "decision-records", "work-artifacts", "external-recipients", "integrations", "organization", "work", "placement", "people", "agents", "agent-mandate", "recorded-acts", "recorded-act-windows", "knowledge-coverage", "provider-observations",
        "content-media",
      ], "the census is unchanged by DH-1; SOC-ACT1 later added the 21st");
    for (const forbidden of ["decision-horizon", "horizon", "decisions"]) {
      assert.ok(!(HEBY_SOURCE_CLASSES as readonly string[]).includes(forbidden), `no ${forbidden} class was added`);
    }
    const answer = withoutComments(read(ANSWER));
    assert.ok(
      answer.includes("readDecisionHorizonGroundingSource"),
      "the answer flow resolves `decision-records` through the horizon",
    );
    assert.ok(
      !answer.includes("readDecisionQueueGroundingSource"),
      "and no longer through the single-source projection — one class, one resolution",
    );
    /* THE RELEASED PROJECTION IS STILL CONSUMED — it was widened, not stranded. */
    const consumers = walk("src")
      .filter((f) => f !== QUEUE)
      .filter((f) => withoutComments(read(f)).includes("readDecisionQueueGroundingSource"));
    assert.deepEqual(consumers, [PROJECTION], "exactly one consumer of the released queue projection");
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 5. ZERO SCHEMA, ZERO MIGRATION, ZERO DECISION TABLE.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const journal = JSON.parse(read(JOURNAL)) as { entries: readonly { tag: string }[] };
    /* SUITE-RECOVERY-1 B3: the first 67 migrations, then exactly migrations 68–78, each a declared later phase — YOUTUBE-WRITE-2, SUPPLIED-MEDIA-ACCOUNT-PROVENANCE-1, KT-3, EXTERNAL-AI-DATA-USE-1A, SCI-2A, SCI-2B, AP-1, AP-4A, L-1b, D1 work-planning, WORK-UPDATE V1. None is this phase's; any other addition, removal or reordering fails. */
    const LATER_MIGRATIONS = [
      "20260928084834_youtube_write2_recipientless_kind",
      "20260929134334_supplied_media_account_provenance",
      "20261003074659_knowledge_public_use_domain",
      "20261004073713_external_ai_data_use_authority",
      "20261006111812_sci2a_knowledge_version_immutability",
      "20261006175909_sci2b_knowledge_integrity_at_insert",
      "20261007064348_ap1_agent_name_in_service_uniqueness",
      "20261007175237_ap4a_work_domain_foundation",
      "20261008143657_l1b_agent_lifecycle_domain",
      "20261013113340_eai_work_planning_purpose",
      "20261014042643_work_update_v1_mandate_scope",
      /* PLAN-FOLLOW-UP-REFERENCE-V1 — two insert-only provenance tables (request source work; Work follow-up sources). A declared later phase. */ "20261020170430_plan_follow_up_source_work",
    ];
    assert.deepEqual(journal.entries.slice(67).map((e) => e.tag), LATER_MIGRATIONS, "the ledger carries no DH-1 migration"); /* MV-6: ledger 66 -> 67 (generation-failed + provider-canceled on the invocation provider_failure CHECK, additive). */ /* MV-5: ledger 65 -> 66 (mp4-normalize-v1 derivation CHECKs on media_assets, additive). */ /* MV-4: ledger 64 -> 65 (async generation lifecycle on media_generation_invocations, additive). */ /* MV-2: ledger 63 -> 64 (media_kind + video facts on media_assets, additive). */ /* MV-0: ledger 57 -> 63 (MEDIA-5, CONTENT-COMPOSE-1, TENANT-ARM-1, PUBLISH-0 x2, MEDIA-SUPPLIED), all additive; the first 57 files still digest to cbf6c4bb4eda57cc. */ /* WEV-1 grew the ledger 44 -> 45; PBGA-1 45 -> 46; CGO-1 46 -> 47 (content-draft + destination). TRH-10 47 -> 48 (the `artifact-review` governance domain); TRH-19 48 -> 49 (`heby_action_requests.proposal_rationale`, one additive nullable column). TRH-21 49 -> 50 (`provider_observations`, one additive table recording what a provider reported, when, and through which connection). TRH-23 50 -> 51 (`standing_observation_authorizations`, one additive table plus the `standing-observation` governance domain: Governance's permission to observe one exact provider read scope, repeatedly, until a later revision withdraws it). TRH-24 51 -> 52 (`provider_observations` gains machine provenance: the human actor pair becomes nullable, `standing_authorization_id` and `invocation_id` arrive, and a CHECK admits exactly one provenance mode — schema EVOLUTION, not purely additive DDL). RUNG 2 PREREQUISITE 53 -> 54 (`tenant_machine_execution_authorizations`, one additive table plus the `machine-execution` governance domain: Governance's permission for ONE TENANT to participate in machine delivery of work a human already authorized — never the authorization of any act, which `action_permits` keeps owning). RUNG 2 54 -> 55 (`standing_mutation_authorizations`, one additive table plus the `standing-mutation` governance domain, plus a nullable `standing_authorization_id` on `action_permits` and `heby_action_requests` and the two decision-uniqueness indexes made PARTIAL on it: one Governance decision still backs at most one ORDINARY permit and approval, and a bounded standing envelope is the decision that it may back several.) */
    assert.ok(
      !walk("src/db/schema").some((f) => /horizon/i.test(path.basename(f))),
      "there is no horizon table, and no writer that could fill one",
    );
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 6. THE SURFACE SHOWS THE WHOLE SHAPE AND OFFERS NO CONTROL.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const page = withoutComments(read(PAGE));
    assert.ok(page.includes("readDecisionHorizon("), "the page performs the read on the server");
    assert.ok(page.includes("<DecisionHorizonPanel"), "and renders the panel");

    const panel = read(PANEL);
    const panelCode = withoutComments(panel);
    for (const banned of ["Action(", "action(", "useState", "onClick", "form", "readDecisionHorizon("]) {
      assert.ok(!panelCode.includes(banned), `the panel offers no control and performs no read: ${banned}`);
    }
    assert.match(panel, /never here/, "every source says where its decision is actually taken");
    assert.match(panel, /below on this page/, "and the action source points at the queue beneath it, not in a circle");
    assert.match(panel, /does not say the\s*\n?\s*source holds nothing/, "an unavailable source says what cannot be concluded");
    assert.match(panel, /HORIZON_EMPTY_STATEMENT/, "the empty sentence is the released constant, never re-worded");

    /* THE EMPTY SENTENCE IS GATED ON COMPLETENESS IN THE SURFACE TOO. */
    assert.match(
      panelCode,
      /const nothingWaiting = complete && horizon\.answeredTotal === 0/,
      "the surface may say `nothing is waiting` only when the horizon is COMPLETE and empty",
    );
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 7. THE SOURCE VOCABULARY IS CLOSED AND EVERY MEMBER HAS A READER.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const model = withoutComments(read(MODEL));
    for (const source of DECISION_SOURCE_KEYS) {
      assert.ok(model.includes(`"${source}"`), `${source} is actually read, not merely declared`);
    }
    /* SUITE-RECOVERY-1: KT-3/4/5 (c95a7e22) added `knowledge-public-use`; the set is pinned, not counted. */
    assert.deepEqual([...DECISION_SOURCE_KEYS], ["action-requests", "improvement-hypotheses", "knowledge-review", "knowledge-public-use"]);
  }

  console.log("PASS dh1-decision-horizon/horizon-firewall");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
