/*
 * RELEVANCE-1 candidate strategies, measured against the FROZEN RELEVANCE-0 corpus and gold labels.
 *
 *   A  lexical-candidates   `searchKnowledge` at the retrieval ceiling → upstream (fixture) eligibility
 *                           → judge. The judge can only narrow: a fact lexical never found is a
 *                           CANDIDATE-GENERATION miss, not a judge miss.
 *   B  bounded-eligible     the tenant's whole base-eligible set (tenant-scoped listing, current
 *                           versions, Governance rejections excluded) → upstream (fixture) eligibility
 *                           → judge, ONLY when it fits `RELEVANCE_MAX_CANDIDATES`. Larger: refused,
 *                           never silently truncated. Ordered by fact key, so no lexical hint leaks in.
 *
 * Experiment-only. Reads a disposable database; writes nothing.
 */
import type { DurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { listKnowledgeSources, searchKnowledge } from "../../src/features/knowledge/knowledge-read.server";
import { RETRIEVAL_DEFAULT_LIMIT, RETRIEVAL_MAX_LIMIT, partitionByEligibility } from "../../src/features/knowledge-retrieval";
import {
  RELEVANCE_MAX_CANDIDATES,
  buildRelevanceCandidateSet,
  selectRelevant,
  type RelevanceJudge,
  type RelevanceOutcome,
  type RelevancePurpose,
  type RelevanceSource,
} from "../../src/features/knowledge-retrieval/relevance";
import type { KnowledgeSourceRecord } from "../../src/features/knowledge/contracts";
import type { BenchQuery, QueryClass } from "../relevance-benchmark/corpus";
import { BENCH_NOW, eligibleKeysFor, fixtureEligibility, type SeededCorpus } from "../relevance-benchmark/engine";

export type Strategy = "A-lexical-candidates" | "B-bounded-eligible";

export interface StrategyRow {
  readonly strategy: Strategy;
  readonly judgeId: string;
  readonly queryId: string;
  readonly purpose: RelevancePurpose;
  readonly classes: readonly QueryClass[];
  readonly goldEligible: readonly string[];
  readonly candidateKeys: readonly string[];
  readonly selectedKeys: readonly string[];
  readonly outcome: RelevanceOutcome["status"];
  readonly outcomeDetail: string | null;
  /** The strategy refused because the eligible set exceeded the bound. */
  readonly refusedOverBound: boolean;
  readonly recallAt: Readonly<Record<1 | 3 | 8, number | null>>;
  readonly candidateRecall: number | null;
  readonly finalRecall: number | null;
  readonly precision: number | null;
  readonly falseInclusions: readonly string[];
  readonly falseExclusions: readonly string[];
  /** Gold that never reached the judge. */
  readonly missedByCandidates: readonly string[];
  /** Gold the judge saw and did not select. */
  readonly missedByJudge: readonly string[];
  readonly noRelevantCorrect: boolean | null;
  readonly leakedIneligible: readonly string[];
  readonly integrityViolations: readonly string[];
  readonly latencyMs: number;
}

const toSource = (record: KnowledgeSourceRecord): RelevanceSource => ({
  nodeId: record.activeKnowledgeNodeId ?? "",
  factId: record.factId,
  factKey: record.factKey,
  knowledgeVersion: record.knowledgeVersion,
  domainKey: record.domainKey,
  title: record.title,
  statement: record.statement,
});

async function sourcesFor(
  strategy: Strategy,
  query: BenchQuery,
  seeded: SeededCorpus,
  repo: DurableKnowledgeRepository,
): Promise<readonly RelevanceSource[]> {
  const deps = {
    getRepo: () => repo,
    now: () => BENCH_NOW,
    readRejectedKnowledgeVersions: async () => ({ status: "read" as const, rejectedNodeIds: seeded.rejectedNodes }),
  };
  if (strategy === "A-lexical-candidates") {
    const retrieved = await searchKnowledge({ tenantId: seeded.tenantA }, { queryText: query.task, limit: RETRIEVAL_MAX_LIMIT }, deps);
    return retrieved.status === "matched" ? retrieved.candidates.map(({ record }) => toSource(record)) : [];
  }
  const listing = await listKnowledgeSources({ tenantId: seeded.tenantA }, deps);
  if (listing.status !== "read") throw new Error(`listing ${listing.status}`);
  const { eligible } = partitionByEligibility(listing.records, BENCH_NOW, seeded.rejectedNodes);
  return [...eligible].sort((a, b) => a.factKey.localeCompare(b.factKey)).map(toSource);
}

export async function measureStrategy(
  strategy: Strategy,
  query: BenchQuery,
  purpose: RelevancePurpose,
  seeded: SeededCorpus,
  repo: DurableKnowledgeRepository,
  judge: RelevanceJudge,
): Promise<StrategyRow> {
  const allowed = eligibleKeysFor(purpose);
  const goldEligible = query.gold.filter((key) => allowed.has(key));
  const started = performance.now();

  const sources = await sourcesFor(strategy, query, seeded, repo);
  const integrityViolations = sources.flatMap((s) => [
    ...(seeded.tenantBNodes.has(s.nodeId) ? [`other-tenant:${s.factKey}`] : []),
    ...(seeded.supersededNodes.has(s.nodeId) ? [`superseded:${s.factKey}`] : []),
    ...(seeded.rejectedNodes.has(s.nodeId) ? [`rejected:${s.factKey}`] : []),
  ]);
  const gate = fixtureEligibility(purpose, sources);
  const refusedOverBound = strategy === "B-bounded-eligible" && gate.eligible.length > RELEVANCE_MAX_CANDIDATES;
  const set = refusedOverBound
    ? buildRelevanceCandidateSet({ purpose, eligibility: { status: "unavailable" } })
    : buildRelevanceCandidateSet({ purpose, eligibility: { status: "established", eligible: gate.eligible, withheldCount: gate.withheld.length } });

  const outcome = await selectRelevant({ purpose, task: query.task, limit: RETRIEVAL_DEFAULT_LIMIT }, set, judge);
  const latencyMs = performance.now() - started;

  const candidateKeys = set.status === "built" ? set.candidates.map((c) => c.factKey) : [];
  const selectedKeys = outcome.status === "selected" || outcome.status === "degraded" ? outcome.selections.map((s) => s.candidate.factKey) : [];
  const ratio = (hit: (key: string) => boolean) => (goldEligible.length === 0 ? null : goldEligible.filter(hit).length / goldEligible.length);
  const falseInclusions = selectedKeys.filter((key) => !goldEligible.includes(key));
  const falseExclusions = goldEligible.filter((key) => !selectedKeys.includes(key));

  return {
    strategy,
    judgeId: judge.judgeId,
    queryId: query.id,
    purpose,
    classes: query.classes,
    goldEligible,
    candidateKeys,
    selectedKeys,
    outcome: outcome.status,
    outcomeDetail: outcome.status === "unavailable" ? `${outcome.reason}${outcome.detail ? `:${outcome.detail}` : ""}` : null,
    refusedOverBound,
    recallAt: {
      1: ratio((key) => selectedKeys.slice(0, 1).includes(key)),
      3: ratio((key) => selectedKeys.slice(0, 3).includes(key)),
      8: ratio((key) => selectedKeys.slice(0, 8).includes(key)),
    },
    candidateRecall: ratio((key) => candidateKeys.includes(key)),
    finalRecall: ratio((key) => selectedKeys.includes(key)),
    precision: selectedKeys.length === 0 ? null : (selectedKeys.length - falseInclusions.length) / selectedKeys.length,
    falseInclusions,
    falseExclusions,
    missedByCandidates: goldEligible.filter((key) => !candidateKeys.includes(key)),
    missedByJudge: goldEligible.filter((key) => candidateKeys.includes(key) && !selectedKeys.includes(key)),
    noRelevantCorrect: goldEligible.length === 0 ? selectedKeys.length === 0 && outcome.status !== "unavailable" : null,
    leakedIneligible: candidateKeys.filter((key) => !allowed.has(key)),
    integrityViolations,
    latencyMs,
  };
}

/* ── aggregation ──────────────────────────────────────────────────────────── */

const mean = (values: readonly number[]) => (values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length);

export interface StrategyAggregate {
  readonly rows: number;
  readonly withGold: number;
  readonly recallAt1: number | null;
  readonly recallAt3: number | null;
  readonly recallAt8: number | null;
  readonly candidateRecall: number | null;
  readonly finalRecall: number | null;
  readonly precision: number | null;
  readonly falseInclusions: number;
  readonly falseExclusions: number;
  readonly missedByCandidates: number;
  readonly missedByJudge: number;
  readonly noRelevantCorrect: number;
  readonly noRelevantTotal: number;
  readonly unavailable: number;
  readonly invalid: number;
  readonly refusedOverBound: number;
  readonly leakedIneligible: number;
  readonly integrityViolations: number;
}

export function aggregateRows(rows: readonly StrategyRow[]): StrategyAggregate {
  const gold = rows.filter((row) => row.goldEligible.length > 0);
  const noRel = rows.filter((row) => row.noRelevantCorrect !== null);
  const sum = (pick: (row: StrategyRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  return {
    rows: rows.length,
    withGold: gold.length,
    recallAt1: mean(gold.map((row) => row.recallAt[1] ?? 0)),
    recallAt3: mean(gold.map((row) => row.recallAt[3] ?? 0)),
    recallAt8: mean(gold.map((row) => row.recallAt[8] ?? 0)),
    candidateRecall: mean(gold.map((row) => row.candidateRecall ?? 0)),
    finalRecall: mean(gold.map((row) => row.finalRecall ?? 0)),
    precision: mean(rows.filter((row) => row.precision !== null).map((row) => row.precision!)),
    falseInclusions: sum((row) => row.falseInclusions.length),
    falseExclusions: sum((row) => row.falseExclusions.length),
    missedByCandidates: sum((row) => row.missedByCandidates.length),
    missedByJudge: sum((row) => row.missedByJudge.length),
    noRelevantCorrect: noRel.filter((row) => row.noRelevantCorrect).length,
    noRelevantTotal: noRel.length,
    unavailable: rows.filter((row) => row.outcome === "unavailable").length,
    invalid: rows.filter((row) => row.outcomeDetail?.startsWith("judge-response-invalid") || row.outcomeDetail?.includes("malformed")).length,
    refusedOverBound: rows.filter((row) => row.refusedOverBound).length,
    leakedIneligible: sum((row) => row.leakedIneligible.length),
    integrityViolations: sum((row) => row.integrityViolations.length),
  };
}
