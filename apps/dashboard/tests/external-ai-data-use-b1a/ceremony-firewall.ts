/*
 * EXTERNAL-AI-DATA-USE-B1A — the static boundary of the processor attestation ceremony.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Exactly one root ceremony may write a processor attestation, and it can do nothing else: it
 *    reaches no model, transport, Heby, origination, R2E or tenant Governance writer; it names no
 *    credential and makes no HTTP call; it cannot be confirmed through a pipe; and B1A leaves the
 *    platform policy unable to ALLOW anything and the Claude runtime exactly as Release A left it."
 *
 * Source text plus one refused child process. No database, no provider, no network.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "../../src/features/external-ai-data-use/platform-disclosure-policy";

const ROOT = path.resolve(__dirname, "../..");
const CEREMONY = "scripts/processor-attestation.ts";
const CEREMONY_LIB = "scripts/lib/processor-attestation.ts";
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    if (name === "node_modules") return [];
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx|mjs)$/.test(name) ? [rel] : [];
  });
}

/* ── 1. Exactly one writer, and it lives in scripts/, never in src/. ────────────────────────── */
const writers = [...walk("src"), ...walk("scripts")].filter((file) => {
  const code = stripComments(read(file));
  return /insert\(\s*processorAttestations\b/.test(code) || /into\s+"?(public"?\.)?"?processor_attestations/i.test(code);
});
assert.deepEqual(writers, [CEREMONY_LIB], "the ceremony library is the only processor attestation writer");

/* ── 2. The ceremony reaches nothing it must not. ────────────────────────────────────────────── */
for (const file of [CEREMONY, CEREMONY_LIB]) {
  const code = stripComments(read(file));
  for (const forbidden of [
    "@/features/heby-model",
    "heby-model-live",
    "@/features/heby-answer",
    "@/features/agent-origination",
    "@/features/heby-provider-ops",
    "@/features/relevance",
    "@/features/media-",
    "@/features/action-authorization",
    "@/features/action-execution",
    "authorize-tenant-external-ai-data-use",
    "governance-decision",
    "governance-audit",
    "./lib/provider-connectivity",
    "setProviderConnectivity",
    "platform-disclosure-policy",
  ]) {
    assert.ok(!code.includes(forbidden), `${file} must not reach ${forbidden}`);
  }
  /* Secret safety: no credential name, no provider host, no HTTP call. `git fetch` is a process. */
  assert.ok(!/ANTHROPIC|OPENAI|HIGGSFIELD|_API_KEY|HEBUN_MODEL_CREDENTIAL/.test(code), `${file} names no credential`);
  assert.ok(!/api\.anthropic\.com|https?:\/\//.test(code), `${file} names no network endpoint`);
  assert.ok(!/\bfetch\s*\(|from\s+["']node:https?["']|undici|axios/.test(code), `${file} makes no HTTP call`);
  /* Append-only: the writer never edits or deletes a revision. */
  assert.ok(!/\bupdate\s+"?processor_attestations|\bdelete\s+from\s+"?processor_attestations/i.test(code), `${file} never edits or deletes`);
  /* Root only: no tenant authorization, Governance or decision row is written. */
  assert.ok(!/into\s+"?(tenant_ai_data_use|decision_records|governance_sessions|audit_log|provider_connectivity_controls)/i.test(code), `${file} writes no other table`);
}

/* ── 3. The ceremony takes possession the released way and asks a human on a TTY. ──────────── */
const ceremony = stripComments(read(CEREMONY));
for (const required of ["resolveCeremonyPosture", "preflightEnvironment", "preflight(", "isTTY", "posture.source"]) {
  assert.ok(ceremony.includes(required), `the ceremony uses ${required}`);
}
assert.ok(!/process\.env\.(?!NODE_ENV|DATABASE_URL)\w+/.test(ceremony), "no record field can come from the environment");
assert.match(read("package.json"), /"platform:processor-attestation": "node --import tsx scripts\/processor-attestation\.ts"/);

/* ── 4. A piped stdin is refused before anything else — no record read, no connection. ──────── */
{
  const child = spawnSync(process.execPath, ["--import", "tsx", CEREMONY, "admit", `docs/x/record.md@${"a".repeat(40)}`], {
    cwd: ROOT,
    encoding: "utf8",
    input: "00000000-0000-4000-8000-000000000b1a\n",
    /* No DATABASE_URL and no production signal: the refusal must come from the TTY check alone. */
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "test" },
  });
  assert.equal(child.status, 1, `refused with exit 1 (stderr: ${child.stderr})`);
  assert.match(child.stderr, /NOT_INTERACTIVE/);
  assert.doesNotMatch(child.stdout + child.stderr, /PROCESSOR ATTESTATION CEREMONY —/, "no plan was shown");
}

/*
 * ── 5. B1A changes no policy and no runtime. ─────────────────────────────────────────────────
 * The policy pin moved with B1D (Director, 2026-10-04), which recorded exactly three ALLOWED cells in
 * a separate reviewed change; the ceremony itself still writes no policy. The runtime pin is unchanged.
 */
assert.deepEqual(
  RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells.map((c) => `${c.serviceScope}|${c.purpose}|${c.dataClass}`),
  [
    "anthropic/messages|assistance|conversation",
    "anthropic/messages|assistance|knowledge",
    "anthropic/messages|assistance|work-artifact",
    /* APF-3, a separate reviewed change. */
    "anthropic/messages|agent-origination|conversation",
    "anthropic/messages|agent-origination|organization",
  ],
);
assert.ok(
  !read("scripts/lib/processor-attestation.ts").includes("RECORDED_PLATFORM_DISCLOSURE_POLICY"),
  "the attestation ceremony writes no platform policy",
);
for (const file of walk("src").filter((f) => /^src\/features\/(heby-model|heby-model-live|heby-answer|agent-origination)\//.test(f))) {
  assert.ok(!read(file).includes("processor-attestation"), `${file} does not reach the ceremony`);
}

console.log("PASS external-ai-data-use-b1a ceremony-firewall");
