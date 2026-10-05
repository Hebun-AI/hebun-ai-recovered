/*
 * GS-3 — run the semantic experiment over SYNTHETIC cases only. Not a runtime path.
 *
 *   node --env-file=<.env.local> --import tsx scripts/grounding-semantic/run.ts <pilot|bench|gs4> <out.jsonl> [run-label]
 *
 * Reads ANTHROPIC_API_KEY for authentication only; it is never written anywhere. Every body passes
 * `assertSyntheticRequest` before `fetch`. No retries: a provider failure is a measured outcome.
 * Unreadable or empty evidence is never sent — the deterministic verdict stands for those cases.
 */
import { appendFileSync } from "node:fs";
import { BENCH_CASES, GS4_CASES, PILOT, isSendable, type SemanticCase } from "./cases";
import { buildRequestBody, validateSemanticAnswer } from "./contract";
import { ALLOWED_MODELS, assertSyntheticRequest } from "./synthetic-guard";

const MODEL = "claude-opus-5-5";
const TIMEOUT_MS = 120_000;
const CONCURRENCY = 4;

async function call(c: SemanticCase, runLabel: string) {
  const input = { claim: c.claim, evidence: c.evidence! };
  const body = buildRequestBody(MODEL, input);
  assertSyntheticRequest(body);
  const started = Date.now();
  let status = 0;
  let json: unknown = null;
  let error: string | null = null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = res.status;
    json = await res.json().catch(() => null);
    if (!res.ok) error = `http-${status}:${(json as { error?: { type?: string } })?.error?.type ?? "?"}`;
  } catch (e) {
    error = e instanceof Error ? e.name : "fetch-error";
  }
  const ms = Date.now() - started;
  const answer = error ? ({ ok: false, failure: "provider-error" } as const) : validateSemanticAnswer(json, input);
  const j = json as { usage?: { input_tokens?: number; output_tokens?: number }; stop_reason?: string; content?: { type: string; text?: string }[] } | null;
  return {
    run: runLabel,
    bench: c.bench,
    id: c.id,
    model: MODEL,
    ms,
    status,
    error,
    stopReason: j?.stop_reason ?? null,
    inputTokens: j?.usage?.input_tokens ?? 0,
    outputTokens: j?.usage?.output_tokens ?? 0,
    answer,
    /* Synthetic data only: the model's text, kept for diagnosing malformed output. */
    text: (j?.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("").slice(0, 600),
  };
}

async function main() {
  const [stage, out, runLabel = "r1"] = process.argv.slice(2);
  if (!out || !["pilot", "bench", "gs4"].includes(stage!)) throw new Error("usage: run.ts <pilot|bench|gs4> <out.jsonl> [run-label]");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");
  if (!ALLOWED_MODELS.has(MODEL)) throw new Error("model not allowed");
  const cases = (stage === "pilot" ? PILOT : stage === "gs4" ? GS4_CASES : BENCH_CASES).filter(isSendable);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < cases.length) {
        const c = cases[next++]!;
        const row = await call(c, runLabel);
        appendFileSync(out, `${JSON.stringify(row)}\n`);
        done++;
        if (done % 20 === 0) console.log(`${done}/${cases.length}`);
      }
    }),
  );
  console.log(`${stage}: ${done} synthetic requests, all guard-checked → ${out}`);
}

void main();
