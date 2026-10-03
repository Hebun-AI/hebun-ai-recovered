/*
 * RELEVANCE-0 benchmark engine. Measures the CURRENT lexical retrieval against the synthetic corpus,
 * through the released `searchKnowledge` seam and the RELEVANCE-0 contract. Disposable databases only.
 *
 *   candidate generation   `searchKnowledge` at the retrieval ceiling (the shipped code, unchanged)
 *   purpose eligibility    `fixtureEligibility` below — a BENCHMARK STAND-IN for the upstream gate a
 *                          future phase owns (Knowledge + Governance); `buildRelevanceCandidateSet`
 *                          only bounds what it admits
 *   final selection        `selectRelevant` with the LEXICAL-ORDER judge: the first N candidates in
 *                          lexical rank, N = the shipped default limit — i.e. what runtime serves today
 *
 * Gold labels are compared only after eligibility, per purpose: a relevant-but-ineligible fact is not
 * a recall failure for that purpose, it is a fact that must NOT appear.
 *
 * No provider, no network, no model. The only writes are seeding a disposable database.
 */
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { DurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { searchKnowledge } from "../../src/features/knowledge/knowledge-read.server";
import { RETRIEVAL_DEFAULT_LIMIT, RETRIEVAL_MAX_LIMIT } from "../../src/features/knowledge-retrieval";
import {
  buildRelevanceCandidateSet,
  selectRelevant,
  type RelevanceJudge,
  type RelevanceOutcome,
  type RelevancePurpose,
  type RelevanceSource,
} from "../../src/features/knowledge-retrieval/relevance";
import {
  ELIGIBILITY,
  FACTS,
  OTHER_TENANT_FACTS,
  QUERIES,
  SUPERSEDED,
  type BenchFact,
  type BenchQuery,
  type QueryClass,
} from "./corpus";

export const BENCH_NOW = new Date("2026-10-03T12:00:00.000Z");
export const RECALL_KS = [1, 3, 5, 8] as const;

export interface SeededCorpus {
  readonly tenantA: string;
  readonly tenantB: string;
  /** Active node id per fact key, tenant A. */
  readonly nodeByKey: ReadonlyMap<string, string>;
  /** Every node id in tenant B. */
  readonly tenantBNodes: ReadonlySet<string>;
  /** Superseded node ids, tenant A. */
  readonly supersededNodes: ReadonlySet<string>;
  /** Node ids Governance rejected (fixture), tenant A. */
  readonly rejectedNodes: ReadonlySet<string>;
}

async function insertNode(
  client: Client,
  tenantId: string,
  fact: { domain: string; title: string; statement: string },
  version: number,
  supersedes: string | null,
): Promise<string> {
  const nodeId = randomUUID();
  await client.query(
    `insert into knowledge_nodes (id, tenant_id, type, label, statement, knowledge_lifecycle_status,
       knowledge_health, knowledge_scope, knowledge_authority, domain_key, knowledge_version,
       supersedes_knowledge_node_id)
     values ($1,$2,'knowledge-fact',$3,$4,'draft'::knowledge_lifecycle_status,'unknown'::knowledge_health,
       'company-wide','provisional'::knowledge_authority,$5,$6,$7)`,
    [nodeId, tenantId, fact.title, fact.statement, fact.domain, version, supersedes],
  );
  return nodeId;
}

async function insertFact(client: Client, tenantId: string, fact: BenchFact, nodeId: string, version: number): Promise<void> {
  await client.query(
    `insert into knowledge_facts (tenant_id, fact_key, domain_key, knowledge_scope, active_knowledge_node_id, fact_version)
     values ($1,$2,$3,'company-wide',$4,$5)`,
    [tenantId, fact.key, fact.domain, nodeId, version],
  );
}

/** Seed the corpus into a migrated, disposable database. */
export async function seedCorpus(client: Client): Promise<SeededCorpus> {
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  for (const [id, slug] of [[tenantA, "zanzibar-a"], [tenantB, "zanzibar-b"]] as const) {
    await client.query(`insert into companies (id, name, slug) values ($1,$2,$3)`, [id, `Synthetic ${slug}`, slug]);
  }

  const nodeByKey = new Map<string, string>();
  const supersededNodes = new Set<string>();
  const rejectedNodes = new Set<string>();
  for (const fact of FACTS) {
    const old = SUPERSEDED.find((version) => version.factKey === fact.key);
    let supersedes: string | null = null;
    if (old) {
      supersedes = await insertNode(client, tenantA, { domain: fact.domain, title: old.title, statement: old.statement }, 1, null);
      supersededNodes.add(supersedes);
    }
    const version = old ? 2 : 1;
    const nodeId = await insertNode(client, tenantA, fact, version, supersedes);
    await insertFact(client, tenantA, fact, nodeId, version);
    nodeByKey.set(fact.key, nodeId);
    if (ELIGIBILITY[fact.key]?.rejected) rejectedNodes.add(nodeId);
  }

  const tenantBNodes = new Set<string>();
  for (const fact of OTHER_TENANT_FACTS) {
    const nodeId = await insertNode(client, tenantB, fact, 1, null);
    await insertFact(client, tenantB, fact, nodeId, 1);
    tenantBNodes.add(nodeId);
  }
  return { tenantA, tenantB, nodeByKey, tenantBNodes, supersededNodes, rejectedNodes };
}

/** Deterministic judge: select candidates in the order given (lexical rank), up to the limit. */
const lexicalOrderJudge: RelevanceJudge = {
  judgeId: "lexical-order-v0",
  kind: "deterministic",
  async judge(input) {
    return {
      status: "judged",
      selected: input.candidates.slice(0, input.limit).map((candidate) => ({ candidateId: candidate.candidateId, basis: "lexical-rank" })),
    };
  },
};
export const LEXICAL_ORDER_JUDGE: RelevanceJudge = Object.freeze(lexicalOrderJudge);

/** Which facts may participate in a purpose, from the fixtures alone. Independent of any task. */
export function eligibleKeysFor(purpose: RelevancePurpose): ReadonlySet<string> {
  return new Set(
    FACTS.filter((fact) => {
      const e = ELIGIBILITY[fact.key]!;
      if (e.rejected) return false;
      if (purpose === "internal-answer") return true;
      return e.ratified && e.publicUse === "allowed";
    }).map((fact) => fact.key),
  );
}

export type FixtureWithholdReason = "not-ratified" | "public-use-unknown" | "public-use-denied";

/**
 * BENCHMARK STAND-IN for the upstream purpose gate. Not a runtime policy: it reads the corpus's
 * fixtures, never Governance. It exists so the benchmark can show a relevant-but-withheld fact
 * staying out of a purpose's candidate set; the gate itself belongs to a later, separately approved
 * phase in Knowledge and Governance.
 */
export function fixtureEligibility<S extends { readonly factKey: string }>(
  purpose: RelevancePurpose,
  sources: readonly S[],
): { readonly eligible: readonly S[]; readonly withheld: readonly { readonly key: string; readonly reason: FixtureWithholdReason }[] } {
  if (purpose === "internal-answer") return { eligible: sources, withheld: [] };
  const eligible: S[] = [];
  const withheld: { key: string; reason: FixtureWithholdReason }[] = [];
  for (const source of sources) {
    const e = ELIGIBILITY[source.factKey];
    const reason: FixtureWithholdReason | null = !e || !e.ratified
      ? "not-ratified"
      : e.publicUse === "denied"
        ? "public-use-denied"
        : e.publicUse !== "allowed"
          ? "public-use-unknown"
          : null;
    if (reason) withheld.push({ key: source.factKey, reason });
    else eligible.push(source);
  }
  return { eligible, withheld };
}

export interface QueryMeasurement {
  readonly queryId: string;
  readonly purpose: RelevancePurpose;
  readonly classes: readonly QueryClass[];
  readonly lang: BenchQuery["lang"];
  readonly grounding: BenchQuery["grounding"];
  readonly retrievalStatus: string;
  /** Gold restricted to what this purpose may use. */
  readonly goldEligible: readonly string[];
  /** Relevant facts this purpose must never use. */
  readonly goldIneligible: readonly string[];
  readonly candidateKeys: readonly string[];
  readonly withheld: readonly { readonly key: string; readonly reason: string }[];
  readonly recallAt: Readonly<Record<number, number | null>>;
  readonly candidateRecall: number | null;
  readonly missing: readonly string[];
  readonly selectionStatus: RelevanceOutcome["status"];
  readonly selectedKeys: readonly string[];
  readonly precision: number | null;
  readonly falseInclusions: readonly string[];
  readonly falseExclusions: readonly string[];
  /** Only meaningful when no eligible gold exists: true when nothing was selected. */
  readonly noRelevantCorrect: boolean | null;
  /** Purpose-ineligible facts that reached the candidate set. Must be empty. */
  readonly leakedIneligible: readonly string[];
  /** Candidates from another tenant, superseded or rejected nodes. Must be empty. */
  readonly integrityViolations: readonly string[];
  readonly latencyMs: number;
}

export async function measureQuery(
  query: BenchQuery,
  purpose: RelevancePurpose,
  seeded: SeededCorpus,
  repo: DurableKnowledgeRepository,
): Promise<QueryMeasurement> {
  const eligible = eligibleKeysFor(purpose);
  const goldEligible = query.gold.filter((key) => eligible.has(key));
  const goldIneligible = query.gold.filter((key) => !eligible.has(key));

  const started = performance.now();
  const retrieved = await searchKnowledge(
    { tenantId: seeded.tenantA },
    { queryText: query.task, limit: RETRIEVAL_MAX_LIMIT },
    {
      getRepo: () => repo,
      now: () => BENCH_NOW,
      readRejectedKnowledgeVersions: async () => ({ status: "read", rejectedNodeIds: seeded.rejectedNodes }),
    },
  );
  const latencyMs = performance.now() - started;

  const integrityViolations: string[] = [];
  const retrievedSources: RelevanceSource[] =
    retrieved.status === "matched"
      ? retrieved.candidates.map(({ record }) => {
          const nodeId = record.activeKnowledgeNodeId ?? "";
          if (seeded.tenantBNodes.has(nodeId)) integrityViolations.push(`other-tenant:${nodeId}`);
          if (seeded.supersededNodes.has(nodeId)) integrityViolations.push(`superseded:${nodeId}`);
          if (seeded.rejectedNodes.has(nodeId)) integrityViolations.push(`rejected:${nodeId}`);
          return {
            nodeId,
            factId: record.factId,
            factKey: record.factKey,
            knowledgeVersion: record.knowledgeVersion,
            domainKey: record.domainKey,
            title: record.title,
            statement: record.statement,
          };
        })
      : [];

  const gate = fixtureEligibility(purpose, retrievedSources);
  const set = buildRelevanceCandidateSet({
    purpose,
    eligibility: { status: "established", eligible: gate.eligible, withheldCount: gate.withheld.length },
  });
  const candidateKeys = set.status === "built" ? set.candidates.map((c) => c.factKey) : [];
  const withheld = gate.withheld;
  const leakedIneligible = candidateKeys.filter((key) => !eligible.has(key));

  const recallAt: Record<number, number | null> = {};
  for (const k of RECALL_KS) {
    recallAt[k] = goldEligible.length === 0 ? null : goldEligible.filter((key) => candidateKeys.slice(0, k).includes(key)).length / goldEligible.length;
  }
  const candidateRecall = goldEligible.length === 0 ? null : goldEligible.filter((key) => candidateKeys.includes(key)).length / goldEligible.length;
  const missing = goldEligible.filter((key) => !candidateKeys.includes(key));

  const outcome = await selectRelevant({ purpose, task: query.task, limit: RETRIEVAL_DEFAULT_LIMIT }, set, LEXICAL_ORDER_JUDGE);
  const selectedKeys = outcome.status === "selected" || outcome.status === "degraded" ? outcome.selections.map((s) => s.candidate.factKey) : [];
  const falseInclusions = selectedKeys.filter((key) => !goldEligible.includes(key));
  const falseExclusions = goldEligible.filter((key) => !selectedKeys.includes(key));
  const precision = selectedKeys.length === 0 ? null : (selectedKeys.length - falseInclusions.length) / selectedKeys.length;
  const noRelevantCorrect = goldEligible.length === 0 ? selectedKeys.length === 0 : null;

  return {
    queryId: query.id,
    purpose,
    classes: query.classes,
    lang: query.lang,
    grounding: query.grounding,
    retrievalStatus: retrieved.status,
    goldEligible,
    goldIneligible,
    candidateKeys,
    withheld,
    recallAt,
    candidateRecall,
    missing,
    selectionStatus: outcome.status,
    selectedKeys,
    precision,
    falseInclusions,
    falseExclusions,
    noRelevantCorrect,
    leakedIneligible,
    integrityViolations,
    latencyMs,
  };
}

export async function measureAll(seeded: SeededCorpus, repo: DurableKnowledgeRepository): Promise<readonly QueryMeasurement[]> {
  const out: QueryMeasurement[] = [];
  for (const purpose of ["internal-answer", "public-content-grounding"] as const) {
    for (const query of QUERIES) out.push(await measureQuery(query, purpose, seeded, repo));
  }
  return out;
}

/* ── aggregation ──────────────────────────────────────────────────────────── */

const mean = (values: readonly number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

export interface Aggregate {
  readonly queries: number;
  /** Queries with at least one eligible relevant fact — the denominator for recall. */
  readonly withEligibleGold: number;
  readonly recallAt: Readonly<Record<number, number | null>>;
  readonly candidateRecall: number | null;
  readonly meanPrecision: number | null;
  readonly falseInclusions: number;
  readonly falseExclusions: number;
  readonly noRelevantQueries: number;
  readonly noRelevantCorrect: number;
  readonly zeroCandidateQueries: number;
  readonly leakedIneligible: number;
  readonly integrityViolations: number;
  readonly latencyMsMedian: number | null;
  readonly latencyMsMax: number | null;
}

export function aggregate(rows: readonly QueryMeasurement[]): Aggregate {
  const withGold = rows.filter((row) => row.goldEligible.length > 0);
  const recallAt: Record<number, number | null> = {};
  for (const k of RECALL_KS) recallAt[k] = mean(withGold.map((row) => row.recallAt[k] ?? 0));
  const latencies = rows.map((row) => row.latencyMs).sort((a, b) => a - b);
  const noRel = rows.filter((row) => row.noRelevantCorrect !== null);
  return {
    queries: rows.length,
    withEligibleGold: withGold.length,
    recallAt,
    candidateRecall: mean(withGold.map((row) => row.candidateRecall ?? 0)),
    meanPrecision: mean(rows.filter((row) => row.precision !== null).map((row) => row.precision!)),
    falseInclusions: rows.reduce((sum, row) => sum + row.falseInclusions.length, 0),
    falseExclusions: rows.reduce((sum, row) => sum + row.falseExclusions.length, 0),
    noRelevantQueries: noRel.length,
    noRelevantCorrect: noRel.filter((row) => row.noRelevantCorrect).length,
    zeroCandidateQueries: rows.filter((row) => row.candidateKeys.length === 0).length,
    leakedIneligible: rows.reduce((sum, row) => sum + row.leakedIneligible.length, 0),
    integrityViolations: rows.reduce((sum, row) => sum + row.integrityViolations.length, 0),
    latencyMsMedian: latencies.length ? latencies[Math.floor(latencies.length / 2)]! : null,
    latencyMsMax: latencies.length ? latencies[latencies.length - 1]! : null,
  };
}

/** A stable fingerprint of what was selected, for the determinism check. */
export function selectionFingerprint(rows: readonly QueryMeasurement[]): string {
  return rows.map((row) => `${row.purpose}|${row.queryId}|${row.candidateKeys.join(",")}|${row.selectedKeys.join(",")}`).join("\n");
}
