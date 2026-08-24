/*
 * Drive source discovery — DISCOVERED IS NOT IMPORTED, AND KNOWLEDGE DID NOT LEARN A CONNECTION.
 *
 * ── THE TWO SENTENCES THIS SUITE DEFENDS ────────────────────────────────────
 *
 *   1. READING WHAT EXISTS IN A PROVIDER ADMITS NOTHING INTO KNOWLEDGE.
 *   2. THE PROVIDER ANSWERS; THE KNOWLEDGE WORKSPACE ONLY RENDERS THE ANSWER.
 *
 * The second is why this seam lives in `provider-google` rather than in `features/knowledge`. The
 * Knowledge-owned version of this module was written, and I1's firewall correctly rejected it:
 * "Governance and Knowledge must not own, read or write tenant connections." Ownership inverted
 * instead of the firewall bending, and this suite pins that outcome so it cannot drift back.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { discoverDriveSources } from "../../src/features/provider-google/discover-drive-sources.server";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SEAM = "src/features/provider-google/discover-drive-sources.server.ts";
const CARD = "src/components/knowledge-workspace/discovered-sources-card.tsx";
const PAGE = "src/app/(dashboard)/knowledge/page.tsx";

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join("src", spec.slice(2))
    : spec.startsWith(".")
      ? path.join(path.dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const c = base + ext;
    if (existsSync(path.join(ROOT, c)) && statSync(path.join(ROOT, c)).isFile()) return c;
  }
  return null;
}

function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of codeOf(read(f)).matchAll(/from\s+"([^"]+)"/g)) {
      const t = resolveImport(m[1]!, f);
      if (t) stack.push(t);
    }
  }
  return seen;
}

/* ── 1. I1 §5 STAYS INTACT — KNOWLEDGE LEARNED NOTHING ABOUT CONNECTIONS ────── */
function knowledgeStillOwnsNoConnection(): void {
  const offenders = collect("src/features/knowledge").filter((f) => {
    const code = codeOf(read(f));
    return (
      code.includes("integration-authority") ||
      code.includes("provider-catalog") ||
      code.includes("provider-google") ||
      /from\s+"@\/db\/schema\/integration"/.test(code)
    );
  });
  assert.deepEqual(
    offenders,
    [],
    "no Knowledge feature module may read connection, capability or provider state",
  );
}

/* ── 2. THE SEAM ADDS NO AUTHORITY ──────────────────────────────────────────── */
function theSeamOwnsNoMachinery(): void {
  const code = codeOf(read(SEAM));
  for (const forbidden of [
    /(?<![\w.])fetch\b/,
    /googleapis\.com|accounts\.google\.com/,
    /clientSecret|client_secret/,
    /refreshAccessToken/,
    /listDriveFiles/,
    /decrypt|openSecret/i,
    /integration_credentials/,
  ]) {
    assert.ok(!forbidden.test(code), `the discovery seam must not own provider machinery: ${forbidden}`);
  }
  assert.match(code, /readDriveMetadata/, "it reaches Google through the one released seam");
  assert.match(code, /getCapabilityAvailability/, "and quotes the capability authority");
}

