/*
 * heby-commands/decision-brief.ts — EVIDENCE-DECISION-BRIEF-1: `/brief <question>` as a structured
 * decision brief over the organization's own Knowledge.
 *
 * PURE. The handler in `read-commands.server.ts` does the reads — the KR3 search `/search` uses and
 * Governance's standing per record — and hands the result here. Nothing in this file reads, writes,
 * calls a model or judges a record: every line is fixed text around facts the reads returned, and
 * every "consideration" is one fixed rule over those facts. It is NOT AI interpretation, not a
 * recommendation and not an organizational decision, and the brief says so.
 *
 * Shared with `/search`: the excerpt bound and the exclusion wording, so the two commands describe
 * the same records the same way.
 */
import type { KnowledgeSourceRecord } from "@/features/knowledge/contracts";
import {
  EVIDENCE_ABSENCE_IS_NOT_NONEXISTENCE,
  EVIDENCE_CONFLICTS_NOT_EVALUATED,
  type RetrievalExclusionReason,
} from "@/features/knowledge-retrieval";

export const SEARCH_EXCERPT_LIMIT = 200;

const EXCLUSION_LABELS: Readonly<Record<RetrievalExclusionReason, string>> = {
  "lifecycle-archived": "archived",
  "lifecycle-retired": "retired",
  "governance-rejected": "a version Governance declined",
  expired: "expired",
  "not-yet-effective": "not yet effective",
  deleted: "deleted",
};

/** Counts per reason only — never the key or text of a record that was not served. */
export function exclusionLines(excluded: readonly { readonly reason: RetrievalExclusionReason }[]): readonly string[] {
  if (excluded.length === 0) return [];
  const counts = new Map<RetrievalExclusionReason, number>();
  for (const { reason } of excluded) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  return [
    "",
    `Matched but not served: ${excluded.length} — ${[...counts].map(([reason, n]) => `${n} ${EXCLUSION_LABELS[reason]}`).join(", ")}.`,
  ];
}

export function excerptOf(statement: string | null): string {
  if (!statement) return "(no statement recorded)";
  const flat = statement.replace(/\s+/g, " ").trim();
  return flat.length > SEARCH_EXCERPT_LIMIT ? `${flat.slice(0, SEARCH_EXCERPT_LIMIT)}…` : flat;
}

/* ── the brief ────────────────────────────────────────────────────────────── */

/** One matched record with Governance's reading already applied by the caller. */
export interface BriefRecord {
  readonly record: KnowledgeSourceRecord;
  /** Governance holds the decision the record claims, for this version, in this tenant. */
  readonly confirmed: boolean;
  /** The record claims a decision Governance does not hold. */
  readonly unconfirmedClaim: boolean;
  /** Governance's standing, worded by its owner (one line). */
  readonly standingLine: string;
}

export type BriefEvidence =
  | {
      readonly kind: "matched";
      readonly records: readonly BriefRecord[];
      readonly excluded: readonly { readonly reason: RetrievalExclusionReason }[];
      /** More records matched than are shown (pool bound or per-source cap). */
      readonly more: boolean;
      /** KR4's structural signal: several distinct sources answered in one domain. */
      readonly multipleSourcesOneArea: boolean;
      readonly degradedReason: string | null;
    }
  | {
      readonly kind: "no-match";
      readonly excluded: readonly { readonly reason: RetrievalExclusionReason }[];
      readonly degradedReason: string | null;
    };

export const BRIEF_CONSIDERATIONS_HEADING =
  "E. Decision considerations — derived from the evidence above by fixed rules. Not AI interpretation, not a recommendation, and not an organizational decision.";

export const BRIEF_LIMITATIONS: readonly string[] = Object.freeze([
  "Evidence is limited to the Knowledge records Hebun holds for your organization that share words with the question (lexical search). Records worded differently, or in another language, may be missing.",
  EVIDENCE_CONFLICTS_NOT_EVALUATED,
  EVIDENCE_ABSENCE_IS_NOT_NONEXISTENCE,
  "No AI interpretation was used: this brief is assembled deterministically from the records shown. Work, integrations and operational sources are not part of it.",
  "This brief changes nothing. It records, decides and executes nothing.",
]);

function cautionsOf(record: KnowledgeSourceRecord): string[] {
  const cautions: string[] = [];
  if (record.authorityClass !== "authoritative") cautions.push(record.authorityClass === null ? "authority not stated" : "provisional, not authoritative");
  if (record.freshness === "review-overdue") cautions.push("past its review date");
  if (record.freshness === "unknown") cautions.push("states no effective or review dates");
  return cautions;
}

