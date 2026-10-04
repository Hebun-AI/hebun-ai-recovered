/*
 * KNOWLEDGE TRUST PHASE 5 — public-purpose Knowledge eligibility, proven over the REAL resolver.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "For public content, Knowledge grounds only if its exact version is RATIFIED and Governance
 *    ALLOWED its public use, on top of runtime eligibility. UNKNOWN, DENIED, REVOKED, unratified,
 *    rejected, archived, retired and expired versions never reach the resolution or the evidence —
 *    not their statements, not their keys. A failed read refuses; an empty eligible universe refuses
 *    differently; a universe within the bound is supplied whole (KT-5.2). Internal retrieval is
 *    unchanged."
 *
 * The repository is a fake behind the real `searchKnowledge`; the projections are injected. No
 * database, no model, no network.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isPublicPurposeEligible, publicUseStateFromDecisionType } from "../../src/features/knowledge-public-use/contracts";
import {
  resolveKnowledgeEvidenceDetailed,
  resolvePublicKnowledgeEvidence,
  type PublicKnowledgeDeps,
} from "../../src/features/heby-answer/knowledge-evidence.server";
import type { KnowledgeSourceRecord } from "../../src/features/knowledge/contracts";
import type { DurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";

const ROOT = path.resolve(__dirname, "../..");
const codeOf = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const NOW = new Date("2026-10-04T12:00:00.000Z");
const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111" };

/* ── 1. THE RULE, on its own. ─────────────────────────────────────────────────────────────────── */
const decided = (entries: [string, "allowed" | "denied"][]) => new Map(entries);
const v = (ratified: boolean, node: string | null = "n") => ({ ratified, activeKnowledgeNodeId: node });
assert.equal(isPublicPurposeEligible(v(true), decided([["n", "allowed"]])), true, "RATIFIED + ALLOWED");
assert.equal(isPublicPurposeEligible(v(true), decided([])), false, "RATIFIED + UNKNOWN (no decision)");
assert.equal(isPublicPurposeEligible(v(true), decided([["n", "denied"]])), false, "RATIFIED + DENIED");
assert.equal(publicUseStateFromDecisionType("revoke"), "denied", "a revoke leaves DENIED");
assert.equal(isPublicPurposeEligible(v(true), decided([["n", publicUseStateFromDecisionType("revoke")!]])), false, "RATIFIED + REVOKED");
assert.equal(isPublicPurposeEligible(v(false), decided([["n", "allowed"]])), false, "ALLOWED but not RATIFIED");
assert.equal(isPublicPurposeEligible(v(true, null), decided([["n", "allowed"]])), false, "no version row");
assert.equal(isPublicPurposeEligible(v(true, "m"), decided([["n", "allowed"]])), false, "an allowance on ANOTHER version does not travel");

/* ── 2. THE RESOLVER over a corpus that holds every case. ────────────────────────────────────── */
interface Case { key: string; ratified: boolean; use?: "allowed" | "denied"; lifecycle?: string; until?: string; rejected?: boolean }
const CASES: Case[] = [
  { key: "brand-positioning", ratified: true, use: "allowed" },
  { key: "sales-markets", ratified: true, use: "allowed" },
  { key: "sourcing-sales-model", ratified: true, use: "denied" },
  { key: "current-business-objectives", ratified: true, use: "denied" },
  { key: "product-offering", ratified: true },
  { key: "allowed-unratified", ratified: false, use: "allowed" },
  { key: "allowed-rejected", ratified: true, use: "allowed", rejected: true },
  { key: "allowed-archived", ratified: true, use: "allowed", lifecycle: "archived" },
  { key: "allowed-retired", ratified: true, use: "allowed", lifecycle: "retired" },
  { key: "allowed-expired", ratified: true, use: "allowed", until: "2026-01-01T00:00:00.000Z" },
];
const ELIGIBLE = ["brand-positioning", "sales-markets"];
const node = (key: string) => `node-${key}`;
const record = (c: Case): KnowledgeSourceRecord =>
  ({
    factId: `fact-${c.key}`, factKey: c.key, domainKey: "company", scope: "organization", title: `Title ${c.key}`,
    statement: `STATEMENT-${c.key}`, lifecycleStatus: c.lifecycle ?? (c.ratified ? "ratified" : "draft"), authorityClass: null, health: null,
    ratified: c.ratified, ratifiedAt: null, ratificationDecisionId: c.ratified ? `dec-${c.key}` : null, governanceSessionId: null,
    ratifiedByActorId: null, activeKnowledgeNodeId: node(c.key), effectiveFrom: null, effectiveUntil: c.until ?? null, nextReviewAt: null,
    knowledgeVersion: 1,
  }) as unknown as KnowledgeSourceRecord;
const RECORDS = CASES.map(record);
const STATES = new Map(CASES.filter((c) => c.use).map((c) => [node(c.key), c.use!] as [string, "allowed" | "denied"]));
const REJECTED = new Set(CASES.filter((c) => c.rejected).map((c) => node(c.key)));

function deps(match: (key: string) => boolean, over: Partial<PublicKnowledgeDeps> = {}): PublicKnowledgeDeps {
  const repo = {
    listFacts: async () => ({ records: RECORDS, incomplete: [], truncated: false }),
    searchFacts: async () => ({
      rows: RECORDS.filter((r) => match(r.factKey)).map((r, i) => ({ record: r, lexicalRank: 1 / (i + 1), trigram: null })),
      incomplete: [],
      truncated: false,
      trigramAvailable: false,
    }),
    hasTrigram: async () => false,
  } as unknown as DurableKnowledgeRepository;
  return {
    getRepo: () => repo,
    now: () => NOW,
    readRejectedKnowledgeVersions: async () => ({ status: "read", rejectedNodeIds: REJECTED }),
    readPublicUse: async () => ({ status: "read", states: STATES }),
    ...over,
  };
}
const FORBIDDEN = CASES.map((c) => c.key).filter((k) => !ELIGIBLE.includes(k));