/* ── 3. NO KNOWLEDGE PERSISTENCE IS REACHABLE ───────────────────────────────── */
function discoveryReachesNoKnowledgeWriter(): void {
  const graph = reachableFrom(SEAM);
  for (const f of graph) {
    assert.ok(
      !/^src\/features\/knowledge\//.test(f),
      `discovery must reach no Knowledge module at all — reached ${f}`,
    );
  }
  const code = codeOf(read(SEAM));
  for (const w of [/insert\s*\(/, /update\s*\(/, /delete\s*\(/, /\.transaction\s*\(/, /embedding/i, /\bvector\b/i, /synchroni[sz]/i]) {
    assert.ok(!w.test(code), `discovery introduces no ${w}`);
  }
}

/* ── 4. TENANT COMES FROM CONTEXT ───────────────────────────────────────────── */
function tenantCannotBeClientSelected(): void {
  const code = codeOf(read(SEAM));
  const body = code.slice(code.indexOf("export async function discoverDriveSources"));
  assert.ok(!/tenantId\s*[:?]\s*string/.test(body), "no tenant id parameter exists");
  assert.match(code, /tenant\?\.tenantId/, "an absent tenant is refused, not defaulted");
  const page = codeOf(read(PAGE));
  assert.match(page, /resolveTenantContext\(\)/, "the page resolves the tenant server-side");
  assert.match(page, /discoverDriveSources\(tenant\)/, "and passes the resolved tenant");
}

/* ── 5. SIX OUTCOMES, AND THEY STAY SIX ─────────────────────────────────────── */
async function outcomesAreNotCollapsed(): Promise<void> {
  const code = codeOf(read(SEAM));
  for (const arm of ["unauthenticated", "unavailable", "provider-failed", "empty", "discovered"]) {
    assert.match(code, new RegExp(`"${arm}"`), `the ${arm} outcome is its own arm`);
  }
  assert.match(
    code,
    /result\.status === "provider-failed"[\s\S]{0,140}status: "provider-failed"/,
    "a provider failure is reported as a provider failure, never as empty",
  );
  assert.match(
    code,
    /candidates\.length === 0 \? \{ status: "empty" \}/,
    "a successful read of nothing is `empty`, distinct from unavailable",
  );

  /* Exercised: no persistence resolves to UNAVAILABLE carrying a reason — never an empty list. */
  const noDb = await discoverDriveSources(
    { tenantId: "11111111-1111-1111-1111-111111111111" } as never,
    { getDb: () => null },
  );
  assert.equal(noDb.status, "unavailable", "unresolvable capability is unavailable, not empty");
  assert.ok(!("candidates" in noDb), "and carries no candidate list at all");
  if (noDb.status === "unavailable") assert.ok(noDb.reason.length > 0, "the reason travels with it");

  const anon = await discoverDriveSources(null);
  assert.equal(anon.status, "unauthenticated", "no tenant is refused, not emptied");
}

/* ── 6. A CANDIDATE IS NOT A KNOWLEDGE DOCUMENT ─────────────────────────────── */
function aCandidateIsNotKnowledge(): void {
  const code = codeOf(read(SEAM));
  for (const field of ["provider", "externalId", "name", "mimeType", "modifiedAt", "sizeBytes", "trashed"]) {
    assert.match(code, new RegExp(`readonly ${field}`), `the candidate exposes ${field}`);
  }
  for (const forbidden of [
    /readonly content/,
    /downloadUrl|webContentLink|exportLink/i,
    /readonly permissions/,
    /readonly owners/,
    /alt=media/,
    /knowledgeId|recordId|versionId/i,
    /ratif/i,
  ]) {
    assert.ok(!forbidden.test(code), `a candidate must not carry ${forbidden}`);
  }
  assert.match(code, /ExternalSourceCandidate/, "the shape is named a candidate");
  assert.ok(
    !/KnowledgeDocument|KnowledgeRecord|ImportedDocument|SyncedDocument/.test(code),
    "and never as though it were already Knowledge",
  );
}

/* ── 7. THE CARD CLAIMS NOTHING IT HAS NOT DONE, AND RESOLVES NOTHING ───────── */
function theCardIsPresentationalAndHonest(): void {
  const card = read(CARD);
  assert.match(card, /have not been imported into Hebun Knowledge/, "it says nothing was imported");
  assert.match(card, /did not open, download or store/, "and that no content was read");

  const code = codeOf(card);
  /* Presentational: it resolves no authority of its own. */
  for (const forbidden of [/resolveTenantContext/, /getCapabilityAvailability/, /readDriveMetadata/, /discoverDriveSources\(/]) {
    assert.ok(!forbidden.test(code), `the card must resolve nothing itself: ${forbidden}`);
  }
  /* Its only link to the seam is a TYPE, which creates no execution edge. */
  assert.match(card, /import type \{ DriveSourceDiscovery \}/, "the card imports a type only");

  for (const control of [/>Import\b/, /Sync\b/, /Add to Knowledge/i, /Summari[sz]e/i, /Analyz/i]) {
    assert.ok(!control.test(code), `no ${control} control exists in this phase`);
  }
  for (const claim of [/\bdelete\b/i, /\bedit\b/i, /\bupload\b/i, /\bwrite to\b/i]) {
    assert.ok(!claim.test(code), `the card implies no Drive mutation: ${claim}`);
  }
}

/* ── 8. THE SECTION DECLARES PROVIDER PROVENANCE, NEVER AUTHORITATIVE ───────── */
function theSectionDeclaresProviderProvenance(): void {
  const page = read(PAGE);
  const idx = page.indexOf('id="external-sources"');
  assert.ok(idx > 0, "the discovery section exists on the canonical Knowledge page");
  const section = page.slice(idx, idx + 900);
  assert.match(section, /provenance=/, "it declares a provenance, as every section must");
  assert.ok(
    !/provenance="authoritative"/.test(section),
    "provider-derived discovery is never authoritative Knowledge",
  );
  assert.match(section, /not Knowledge/, "and the detail says what it is not");
}

async function main(): Promise<void> {
  knowledgeStillOwnsNoConnection();
  theSeamOwnsNoMachinery();
  discoveryReachesNoKnowledgeWriter();
  tenantCannotBeClientSelected();
  await outcomesAreNotCollapsed();
  aCandidateIsNotKnowledge();
  theCardIsPresentationalAndHonest();
  theSectionDeclaresProviderProvenance();
  console.log("drive-source-discovery/discovery-boundary: all assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
