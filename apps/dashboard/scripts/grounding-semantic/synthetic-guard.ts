/*
 * GS-3 synthetic-only guard. Fails closed: a request body may be sent only if it is byte-identical to
 * `buildRequestBody` over one registered synthetic case (claim + evidence, in order), for an allowed
 * model. Anything else — another system text, an extra message, a string from anywhere but the frozen
 * synthetic sets — throws before the network is reached.
 */
import { BENCH_CASES, PILOT, isSendable } from "./cases";
import { buildRequestBody } from "./contract";

export const ALLOWED_MODELS = new Set(["claude-opus-5-5"]);

const REGISTERED = new Set(
  [...PILOT, ...BENCH_CASES].filter(isSendable).map((c) => JSON.stringify([c.claim, c.evidence])),
);

export function assertSyntheticRequest(body: unknown): void {
  const b = body as { model?: unknown; messages?: { content?: unknown }[] };
  if (typeof b?.model !== "string" || !ALLOWED_MODELS.has(b.model)) throw new Error("synthetic guard: model not allowed");
  let doc: { claim?: unknown; evidence?: { text?: unknown }[] };
  try {
    doc = JSON.parse(String(b.messages?.[0]?.content));
  } catch {
    throw new Error("synthetic guard: user turn is not the experiment document");
  }
  const claim = doc.claim;
  const evidence = Array.isArray(doc.evidence) ? doc.evidence.map((e) => e?.text) : null;
  if (typeof claim !== "string" || !evidence || !evidence.every((t) => typeof t === "string")) {
    throw new Error("synthetic guard: malformed experiment document");
  }
  if (!REGISTERED.has(JSON.stringify([claim, evidence]))) throw new Error("synthetic guard: not a registered synthetic case");
  if (JSON.stringify(body) !== JSON.stringify(buildRequestBody(b.model, { claim, evidence: evidence as string[] }))) {
    throw new Error("synthetic guard: body differs from the frozen request shape");
  }
}
