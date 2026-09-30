/*
 * OBSERVATION-AUTHORITY-LEGIBILITY-1 · the projection reads and reaches nothing else.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const DIR = "src/features/observation-authority-legibility";
const PANEL = "src/components/platform-integrations/observation-authority-panel.tsx";
const PAGE = "src/app/(dashboard)/integrations/instagram/page.tsx";
const FILES = readdirSync(path.join(ROOT, DIR)).map((f) => `${DIR}/${f}`);
assert.deepEqual(FILES.map((f) => path.basename(f)).sort(),
  ["contracts.ts", "derive-observation-authority-health.ts", "read-observation-authority-health.server.ts"],
  "a contract, a pure derivation and one composition — nothing else");

/* ═══ 1. IMPORTS: the four released readers and pure contracts, nothing else ═══ */
const ALLOWED = new Set([
  "@/features/auth/tenant/tenant-context",
  "@/features/integration-authority/contracts",
  "@/features/integration-authority/capability-availability.server",
  "@/features/integration-authority/integration-read.server",
  "@/features/provider-observation-history/read-provider-observations.server",
  "@/features/standing-observation-authority/contracts",
  "@/features/standing-observation-authority/read-standing-observations.server",
  "./contracts",
  "./derive-observation-authority-health",
]);
for (const file of [...FILES, PANEL]) {
  const code = codeOf(read(file));
  for (const m of code.matchAll(/from\s+"([^"]+)"/g)) {
    const ok = ALLOWED.has(m[1]!) || (file === PANEL && m[1] === "@/features/observation-authority-legibility/contracts");
    assert.ok(ok, `${file} imports ${m[1]} — only released readers and pure contracts are allowed`);
  }
  for (const banned of [
    "insert(", "update(", "delete(", ".execute(", "sql`", "db.transaction", "getControlPlaneDb", "fetch(",
    "authorizeStandingObservation", "withdrawStandingObservation", "revalidateStandingObservation", "mintObservationPrincipal",
    "disconnectConnection", "retireSupersededConnection", "recordVerifiedConnection", "storeCredential", "listCredentialMetadata",
    "withDecryptedSecret", "withConnectionScopedSecret", "writeProviderObservation", "observeOnceUnderAuthorization",
    "writeGovernanceDecision", "executeAuthorizedAction", "listActiveStandingObservationsForRuntime",
  ]) {
    assert.ok(!code.includes(banned), `${file} must not contain \`${banned}\``);
  }
}

/* ═══ 2. THE DERIVATION IS PURE, AND DOES NOT RE-INTERPRET CONNECTION STATE ═══ */
const derive = codeOf(read(`${DIR}/derive-observation-authority-health.ts`));
for (const m of derive.matchAll(/import\s+(type\s+)?\{[^}]*\}\s+from\s+"([^"]+\.server)"/g)) {
  assert.ok(m[1], `the derivation may take only TYPES from ${m[2]}`);
}
for (const banned of ["new Date(", "Date.now", "process.env", '=== "connected"', '=== "healthy"', "TERMINAL_CONNECTION_STATES"]) {
  assert.ok(!derive.includes(banned), `the derivation must not contain \`${banned}\` — usability is the capability-availability seam's answer`);
}
assert.ok(derive.includes("s.integrationId === record.integrationId"), "the judged source is the AUTHORIZED connection");

/* ═══ 3. NO INVENTED STALENESS POLICY, NO INVENTED CAUSE ═══════════════════════ */
const contracts = codeOf(read(`${DIR}/contracts.ts`));
assert.ok(!/"[a-z-]*stale[a-z-]*"/.test(contracts), "no categorical stale state without a Director-set tolerance");
for (const file of [...FILES, PANEL]) {
  const code = codeOf(read(file)).toLowerCase();
  for (const claim of ["failed since", "times", "provider is failing", "scheduler stopped", "tolerance ="]) {
    assert.ok(!code.includes(claim), `${file} must not claim "${claim}"`);
  }
}

/* ═══ 4. THE SURFACE IS READ-ONLY ═════════════════════════════════════════════ */
const panel = codeOf(read(PANEL));
assert.ok(!/<button|onClick|<form|action=|"use client"|use server/.test(panel), "the panel has no control and no action");
const page = codeOf(read(PAGE));
assert.ok(page.includes("readObservationAuthorityHealth(tenant, INSTAGRAM_PROVIDER_KEY)"), "the page reads with the session tenant");

/* ═══ 5. NO SCHEMA, NO MIGRATION ═══════════════════════════════════════════════ */
for (const f of readdirSync(path.join(ROOT, "src/db/schema"))) {
  assert.ok(!read(`src/db/schema/${f}`).includes("observation-authority-legibility"), "no schema names this projection");
}
assert.ok(!readdirSync(path.join(ROOT, "src/db/migrations")).some((f) => /legibility|observation_health/i.test(f)), "no migration");

console.log(
  "observation-authority-legibility-1/health-firewall: released readers only, no writer / transport / credential / " +
    "revalidator / governance reach, usability from the capability-availability seam, no staleness policy or cause " +
    "claims, read-only panel, no schema or migration",
);
