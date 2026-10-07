/*
 * AP-3 — DISPATCH SAFETY CAP FIREWALL (structural).
 *
 *   1. The process-budget prepay seam is narrow: its key is a module-private `Symbol(...)` (never
 *      `Symbol.for`, never exported), and only the generator calls `prepayLiveDispatch`.
 *   2. The admission is reached by exactly three modules: the Claude generator and the two media
 *      invocation writers. Each media writer admits a LIVE registration through it.
 *   3. The cap module writes nothing itself; its audit sibling appends exactly one thing — the refusal
 *      row — and never a media row, an agent, a mandate or an authorization. Neither imports a deciding
 *      authority (EAI, AP-1, AP-2).
 *   4. It speaks safety-cap language: no billing, quota, price or plan vocabulary in its code.
 *   5. No migration names the cap: AP-3 adds no schema.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CAP = "src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server.ts";
const TRANSPORT = "src/features/heby-model-live/claude-http-transport.server.ts";
const GENERATOR = "src/features/heby-model/heby-model-generation.server.ts";
const IMAGE = "src/features/media-assets/request-media-generation.server.ts";
const AUDIT = "src/features/governance-audit/ai-dispatch-cap-audit.server.ts";
const VIDEO = "src/features/media-assets/async-generation-lifecycle.server.ts";

const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const code = (f: string): string => read(f).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}
const SOURCE = walk("src").filter((f) => !f.startsWith("src/db/migrations/"));

/* ── 1. THE PREPAY SEAM ───────────────────────────────────────────────────── */
{
  const t = code(TRANSPORT);
  assert.match(t, /const PREPAY_LIVE_DISPATCH: unique symbol = Symbol\("hebun\.live-dispatch-prepay"\);/, "the prepay key is a private Symbol");
  assert.ok(!/export\s+const\s+PREPAY_LIVE_DISPATCH/.test(t), "the prepay key is not exported");
  assert.ok(!/Symbol\.for\("hebun\.live-dispatch-prepay"\)/.test(t), "the prepay key is not a registry symbol");
  assert.match(
    t,
    /\[PREPAY_LIVE_DISPATCH\]\(\): boolean \{\s*if \(prepaid \|\| calls >= maxCalls \|\| !budget\.attempt\(\)\) return false;\s*prepaid = true;/,
    "the prepaid flag is set only after the transport's own budget granted a unit",
  );
  assert.deepEqual(
    SOURCE.filter((f) => /prepayLiveDispatch\(/.test(code(f)) && f !== TRANSPORT),
    [GENERATOR],
    "only the generator prepays a live dispatch",
  );
}

/* ── 2. WHO ADMITS ────────────────────────────────────────────────────────── */
{
  assert.deepEqual(
    SOURCE.filter((f) => /ai-dispatch-cap\/ai-dispatch-safety-cap\.server/.test(code(f))).sort(),
    [VIDEO, GENERATOR, IMAGE].sort(),
    "the admission is reached by the generator and the two media invocation writers only",
  );
  for (const f of [IMAGE, VIDEO]) {
    assert.match(
      code(f),
      /if \(transport\.transport === "live"\) \{\s*const admission = await admitAiDispatch\(\s*\{ tenantId: tenant\.tenantId, dispatchClass: "media", actorUserId: tenant\.userId, commit: register \}/,
      `${f}: a live registration is written only through the admission`,
    );
  }
  assert.match(code(GENERATOR), /dispatchClass: "model",/, "the generator admits as the model class");
}

/* ── 3. WHAT THE CAP WRITES AND READS ─────────────────────────────────────── */
{
  const c = code(CAP);
  assert.ok(!/\.(insert|update|delete)\(/.test(c), "the cap itself writes nothing: its charge is the caller's commit, its refusal the sibling's");
  const imports = [...c.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    imports,
    [
      "@/db/client.server",
      "@/db/schema/media-asset",
      "@/features/governance-audit/ai-dispatch-cap-audit.server",
      "@/features/governance-audit/ai-dispatch-cap-audit.server",
      "drizzle-orm",
    ],
    "the cap imports storage and its audit sibling — no deciding authority",
  );
  const a = code(AUDIT);
  assert.deepEqual([...a.matchAll(/\.(insert|update|delete)\(\s*(\w+)\s*\)/g)].map((m) => `${m[1]}:${m[2]}`), ["insert:auditLog"], "the sibling appends to the sink and nothing else");
  assert.equal([...a.matchAll(/action: (\w+),/g)].map((m) => m[1]).join(","), "AI_DISPATCH_CAP_REFUSED", "its one row is the refusal");
  assert.deepEqual(
    [...a.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort(),
    ["./external-ai-disclosure-audit.server", "@/db/client.server", "@/db/schema/audit-log", "drizzle-orm", "node:crypto"],
    "the sibling imports the sink and the evidence action name — no deciding authority",
  );
}

/* ── 4. LANGUAGE ──────────────────────────────────────────────────────────── */
for (const f of [CAP, AUDIT]) assert.ok(!/billing|quota|price|pricing|\bplan\b|invoice|credit/i.test(code(f)), `${f} speaks safety-cap, not billing`);

/* ── 5. NO SCHEMA ─────────────────────────────────────────────────────────── */
assert.ok(
  !walk("src/db").some((f) => /dispatch_cap|dispatch-cap|dispatchCap/i.test(read(f))),
  "no schema or migration names the dispatch cap",
);

console.log("ap3-dispatch-safety-cap/firewall: ok");