function recordLines(index: number, item: BriefRecord): string[] {
  const { record } = item;
  const cautions = cautionsOf(record);
  return [
    `${index}. ${record.factKey} — ${record.title}`,
    `  ${record.domainKey} · ${record.scope} · Knowledge status: ${record.lifecycleStatus ?? "not stated"} · ${record.authorityClass ?? "authority not stated"} · freshness: ${record.freshness}`,
    `  ${item.standingLine}`,
    ...(cautions.length > 0 ? [`  Limits: ${cautions.join("; ")}.`] : []),
    `  “${excerptOf(record.statement)}”`,
    `  Source: /source ${record.factKey}`,
  ];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Every consideration is one rule over the facts above; none names an action to take. */
function considerations(evidence: BriefEvidence): string[] {
  const out: string[] = [];
  const records = evidence.kind === "matched" ? evidence.records : [];
  const verified = records.filter((r) => r.confirmed);
  const unconfirmed = records.filter((r) => r.unconfirmedClaim).length;
  const notReviewed = records.filter((r) => !r.confirmed && !r.unconfirmedClaim).length;
  const overdue = records.filter((r) => r.record.freshness === "review-overdue").length;
  const undated = records.filter((r) => r.record.freshness === "unknown").length;
  const provisional = verified.filter((r) => r.record.authorityClass !== "authoritative").length;

  if (verified.length === 0) {
    out.push("No Governance-confirmed record addresses this question. A decision would rest on unconfirmed records or on information not recorded in Hebun.");
  }
  if (unconfirmed > 0) {
    out.push(`${plural(unconfirmed, "record claims", "records claim")} a Governance decision that Governance does not hold. Clarify their status before relying on them.`);
  }
  if (notReviewed > 0) {
    out.push(`${plural(notReviewed, "relevant record has", "relevant records have")} no Governance decision. Management may want them reviewed before they inform a decision.`);
  }
  if (provisional > 0) {
    out.push(`${plural(provisional, "Governance-confirmed record is", "Governance-confirmed records are")} classed provisional or unstated rather than authoritative.`);
  }
  if (overdue > 0) out.push(`${plural(overdue, "record is", "records are")} past its review date. Confirm whether it still applies.`);
  if (undated > 0) out.push(`${plural(undated, "record states", "records state")} no effective or review dates. Confirm when it applies.`);
  if (evidence.kind === "matched" && evidence.multipleSourcesOneArea) {
    out.push("Several sources in one area address this question. Hebun has not checked whether they agree; compare them before deciding.");
  }
  if (evidence.excluded.length > 0) {
    out.push(`${plural(evidence.excluded.length, "matching record is", "matching records are")} not in force. Confirm none is still meant to apply.`);
  }
  if (evidence.kind === "matched" && evidence.more) {
    out.push("More records matched than are shown. Narrow the question to review the rest.");
  }
  if (out.length === 0) out.push("No clarification point follows from the evidence above by these rules.");
  return out.map((line) => `  - ${line}`);
}

export function renderDecisionBrief(question: string, evidence: BriefEvidence): readonly string[] {
  const records = evidence.kind === "matched" ? evidence.records : [];
  const verified = records.filter((r) => r.confirmed);
  const limited = records.filter((r) => !r.confirmed);

  const missing: string[] = [];
  if (evidence.kind === "no-match") missing.push("  - No Knowledge record your organization holds shares words with this question.");
  if (verified.length === 0 && evidence.kind === "matched") missing.push("  - No Governance-confirmed record matched this question.");
  if (evidence.kind === "matched" && evidence.more) missing.push("  - More records matched than are shown here.");
  const excluded = exclusionLines(evidence.excluded).filter((line) => line !== "");
  missing.push(...excluded.map((line) => `  - ${line}`));
  if (evidence.degradedReason) missing.push(`  - ${evidence.degradedReason}`);
  if (missing.length === 0) missing.push("  - Nothing beyond the limits stated below: every matching record in force is shown above.");

  let n = 0;
  return [
    `A. Question: “${question}”`,
    "",
    `B. Verified evidence — Governance-confirmed (${verified.length})`,
    ...(verified.length === 0 ? ["  None."] : verified.flatMap((item) => recordLines(++n, item))),
    "",
    `C. Unverified or limited evidence — not confirmed by Governance; never an approved fact (${limited.length})`,
    ...(limited.length === 0 ? ["  None."] : limited.flatMap((item) => recordLines(++n, item))),
    "",
    "D. Missing or unavailable information — relative to this question and the records Hebun can read",
    ...missing,
    "",
    BRIEF_CONSIDERATIONS_HEADING,
    ...considerations(evidence),
    "",
    "F. Limitations",
    ...BRIEF_LIMITATIONS.map((line) => `  - ${line}`),
  ];
}
