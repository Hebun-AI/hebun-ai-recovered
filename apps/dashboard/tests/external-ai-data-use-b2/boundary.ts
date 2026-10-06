/*
 * EXTERNAL-AI-DATA-USE-B2 — where the boundary sits, and what the Heby answer path declares.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Exactly one file in src reaches the Anthropic host, and the transport it builds carries the
 *    egress mark the generator gates on. Every runtime caller of the generator declares its
 *    disclosure, origination as its own purpose. Driving the REAL answer flow over the REAL live
 *    transport, Heby declares assistance and only the classes the model actually sees; a refusal
 *    leaves fetch uncalled and the human with the deterministic answer; and grounding outside the
 *    three classes is withheld from the model while the human-facing evidence keeps it."
 *
 * The gate itself is stood in here (it is proven against a real database in egress-postgres.ts):
 * this file is about the declaration and the seam. No database, no provider, no credential.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import type { ExternalAiDisclosureDeclaration } from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import type { DisclosureDecision } from "../../src/features/external-ai-data-use/compose-external-ai-disclosure";
import type { SourceResolution } from "../../src/features/heby-runtime";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    if (name === "node_modules") return [];
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });
}
const SRC = walk("src");

/* ── 1. ONE FILE REACHES ANTHROPIC, AND ITS TRANSPORT IS MARKED. ──────────────────────────────── */
const TRANSPORT = "src/features/heby-model-live/claude-http-transport.server.ts";
assert.deepEqual(
  SRC.filter((f) => /api\.anthropic\.com/.test(codeOf(read(f)))),
  [TRANSPORT],
  "the live transport is the only code that names the Anthropic host",
);
assert.match(codeOf(read(TRANSPORT)), /\[ANTHROPIC_MESSAGES_EGRESS\]: true,\s*async send\(/, "the transport it builds carries the egress mark");

/* ── 2. THE GENERATOR GATES BEFORE IT BUILDS THE CLIENT. ──────────────────────────────────────── */
const GENERATOR = codeOf(read("src/features/heby-model/heby-model-generation.server.ts"));
const gateAt = GENERATOR.indexOf("if (isAnthropicMessagesEgress(deps.transport))");
assert.ok(gateAt > 0 && gateAt < GENERATOR.indexOf("createClaudeModelClient({"), "the gate runs before the client exists");
/* APF-5: a refusal is recorded best-effort and still refused; an authorized decision must be recorded before the client exists. */
assert.match(GENERATOR, /if \(decision\?\.disposition !== "authorized" \|\| !evidence\) \{\s*if \(evidence\) await record\(evidence\)\.catch\(\(\) => false\);\s*return unavailable\("DATA_USE_NOT_AUTHORIZED"\);/);
assert.match(GENERATOR, /if \(!\(await record\(evidence\)\.catch\(\(\) => false\)\)\) \{\s*return unavailable\("DATA_USE_NOT_AUTHORIZED"\);/);

/* ── 3. EVERY RUNTIME CALLER DECLARES; ORIGINATION IS ITS OWN PURPOSE. ────────────────────────── */
const callers = SRC.filter((f) => /\(deps\.generate \?\? generateHebyModelAnswer\)|generate: deps\.generate \?\? generateHebyModelAnswer/.test(read(f))).sort();
assert.deepEqual(callers, ["src/features/agent-origination/originate-action.server.ts", "src/features/heby-answer/model-answer.server.ts"]);
const origination = codeOf(read("src/features/agent-origination/originate-action.server.ts"));
assert.match(origination, /disclosure: \{\s*tenantId: tenant\.tenantId,\s*actorUserId: tenant\.userId,\s*purpose: "agent-origination",/, "origination declares agent-origination, never assistance");
assert.match(codeOf(read("src/features/heby-answer/model-answer.server.ts")), /purpose: "assistance",/);
assert.match(
  codeOf(read("src/features/work-artifacts/prepare-work-artifact.server.ts")),
  /preparationBriefDataClasses: input\.observationSupplement \? \["work-artifact", "provider-observation"\] : \["work-artifact"\]/,
  "a preparation carrying a platform observation declares it",
);
/* The relevance judge sends through a transport directly; it must stay unwired until it routes here. */
assert.deepEqual(
  SRC.filter((f) => !f.startsWith("src/features/relevance-judge/") && !f.startsWith("src/features/knowledge-retrieval/") && /relevance-judge/.test(codeOf(read(f)))),
  [],
  "the relevance judge is not reachable from runtime",
);

/* ── 4. THE REAL ANSWER FLOW, OVER THE REAL LIVE TRANSPORT. ───────────────────────────────────── */
const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as unknown as TenantContext;
const ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test-model",
  HEBUN_MODEL_CREDENTIAL: "sk-fake",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
};
const OK = { id: "msg_b2", model: "claude-test-model", content: [{ type: "text", text: "Answer." }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } };
const decision = (disposition: DisclosureDecision["disposition"]): DisclosureDecision => ({
  disposition,
  authorizationId: disposition === "authorized" ? "a" : null,
  attestationId: disposition === "authorized" ? "b" : null,
  authorizationRevision: disposition === "authorized" ? 1 : null,
  attestationRevision: disposition === "authorized" ? 1 : null,
  authorizedDataClasses: [],
  components: { platform: "allowed", attestation: "active", tenant: "active", change: null, operator: "enabled", provider: "available" },
});
const resolved = (sourceClass: string, label: string): SourceResolution =>
  ({ sourceClass, state: "resolved", provenance: `${sourceClass} authority`, items: [{ recordRef: `${sourceClass}/x`, label, detail: `${label} detail`, lifecycle: "settled" }] }) as unknown as SourceResolution;

async function run(
  disposition: DisclosureDecision["disposition"],
  options: Parameters<typeof answerHebyModelRequest>[2] = {},
): Promise<{ fetched: number; declared: ExternalAiDisclosureDeclaration | null | undefined; prompt: string; response: string; evidence: unknown[] }> {
  let fetched = 0;
  let body = "";
  const fetchImpl: FetchLike = async (_url, init) => {
    fetched += 1;
    body = String(init.body);
    return { ok: true, status: 200, json: async () => OK };
  };
  let declared: ExternalAiDisclosureDeclaration | null | undefined;
  const evidence: unknown[] = [];
  const result = await answerHebyModelRequest(
    { prompt: "Who works where, and what do we know about refunds?", route: "/heby" },
    {
      resolveTenant: async () => TENANT,
      readOverview: () => undefined,
      getConversationRepo: () => null,
      resolveDirectorEnabled: async () => true,
      env: ENV,
      selectTransport: () => ({
        transport: createLiveClaudeTransport({ apiKey: "sk-fake", spendBudget: createLiveSpendBudget(9), fetchImpl }),
        transportProvenance: "live",
      }),
      resolvePeople: async () => resolved("people", "Ayşe Yılmaz"),
      resolveOrganization: async () => resolved("organization", "Acme Rugs"),
      generate: (request, deps) =>
        generateHebyModelAnswer(request, {
          ...deps,
          resolveOperatorEnabled: async () => true,
          authorizeDisclosure: async (d) => {
            declared = d;
            return decision(disposition);
          },
          recordDisclosure: async (e) => {
            evidence.push(e);
            return true;
          },
        }),
    },
    options,
  );
  return { fetched, declared, prompt: body, response: JSON.stringify(result), evidence };
}

async function main(): Promise<void> {
  /* Authorized: assistance, conversation + only what the model sees; people and organization withheld. */
  {
    const r = await run("authorized");
    assert.equal(r.fetched, 1, "an authorized answer reaches the network seam once");
    assert.equal(r.declared?.tenantId, TENANT.tenantId, "the tenant is the authenticated one");
    assert.equal(r.declared?.purpose, "assistance");
    assert.ok(r.declared!.dataClasses.includes("conversation"));
    for (const c of r.declared!.dataClasses) assert.ok(["conversation", "knowledge", "work-artifact"].includes(c), `declared ${c}`);
    assert.match(r.prompt, /\[people\] withheld — not disclosed to the external model/);
    assert.match(r.prompt, /\[organization\] withheld — not disclosed to the external model/);
    assert.ok(!/Ayşe Yılmaz|Acme Rugs/.test(r.prompt), "nothing withheld reaches the wire");
    assert.match(r.response, /Ayşe Yılmaz/, "the human-facing evidence still carries it");
    /* APF-5 — one evidence record; it names the decision, never the content. */
    assert.equal(r.evidence.length, 1, "exactly one decision record");
    const recorded = JSON.stringify(r.evidence[0]);
    for (const leak of ["Ayşe", "Acme", "refunds", "Who works where", "sk-fake", "withheld"]) {
      assert.ok(!recorded.includes(leak), `the decision record carries no ${leak}`);
    }
  }

  /* Every refusal: no fetch, the human gets the deterministic answer and is told why. */
  for (const disposition of [
    "tenant-not-authorized",
    "tenant-withdrawn",
    "platform-denied",
    "platform-unknown",
    "authorization-stale",
    "operator-paused",
    "unavailable",
  ] as const) {
    const r = await run(disposition);
    assert.equal(r.fetched, 0, `${disposition}: refused before the network seam`);
    assert.match(r.response, /DATA_USE_NOT_AUTHORIZED/, `${disposition}: the deterministic answer says why`);
    assert.match(r.response, /Ayşe Yılmaz/, `${disposition}: the human still gets the deterministic answer`);
  }

  /* A preparation brief that did not declare its classes is undeclared — the gate sees null. */
  {
    const r = await run("authorized", { intent: "PREPARE_RECOMMENDATION", preparationBrief: "Write the draft." });
    assert.equal(r.declared, null, "an undeclared brief reaches the gate as no declaration");
    const real = await generateHebyModelAnswer(
      { correlationId: "c", tenantId: TENANT.tenantId, systemInstructions: "s", userPrompt: "p", evidence: [], modelId: "", maxOutputTokens: 0 },
      {
        env: ENV,
        transport: createLiveClaudeTransport({
          apiKey: "sk-fake",
          spendBudget: createLiveSpendBudget(9),
          fetchImpl: async () => {
            throw new Error("must not be called");
          },
        }),
        resolveOperatorEnabled: async () => true,
      },
    );
    assert.deepEqual(
      real.status === "unavailable" ? real.state : real.status,
      "DATA_USE_NOT_AUTHORIZED",
      "with the REAL gate, no declaration is refused before fetch",
    );
  }

  console.log("PASS external-ai-data-use-b2 boundary");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
