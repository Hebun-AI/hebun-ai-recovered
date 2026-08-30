/*
 * E2-8 — DECLARED KNOWLEDGE-AREA COVERAGE GROUNDING.
 *
 * What this proves: Heby can ground an answer in WHICH declared knowledge areas this organization
 * holds facts in force in — including the areas it holds nothing in — and cannot, through this
 * class, say that the evidence is correct, approved, sufficient, or that a missing area is
 * something the organization lacks.
 *
 *     A RETRIEVAL RESULT != AN INVENTORY     COVERAGE != CORRECTNESS
 *     COVERAGE != RATIFICATION               COVERAGE != UNDERSTANDING
 *     MISSING  != THE ORGANIZATION LACKS IT  UNAVAILABLE != NOTHING IS COVERED
 *
 * No database, no network, no model. Every seam is injected.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  readKnowledgeCoverageGroundingSource,
  KNOWLEDGE_COVERAGE_GROUNDING_PROVENANCE,
  KNOWLEDGE_COVERAGE_NON_CLAIMS,
  KNOWLEDGE_COVERAGE_SUMMARY_REFUSAL,
  KNOWLEDGE_COVERAGE_MISSING_STATEMENT,
} from "../../src/features/knowledge/heby-knowledge-coverage-source.server";
import type { CompanyUnderstandingResult } from "../../src/features/knowledge/company-understanding-read.server";
import { projectCompanyUnderstanding } from "../../src/features/knowledge/company-understanding";
import { listCompanyUnderstandingCategories } from "../../src/features/knowledge/company-understanding-taxonomy";
import type { KnowledgeDomainCounts } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration";
import { resolveHebyWorkspaceContext } from "../../src/features/heby-integration/workspace-registry";
import { resolveSource } from "../../src/features/heby-runtime/source-resolver";
import { assembleEvidence } from "../../src/features/heby-runtime/evidence-assembler";
import { buildResponse } from "../../src/features/heby-runtime/response-builder";
import { validateResponse } from "../../src/features/heby-runtime/response-validator";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import type { SourceResolution } from "../../src/features/heby-runtime";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const SOURCE_PATH = "src/features/knowledge/heby-knowledge-coverage-source.server.ts";

const TENANT = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
} as unknown as TenantContext;

const NOW = new Date("2026-08-30T09:00:00.000Z");

function counts(rows: ReadonlyArray<Partial<KnowledgeDomainCounts> & { domainKey: string }>): KnowledgeDomainCounts[] {
  return rows.map((row) => ({
    domainKey: row.domainKey,
    inForce: row.inForce ?? 0,
    ratified: row.ratified ?? 0,
    provisional: row.provisional ?? 0,
    reviewOverdue: row.reviewOverdue ?? 0,
    expired: row.expired ?? 0,
    notYetEffective: row.notYetEffective ?? 0,
    withdrawn: row.withdrawn ?? 0,
    unreadable: row.unreadable ?? 0,
  }));
}

function readOf(rows: KnowledgeDomainCounts[]): CompanyUnderstandingResult {
  return { status: "read", view: projectCompanyUnderstanding(rows, NOW) };
}

const groundOn = (result: CompanyUnderstandingResult): Promise<SourceResolution> =>
  readKnowledgeCoverageGroundingSource(TENANT, { readCoverage: async () => result });

/** One covered area, one uncategorized key, and every other declared area empty. */
const DEFAULT = readOf(
  counts([
    { domainKey: "identity", inForce: 4, ratified: 1, provisional: 3, reviewOverdue: 2, expired: 1 },
    { domainKey: "not-a-declared-area", inForce: 2, withdrawn: 1 },
  ]),
);

