/*
 * RELEVANCE-1 synthetic-only guard. A model request may carry the judge instruction, a corpus task
 * and bounded corpus fact texts — nothing else. Checked BEFORE a request reaches the transport.
 */
import type { ClaudeTransportRequest } from "../../src/features/heby-model/claude-transport";
import { RELEVANCE_MAX_CANDIDATE_TEXT } from "../../src/features/knowledge-retrieval/relevance";
import { FACTS, QUERIES } from "../relevance-benchmark/corpus";
import { MODEL_JUDGE_SYSTEM } from "./model-judge";

/** The only texts a request may carry. */
const ALLOWED_CANDIDATE_TEXTS = new Set(
  FACTS.map((fact) => `${fact.title} — ${fact.statement}`.slice(0, RELEVANCE_MAX_CANDIDATE_TEXT)),
);
const ALLOWED_TASKS = new Set(QUERIES.map((query) => query.task.trim()));

export function assertSyntheticRequest(request: ClaudeTransportRequest): void {
  if (request.system !== MODEL_JUDGE_SYSTEM) throw new Error("synthetic guard: unexpected system text");
  if (request.messages.length !== 1 || request.messages[0]!.role !== "user") throw new Error("synthetic guard: unexpected messages");
  const body = request.messages[0]!.content;
  const [head, candidates] = body.split("\nCandidates:\n");
  if (candidates === undefined) throw new Error("synthetic guard: no candidate block");
  const task = /\nTask:\n([\s\S]*)\n$/.exec(`${head}\n`)?.[1]?.trim();
  if (!task || !ALLOWED_TASKS.has(task)) throw new Error("synthetic guard: task is not a corpus task");
  for (const line of candidates.split("\n")) {
    const text = /^c\d+: ([\s\S]*)$/.exec(line)?.[1];
    if (text === undefined || !ALLOWED_CANDIDATE_TEXTS.has(text)) throw new Error("synthetic guard: candidate is not corpus text");
  }
}
