/*
 * CONTENT-PUBLICATION-MEASUREMENT-LINK-1 · the projection is not an authority.
 *
 * Static proofs over the source: the new feature writes nothing, reaches no provider transport,
 * opens no credential, calls no Governance / publication / observation writer, adds no schema or
 * migration, and the Operations surface gains a read and no control.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const DIR = "src/features/content-publication-measurement";
const FILES = readdirSync(path.join(ROOT, DIR)).map((f) => `${DIR}/${f}`);
assert.deepEqual(
  FILES.map((f) => path.basename(f)).sort(),
  ["contracts.ts", "derive-publication-measurement.ts", "read-publication-measurement.server.ts"],
  "the feature is exactly a contract, a pure derivation and one composition",
);

/* ═══ 1. IMPORTS: released readers and pure contracts only ══════════════════ */
const ALLOWED_IMPORTS = new Set([
  "@/features/instagram-connection-surface/media-measurement-evolution",
  "@/features/action-authorization/content-publication-state",
  "@/features/action-authorization/content-publication-state.server",
  "@/features/provider-instagram/contracts",
  "@/features/provider-observation-history/contracts",
  "@/features/provider-observation-history/read-provider-observations.server",
  "@/features/auth/tenant/tenant-context",
  "./contracts",
  "./derive-publication-measurement",
]);
for (const file of FILES) {
  const code = codeOf(read(file));
  for (const m of code.matchAll(/from\s+"([^"]+)"/g)) {
    assert.ok(ALLOWED_IMPORTS.has(m[1]!), `${file} imports ${m[1]} — only released readers and pure contracts are allowed`);
  }
  for (const banned of [
    "insert(", "update(", "delete(", ".execute(", "sql`", "db.transaction", "getControlPlaneDb",
    "fetch(", "withDecryptedSecret", "withConnectionScopedSecret",
    "recordActionRequest", "writeGovernanceDecision", "authorizeStandingObservation",
    "writeProviderObservation", "observeOnceUnderAuthorization", "executeAuthorizedAction",
  ]) {
    assert.ok(!code.includes(banned), `${file} must not contain \`${banned}\` — the projection writes and reaches nothing`);
  }
}

/* ═══ 2. THE PURE HALF IS PURE ═══════════════════════════════════════════════ */
const derive = codeOf(read(`${DIR}/derive-publication-measurement.ts`));
for (const banned of ["new Date(", "Date.now", "process.env"]) {
  assert.ok(!derive.includes(banned), `the derivation must not reference \`${banned}\``);
}
for (const m of derive.matchAll(/import\s+(type\s+)?\{[^}]*\}\s+from\s+"([^"]+\.server)"/g)) {
  assert.ok(m[1], `the derivation may take only TYPES from ${m[2]} — a server module is never loaded by it`);
}

/* ═══ 3. NO SECOND LIMIT, NO SECOND JOIN KEY, NO COALESCING TO ZERO ══════════ */
const compose = codeOf(read(`${DIR}/read-publication-measurement.server.ts`));
assert.ok(compose.includes("limit: MEDIA_EVOLUTION_OBSERVATION_LIMIT"), "the observation bound is IG-AN3's own constant");
assert.ok(!/limit:\s*\d/.test(compose), "no numeric limit of its own");
for (const file of FILES) {
  const code = codeOf(read(file));
  assert.ok(!/\?\?\s*0\b|\|\|\s*0\b/.test(code), `${file}: a missing count is never coalesced to 0`);
}
for (const heuristic of [".caption", ".permalink"]) {
  assert.ok(!derive.includes(heuristic), `the join never reads ${heuristic}`);
}

/* ═══ 4. NO INTERPRETATION VOCABULARY ════════════════════════════════════════ */
const contracts = read(`${DIR}/contracts.ts`);
/* The status labels only — the non-claim sentence names these words precisely to refuse them. */
const wordingStart = contracts.indexOf("PUBLICATION_MEASUREMENT_WORDING");
const wording = contracts.slice(wordingStart, contracts.indexOf("});", wordingStart));
for (const word of ["performed", "engagement rate", "score", "rank", "recommend", "best", "trend", "no-longer-in-window"]) {
  assert.ok(!wording.toLowerCase().includes(word), `surface wording must not say "${word}"`);
}
assert.ok(!codeOf(contracts).includes("no-longer-in-window"), "the underivable state does not exist");

/* ═══ 5. THE SURFACE GAINS A READ, NOT A CONTROL ═════════════════════════════ */
const panel = read("src/components/operations-preparation/content-package-panel.tsx");
const block = panel.slice(panel.indexOf("function PublicationMeasurementRecord"));
assert.ok(block.length > 0 && !/<button|onClick|<form|action=/.test(block), "the measurement block has no control");
const actions = codeOf(read("src/app/(dashboard)/operations/actions.ts"));
const action = actions.slice(actions.indexOf("export async function readContentPublicationMeasurementsAction"));
const body = action.slice(0, action.indexOf("\n}\n"));
assert.ok(body.includes("resolveTenantContext()") && body.includes("readPublicationMeasurements(tenant, revisions)"),
  "the action resolves the session tenant and calls the composition — nothing else");
for (const banned of ["revalidatePath", "insert(", "update(", "record", "write"]) {
  assert.ok(!body.includes(banned), `the read action must not contain \`${banned}\``);
}

/* ═══ 6. NO SCHEMA, NO MIGRATION ═════════════════════════════════════════════ */
for (const f of readdirSync(path.join(ROOT, "src/db/schema"))) {
  assert.ok(!read(`src/db/schema/${f}`).includes("content-publication-measurement"), "no schema names this projection");
}
assert.ok(!readdirSync(path.join(ROOT, "src/db/migrations")).some((f) => /measurement_link/i.test(f)), "no migration");

console.log(
  "content-publication-measurement-link-1/measurement-firewall: released readers only, no writer / transport / " +
    "credential / governance reach, pure derivation, IG-AN3's bound, no zero-coalescing, no interpretation, " +
    "read-only surface, no schema or migration",
);
