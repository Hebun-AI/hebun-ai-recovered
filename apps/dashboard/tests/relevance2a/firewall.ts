/*
 * RELEVANCE-2A — the data-use firewall. CAPABILITY PREPARATION, NOT CONNECTED CAPABILITY.
 *
 * No authority decides whether organizational Knowledge may be sent to a model provider for
 * relevance. Until one exists, the RELEVANCE-2A unit must be structurally unreachable: nothing in
 * `src` outside the unit imports any member of it, so no Heby orchestration, content preparation,
 * route, action or execution path can reach the model judge. The unit itself selects no transport,
 * reads no environment, resolves no tenant, writes nothing, and carries no permission flag that a
 * later caller could flip.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read = (file: string) => readFileSync(file, "utf8");
const codeOf = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
function collect(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collect(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}
const importsOf = (code: string) => [...code.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);

const RELEVANCE = "src/features/knowledge-retrieval/relevance.ts";
const GROUNDING = "src/features/knowledge-retrieval/grounding.ts";
const ADAPTER = "src/features/relevance-judge/model-relevance-judge.ts";
const UNIT = new Set([RELEVANCE, GROUNDING, ADAPTER]);

/** Does an import specifier, written in `file`, resolve to a member of the unit? */
function reachesUnit(file: string, specifier: string): boolean {
  if (/knowledge-retrieval\/(relevance|grounding)$/.test(specifier)) return true;
  if (/relevance-judge(\/|$)/.test(specifier)) return true;
  if (file.startsWith("src/features/knowledge-retrieval/") && /^\.\/(relevance|grounding)$/.test(specifier)) return true;
  return false;
}

function main(): void {
  /* ── 1. NOT WIRED: nothing outside the unit imports any member of it ── */
  {
    const src = [...collect("src")];
    for (const file of src.filter((f) => !UNIT.has(f))) {
      for (const specifier of importsOf(codeOf(read(file)))) {
        assert.ok(!reachesUnit(file, specifier), `${file} imports ${specifier} — RELEVANCE-2A is not runtime-connected`);
      }
    }
    assert.ok(!/relevance|grounding/.test(codeOf(read("src/features/knowledge-retrieval/index.ts"))), "the retrieval index exports neither contract");
    assert.deepEqual(collect("src/features/relevance-judge"), [ADAPTER], "the adapter feature holds the adapter only — no index, no server entry");
  }

  /* ── 2. the adapter is not a provider authority and holds no permission ── */
  {
    const code = codeOf(read(ADAPTER));
    for (const banned of [
      "process.env", "selectModelTransport", "createLiveClaudeTransport", "heby-model-live", "fetch(",
      "resolveClaudeDirectorEnabled", "resolveDirectorEnabled", "tenantId", "TenantContext", "@/db", "drizzle",
      ".insert(", ".update(", ".delete(", "decision_records", "writeGovernanceDecision", "knowledge-write",
      "next/headers", "@/app", "\"use server\"",
    ]) {
      assert.ok(!code.includes(banned), `the adapter must not contain ${banned}`);
    }
    /* It reaches the transport through the port's own files, never the index that re-exports selection. */
    const imports = importsOf(code).sort();
    assert.deepEqual(imports, [
      "@/features/heby-model/claude-structured-response-validator",
      "@/features/heby-model/claude-transport",
      "@/features/heby-model/model-error",
      "@/features/knowledge-retrieval/relevance",
    ]);
    /* No permission-shaped option a future caller could set to pass a data-use gate that does not exist. */
    assert.ok(!/\b(authori[sz]ed|allowed|permitted|permission|dataUse|consent)\b/i.test(code), "no data-use flag on the adapter");
  }

  /* ── 3. no data-use authority was invented ── */
  {
    const dataUseFiles = collect("src").filter((f) => /data-?use/i.test(f));
    for (const file of dataUseFiles) {
      assert.ok(file.startsWith("src/features/media-assets/"), `${file}: the only data-use authority is the existing media guard`);
    }
    for (const file of UNIT) {
      assert.ok(!/data-?use|DataUse/i.test(codeOf(read(file))), `${file} declares no data-use policy`);
    }
  }

  /* ── 4. the pure contracts stay pure ── */
  {
    assert.deepEqual(importsOf(codeOf(read(GROUNDING))), ["./relevance"], "grounding imports only the relevance contract");
    for (const file of [RELEVANCE, GROUNDING]) {
      const code = codeOf(read(file));
      for (const banned of ["process.env", "fetch(", "@/db", "drizzle", "heby-model", "provider", "Date(", ".insert(", ".update(", ".delete(", "claude", "anthropic"]) {
        assert.ok(!code.toLowerCase().includes(banned.toLowerCase()), `${file} must not contain ${banned}`);
      }
      assert.ok(!/public-use|publicUse|PublicUse/.test(code), `${file} knows nothing of public use (KT-3 firewall)`);
    }
    /* The grounding contract cannot declare a model a verifier. */
    assert.match(codeOf(read(GROUNDING)), /export type GroundingVerifierKind = "deterministic" \| "human";/);
  }

  /* ── 5. the live transport serialises no structured request ── */
  {
    const code = codeOf(read("src/features/heby-model-live/claude-http-transport.server.ts"));
    assert.ok(code.includes("request.structuredOutput !== undefined"), "the live transport refuses a structured request");
    assert.ok(!/output_format|output_config|tool_choice|json_schema|anthropic-beta/.test(code), "no provider structured mechanism is guessed");
    const body = /body:\s*JSON\.stringify\(\{([\s\S]*?)\}\),\s*signal/.exec(code)?.[1] ?? "";
    assert.ok(!/structured/i.test(body), "the wire body carries no structured field");
  }

  console.log("PASS relevance-2a firewall");
}

main();