async function main(): Promise<void> {
  const TAXONOMY_SIZE = listCompanyUnderstandingCategories().length;

  /* ── 1 · THE CLASS EXISTS AND EXACTLY ONE WORKSPACE DECLARES IT ──────────── */
  {
    assert.ok(HEBY_SOURCE_CLASSES.includes("knowledge-coverage"));
    assert.ok(
      resolveHebyWorkspaceContext({ workspace: "knowledge" }).sources.some(
        (s) => s.sourceClass === "knowledge-coverage",
      ),
      "Knowledge must declare the class",
    );
    for (const workspace of ["command", "governance", "intelligence", "operations", "decisions"] as const) {
      assert.ok(
        !resolveHebyWorkspaceContext({ workspace }).sources.some(
          (s) => s.sourceClass === "knowledge-coverage",
        ),
        `${workspace} must NOT declare a knowledge inventory`,
      );
    }
  }

  /* ── 2 · THE PURE RESOLVER REPORTS A SERVER READ, NEVER AN EMPTY ORGANIZATION ── */
  {
    const pure = resolveSource("knowledge-coverage");
    assert.equal(pure.sourceClass, "knowledge-coverage");
    assert.notEqual(pure.state, "resolved");
    assert.equal(pure.items.length, 0);
    assert.match(pure.unavailableReason ?? "", /tenant-scoped on the server/i);
    /* UNAVAILABLE != NOTHING IS COVERED. */
    assert.ok(!/no coverage|nothing is covered|holds no knowledge/i.test(pure.unavailableReason ?? ""));
  }

  /* ── 3 · EVERY DECLARED AREA IS REPORTED, INCLUDING THE EMPTY ONES ───────── */
  {
    const resolution = await groundOn(DEFAULT);
    assert.equal(resolution.state, "resolved");
    assert.equal(resolution.sourceClass, "knowledge-coverage");
    assert.equal(resolution.authoritative, false, "DERIVED, never authoritative");

    const areaItems = resolution.items.filter((i) => i.recordRef.startsWith("area:"));
    assert.equal(
      areaItems.length,
      TAXONOMY_SIZE,
      "every declared area appears, whether or not anything was found in it",
    );

    /* The absence is the point: an empty area must be present AND say what empty means. */
    const empty = areaItems.filter((i) => i.detail.includes(KNOWLEDGE_COVERAGE_MISSING_STATEMENT));
    assert.equal(empty.length, TAXONOMY_SIZE - 1, "nine declared areas hold nothing here");
    for (const item of empty) {
      assert.match(item.detail, /not a claim that the organization lacks it/i);
    }
  }

  /* ── 4 · MISSING AREAS ARE NOT SORTED OUT OF SIGHT ───────────────────────── */
  {
    const resolution = await groundOn(DEFAULT);
    const areaKeys = resolution.items
      .filter((i) => i.recordRef.startsWith("area:"))
      .map((i) => i.recordRef.slice("area:".length));
    assert.deepEqual(
      areaKeys,
      listCompanyUnderstandingCategories().map((c) => c.key),
      "taxonomy order is preserved — empty areas are not pushed to the end",
    );
  }

  /* ── 5 · AN AREA KEY THE TAXONOMY DOES NOT CLAIM IS REPORTED, NEVER DROPPED ── */
  {
    const resolution = await groundOn(DEFAULT);
    const stray = resolution.items.find((i) => i.recordRef === "domain:not-a-declared-area");
    assert.ok(stray, "an unclaimed area key must be surfaced");
    assert.match(stray.detail, /2 facts in force and 1 not in force/);
    /* The raw operator-authored key travels in `content`, never in Heby's own prose. */
    assert.equal(stray.content, "area key: not-a-declared-area");
    assert.ok(
      !stray.label.includes("not-a-declared-area"),
      "the raw key must not reach the label, which flows into validated prose",
    );
  }

  /* ── 6 · THE SUMMARY STATES COMPLETENESS AND REFUSES THE JUDGEMENT ───────── */
  {
    const resolution = await groundOn(DEFAULT);
    const summary = resolution.items[0];
    assert.equal(summary.recordRef, "coverage:summary", "the summary leads");
    assert.match(summary.detail, new RegExp(`1 of ${TAXONOMY_SIZE} declared areas covered`));
    assert.match(summary.detail, new RegExp(`${TAXONOMY_SIZE - 1} areas with nothing in force`));
    assert.match(summary.detail, /4 facts in force inside the taxonomy/);
    assert.match(summary.detail, /2 facts in force under 1 area key the taxonomy does not claim/);
    assert.match(summary.detail, /no bound, so this is the complete set of areas rather than a page/i);
    assert.ok(summary.detail.includes(KNOWLEDGE_COVERAGE_SUMMARY_REFUSAL));
  }

  /* ── 7 · COVERAGE KEEPS ITS QUALITIES BESIDE IT, NEVER FOLDED IN ─────────── */
  {
    const resolution = await groundOn(DEFAULT);
    const identity = resolution.items.find((i) => i.recordRef === "area:identity");
    assert.ok(identity);
    assert.match(identity.detail, /4 facts in force/);
    assert.match(identity.detail, /1 carrying a bound Governance decision/);
    assert.match(identity.detail, /3 not marked authoritative/);
    /* A declared review date having passed is a fact about a date, never a verdict on content. */
    assert.match(identity.detail, /2 past its declared review date/);
    assert.ok(!/out of date|outdated|stale|obsolete/i.test(identity.detail));
    /* What is excluded from coverage is named as excluded. */
    assert.match(identity.detail, /not counted as coverage: 1 past its effective window/);
  }

  /* ── 8 · AN AREA COVERED ONLY BY UNAPPROVED DRAFTS IS STILL COVERED ──────── */
  {
    const resolution = await groundOn(
      readOf(counts([{ domainKey: "policies", inForce: 3, provisional: 3 }])),
    );
    const policies = resolution.items.find((i) => i.recordRef === "area:policies");
    assert.ok(policies);
    assert.ok(
      !policies.detail.includes(KNOWLEDGE_COVERAGE_MISSING_STATEMENT),
      "COVERAGE != RATIFICATION — unapproved drafts still establish coverage",
    );
    assert.match(policies.detail, /3 not marked authoritative/);
  }

  /* ── 9 · A TENANT HOLDING NOTHING IS REPORTED HONESTLY, NEVER FLATTERED ──── */
  {
    const resolution = await groundOn(readOf(counts([])));
    const areaItems = resolution.items.filter((i) => i.recordRef.startsWith("area:"));
    assert.equal(areaItems.length, TAXONOMY_SIZE);
    assert.equal(
      areaItems.every((i) => i.detail.includes(KNOWLEDGE_COVERAGE_MISSING_STATEMENT)),
      true,
      "every declared area reports its real, empty state",
    );
    assert.match(resolution.items[0].detail, new RegExp(`0 of ${TAXONOMY_SIZE} declared areas covered`));
  }

  /* ── 10 · UNAVAILABLE IS UNAVAILABLE, NEVER ZERO COVERAGE ────────────────── */
  {
    for (const reason of ["no-authorized-tenant-context", "persistence-not-configured", "read-failed"] as const) {
      const resolution = await groundOn({ status: "unavailable", reason, detail: "x" });
      assert.equal(resolution.state, "unavailable");
      assert.equal(resolution.items.length, 0, "no fabricated area, and no fabricated zero");
      assert.equal(resolution.unavailableReason, reason);
      assert.equal(resolution.authoritative, false);
    }
  }

  /* ── 11 · THE REFUSAL IS PINNED BY EQUALITY; THE CLAIMS CARRY NO JUDGEMENT ─ */
  {
    const resolution = await groundOn(DEFAULT);
    assert.equal(resolution.provenance, KNOWLEDGE_COVERAGE_GROUNDING_PROVENANCE);
    assert.ok(
      resolution.items[0].detail.includes(KNOWLEDGE_COVERAGE_SUMMARY_REFUSAL),
      "the named refusal must be present verbatim",
    );

    /*
     * FIFTH PROSE-GUARD COLLISION, AVOIDED BY CONSTRUCTION. The provenance and the refusal NAME the
     * judgements they forbid, so a vocabulary ban run over them would always fail. Pin those two by
     * equality (above) and scan only what the source CLAIMS — the settled E2-4/E2-5/E2-6/E2-7
     * remedy, applied here from the start rather than after a red suite.
     */
    const claimed = resolution.items
      .map((item) => `${item.label} ${item.detail}`)
      .join(" ")
      .split(KNOWLEDGE_COVERAGE_SUMMARY_REFUSAL)
      .join(" ")
      .split(KNOWLEDGE_COVERAGE_MISSING_STATEMENT)
      .join(" ");

    for (const banned of [
      "score", "percent", "confidence", "health", "readiness", "priority", "ranking",
      "well documented", "poorly documented", "sufficient", "insufficient", "incomplete",
      "gap", "risk", "mature", "weak", "strong", "should", "recommend", "needs",
      "better", "worse", "improve", "trend",
    ]) {
      assert.ok(
        !claimed.toLowerCase().includes(banned),
        `the source's own claims must not contain "${banned}"`,
      );
    }
    assert.equal(KNOWLEDGE_COVERAGE_NON_CLAIMS.length, 4);
  }

  /* ── 12 · THE SHAPE CANNOT EXPRESS A JUDGEMENT ───────────────────────────── */
  {
    const view = projectCompanyUnderstanding(counts([{ domainKey: "identity", inForce: 1 }]), NOW);
    assert.deepEqual(
      Object.keys(view).sort(),
      ["categories", "generatedAt", "truncated", "uncategorized"],
      "the released view carries no score, percentage, confidence or health field",
    );
    assert.equal(view.truncated, false, "complete by construction, never a page of itself");
    assert.deepEqual(
      Object.keys(view.categories[0]).sort(),
      [
        "describes", "expiredCount", "key", "label", "matchedDomainKeys", "notYetEffectiveCount",
        "provisionalCount", "ratifiedCount", "recordCount", "staleCount", "state", "withdrawnCount",
      ],
      "a category carries counts and a two-valued state, and nothing that could hold a verdict",
    );
    assert.deepEqual([...new Set(view.categories.map((c) => c.state))].sort(), ["covered", "missing"]);
  }

  /* ── 13 · IT IS A SHAPER, NOT AN AUTHORITY: NO WRITER IS REACHABLE ───────── */
  {
    const source = read(SOURCE_PATH);
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    for (const banned of [
      "insert(", "update(", "delete(", "transaction(", "db.", "drizzle",
      "durable-knowledge-writer", "knowledge-create", "knowledge-ingest", "retract-source",
      "knowledge-supersede", "knowledge-write-authority",
    ]) {
      assert.ok(!code.includes(banned), `the shaper must not reach ${banned}`);
    }

    /* It re-derives nothing: it never imports the taxonomy or the projection, only the read seam. */
    assert.ok(!code.includes("projectCompanyUnderstanding"), "it must not recompute the projection");
    assert.ok(!code.includes("company-understanding-taxonomy"), "it must not re-apply the taxonomy");
    assert.ok(code.includes("company-understanding-read.server"), "it reads through the released seam");
  }

  /* ── 14 · THE READ SEAM IS FAIL-CLOSED AND TENANT-SCOPED, WITH NO WIDER FORM ── */
  {
    const seam = read("src/features/knowledge/company-understanding-read.server.ts");
    const code = seam.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.ok(code.includes("tenantId: tenant.tenantId"), "the tenant predicate comes from context");
    assert.ok(!/allTenants|acrossTenants|tenantId\?\s*:/.test(code), "no cross-tenant form exists");

    /* No tenant → refused before anything is read. Unrepresentable, not merely refused. */
    const refused = await readKnowledgeCoverageGroundingSource(null, {
      readCoverage: async (t) => {
        assert.equal(t, null, "the null context reaches the seam unchanged");
        return { status: "unavailable", reason: "no-authorized-tenant-context", detail: "x" };
      },
    });
    assert.equal(refused.state, "unavailable");
    assert.equal(refused.unavailableReason, "no-authorized-tenant-context");
  }

  /* ── 15 · IT REACHES THE RELEASED HEBY ANSWER PATH AND SURVIVES VALIDATION ─ */
  {
    const resolution = await groundOn(DEFAULT);
    const assembled = assembleEvidence([resolution]);
    assert.ok(
      assembled.some((e) => e.sourceClass === "knowledge-coverage" && e.recordRef === "coverage:summary"),
      "the summary is assembled as evidence",
    );

    const response = buildResponse(
      "INVESTIGATE",
      { workspace: "knowledge", route: "/knowledge", overview: undefined },
      [resolution],
    );
    const validation = validateResponse(response, assembled, response.authority);
    assert.equal(validation.valid, true, validation.issues.join(" | "));
  }

  /* ── 16 · THE ANSWER FLOW SUBSTITUTES THE REAL READ AND REMOVES NO EVIDENCE ── */
  {
    let called = 0;
    const result = await answerHebyModelRequest(
      { prompt: "Which declared areas do we hold knowledge in, and which hold nothing?", route: "/knowledge" },
      {
        resolveTenant: async () => TENANT,
        resolveDirectorEnabled: async () => false,
        getConversationRepo: () => null,
        resolveKnowledgeCoverage: async () => {
          called += 1;
          return groundOn(DEFAULT);
        },
      },
    );
    assert.equal(called, 1, "the Knowledge workspace consults the coverage seam exactly once");
    assert.equal(result.status, "answered");
    const evidence = result.outcome.response.evidence;
    assert.ok(
      evidence.some((e) => e.sourceClass === "knowledge-coverage" && e.recordRef === "coverage:summary"),
      "coverage evidence reaches the released answer",
    );
    /*
     * E2-4's rule, proved by COMPARISON rather than by naming a sibling class. Asserting that some
     * other class is present would have been a test of whether a database happened to be reachable,
     * not of whether this class removed anything: with no persistence the Knowledge retrieval
     * legitimately contributes nothing, and the assertion would fail for a reason that has nothing
     * to do with E2-8. So the baseline is the SAME request with the coverage resolution suppressed,
     * and the only admissible difference is what this class added.
     */
    const baseline = await answerHebyModelRequest(
      { prompt: "Which declared areas do we hold knowledge in, and which hold nothing?", route: "/knowledge" },
      {
        resolveTenant: async () => TENANT,
        resolveDirectorEnabled: async () => false,
        getConversationRepo: () => null,
        resolveKnowledgeCoverage: async () => resolveSource("knowledge-coverage"),
      },
    );
    assert.equal(baseline.status, "answered");
    const before = new Set(
      baseline.outcome.response.evidence.map((e) => `${e.sourceClass}/${e.recordRef}`),
    );
    const after = new Set(evidence.map((e) => `${e.sourceClass}/${e.recordRef}`));
    for (const ref of before) {
      assert.ok(after.has(ref), `adding the class removed existing evidence: ${ref}`);
    }
    assert.ok(after.size > before.size, "and it added its own");
  }

  /* ── 17 · A READ FAILURE DEGRADES, IT DOES NOT EMPTY THE ORGANIZATION ────── */
  {
    const result = await answerHebyModelRequest(
      { prompt: "What do we know?", route: "/knowledge" },
      {
        resolveTenant: async () => TENANT,
        resolveDirectorEnabled: async () => false,
        getConversationRepo: () => null,
        resolveKnowledgeCoverage: async () => {
          throw new Error("boom");
        },
      },
    );
    assert.equal(result.status, "answered");
    const body = result.outcome.response.body.join(" ");
    assert.ok(
      !/holds no knowledge|no declared areas|nothing is covered/i.test(body),
      "a thrown read must never read as an organization that knows nothing",
    );
    assert.ok(
      !result.outcome.response.evidence.some((e) => e.recordRef.startsWith("area:")),
      "and it must never fabricate an area",
    );
  }

  /* ── 18 · COMMAND DOES NOT GAIN AN INVENTORY, EVEN THOUGH THE DEP EXISTS ─── */
  {
    let called = 0;
    await answerHebyModelRequest(
      { prompt: "What requires my attention?", route: "/command" },
      {
        resolveTenant: async () => TENANT,
        resolveDirectorEnabled: async () => false,
        getConversationRepo: () => null,
        resolveKnowledgeCoverage: async () => {
          called += 1;
          return groundOn(DEFAULT);
        },
      },
    );
    assert.equal(called, 0, "a workspace that does not declare the class never consults it");
  }

  console.log("e28-knowledge-coverage-grounding: OK");
}

void main();