async function main(): Promise<void> {
  /* Every fact matches the question: only the two eligible ones survive, in resolution AND evidence. */
  {
    const out = await resolvePublicKnowledgeEvidence(TENANT, "anything", deps(() => true));
    assert.equal(out.status, "resolved");
    if (out.status !== "resolved") throw new Error("unreachable");
    assert.equal(out.universeCount, 2, "the public universe is exactly the ratified + allowed, in-force versions");
    assert.equal(out.evidence.status, "bounded-universe");
    const text = JSON.stringify([out.resolution, out.evidence]);
    for (const key of ELIGIBLE) assert.ok(text.includes(`STATEMENT-${key}`), `${key} grounds public content`);
    for (const key of FORBIDDEN) {
      assert.ok(!text.includes(key), `${key}: neither its statement nor its key reaches public grounding`);
    }
  }

  /*
   * Universe exists, the question matched only ineligible facts. KT-5.2 (Decision A) CHANGED this on
   * purpose: a universe within the bound is supplied whole as `bounded-universe`, so the two eligible
   * facts ground the draft whatever the question matched — and still nothing ineligible leaks in.
   * The no-match path above the bound is proven in tests/knowledge-trust-phase-5-2.
   */
  {
    const out = await resolvePublicKnowledgeEvidence(TENANT, "sourcing", deps((k) => k === "sourcing-sales-model" || k === "product-offering"));
    assert.equal(out.status, "resolved", "a relevance gap is not a refusal");
    if (out.status !== "resolved") throw new Error("unreachable");
    assert.equal(out.evidence.status, "bounded-universe", "a small universe is supplied whole, not matched");
    assert.deepEqual(out.evidence.items.map((item) => item.factKey), ELIGIBLE);
    for (const key of FORBIDDEN) assert.ok(!JSON.stringify([out.resolution, out.evidence]).includes(key), `${key}: no withheld fact leaks in`);
  }

  /* Refusals, kept apart. */
  const blocked = async (label: string, d: PublicKnowledgeDeps, reason: string) =>
    assert.deepEqual(await resolvePublicKnowledgeEvidence(TENANT, "q", d), { status: "blocked", reason }, label);
  await blocked("public-use projection unavailable", deps(() => true, { readPublicUse: async () => ({ status: "unavailable", reason: "read-failed" }) }), "public-eligibility-unavailable");
  await blocked("public-use projection throws", deps(() => true, { readPublicUse: async () => { throw new Error("x"); } }), "public-eligibility-unavailable");
  await blocked("rejection projection unavailable", deps(() => true, { readRejectedKnowledgeVersions: async () => ({ status: "unavailable", reason: "read-failed" }) }), "public-eligibility-unavailable");
  await blocked("listing capped", deps(() => true, { getRepo: () => ({ listFacts: async () => ({ records: RECORDS, incomplete: [], truncated: true }) }) as never }), "public-eligibility-unavailable");
  assert.deepEqual(await resolvePublicKnowledgeEvidence(null, "q", deps(() => true)), { status: "blocked", reason: "public-eligibility-unavailable" });
  await blocked("nothing decided: every version UNKNOWN", deps(() => true, { readPublicUse: async () => ({ status: "read", states: new Map() }) }), "no-public-eligible-knowledge");
  await blocked(
    "every allowance is on an ineligible version",
    deps(() => true, { readPublicUse: async () => ({ status: "read", states: new Map([[node("allowed-unratified"), "allowed"], [node("allowed-rejected"), "allowed"]]) }) }),
    "no-public-eligible-knowledge",
  );

  /* INTERNAL RETRIEVAL IS UNCHANGED: the same corpus still grounds internal answers on denied facts. */
  {
    const internal = await resolveKnowledgeEvidenceDetailed(TENANT, "anything", deps(() => true));
    const text = JSON.stringify(internal.resolution);
    for (const key of ["sourcing-sales-model", "current-business-objectives", "product-offering", "allowed-unratified"]) {
      assert.ok(text.includes(`STATEMENT-${key}`), `${key} still grounds an INTERNAL answer — public use is not truth`);
    }
  }

  /* ── 3. THE SEAM, in code. ──────────────────────────────────────────────────────────────────── */
  const prep = codeOf("src/features/work-artifacts/prepare-work-artifact.server.ts");
  assert.match(prep, /const publicContent = briefInput\.artifactType === CONTENT_DRAFT_TYPE;/, "public purpose is the artifact's type");
  assert.match(prep, /briefInput = \{\s*artifactType: target\.artifactType,/, "for a revision, the STORED type");
  assert.match(prep, /knowledgePurpose: "public-content" as const/);
  const answer = codeOf("src/features/heby-answer/model-answer.server.ts");
  const publicBranch = answer.indexOf('if (purpose === "public-content") {');
  assert.ok(publicBranch > 0 && publicBranch < answer.indexOf("if (deps.resolveKnowledge) {"), "the public branch runs before, and instead of, the internal resolver");
  assert.ok(answer.indexOf("if (publicKnowledgeBlocked) {") < answer.indexOf("const selection = (deps.selectTransport ?? selectModelTransport)(env);"), "a refusal is decided before any transport is selected");
  /* Clients cannot set it: no action passes answer options from its input. */
  for (const action of ["src/app/(dashboard)/heby/actions.ts", "src/app/(dashboard)/operations/actions.ts"]) {
    assert.ok(!/knowledgePurpose/.test(codeOf(action)), `${action} cannot name a knowledge purpose`);
  }

  console.log("PASS knowledge-trust-phase-5 public-purpose");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
