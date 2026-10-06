/*
 * CONTENT-INTAKE-1 — structure. Content Intake is a controlled admission WORKFLOW, not an authority:
 *
 *   it may reach   the Picker binding resolver, the two released supplied admissions, the pure refusal map
 *   it may not     write a table, read Drive itself, review, select, request, permit, execute, publish,
 *                  call a generative provider, admit Knowledge, or be called by Heby
 *
 * And the chooser change is scoped: the Media chooser multi-selects up to the server's bound; the
 * Knowledge chooser still admits exactly one document. No schema, no scope, no scheduler.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const strip = (c: string): string => c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const raw = (f: string) => readFileSync(path.join(ROOT, f), "utf8");
const code = (f: string) => strip(raw(f));
const importsOf = (c: string) => [...c.matchAll(/from "([^"]+)"/g)].map((m) => m[1]!).sort();
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [path.relative(ROOT, p)] : [];
  });
}

const BATCH = "src/features/content-intake/admit-supplied-drive-batch.server.ts";
const CONTRACTS = "src/features/content-intake/contracts.ts";
const MEDIA_PICKER = "src/components/operations-preparation/google-drive-media-picker.client.ts";
const KNOWLEDGE_PICKER = "src/components/knowledge-workspace/google-picker.client.ts";
const OUTCOME = "src/components/operations-preparation/drive-batch-outcome.tsx";
const DOORS = ["src/components/operations-preparation/supply-image-from-drive.tsx", "src/components/operations-preparation/supply-video-from-drive.tsx"];
const ACTIONS = "src/app/(dashboard)/operations/actions.ts";

function main(): void {
  /* ── 1. THE ORCHESTRATOR REACHES EXACTLY THIS, AND WRITES NOTHING ── */
  const batch = code(BATCH);
  assert.deepEqual(importsOf(batch), [
    "./contracts",
    "@/features/auth/tenant/tenant-context",
    "@/features/media-assets/admit-supplied-drive-image.server",
    "@/features/media-assets/admit-supplied-drive-video.server",
    "@/features/media-assets/supplied-drive-refusal",
    "@/features/provider-google/picker-connection-binding.server",
  ]);
  for (const banned of [/\.insert\(/, /\.update\(/, /\.delete\(/, /\bfetch\(/, /getDb|resolveMediaDbOrNull|drizzle/, /readDriveImage|relayDriveVideo|withGoogleAccessToken/, /setInterval|setTimeout|cron/i]) {
    assert.ok(!banned.test(batch), `the orchestrator must not contain ${banned}`);
  }
  assert.ok(!/^import\s/m.test(code(CONTRACTS)), "the contracts are pure: no import at all");

  /* ── 2. NOTHING BUT THE OPERATIONS ACTIONS CALLS IT — not Heby, not a route, not a job ── */
  const callers = walk("src").filter((f) => f !== BATCH && /admitSuppliedDriveBatch\b|content-intake\/admit-supplied-drive-batch/.test(code(f)));
  assert.deepEqual(callers, [ACTIONS], "one human door; no machine principal reaches batch admission");
  for (const f of walk("src").filter((f) => /heby|agent|machine|scheduler|cron|api\//i.test(f))) {
    assert.ok(!/features\/content-intake\/admit/.test(code(f)), `${f} must not reach batch admission`);
  }

  /* ── 3. THE ACTIONS: kind by action, tenant by session, four fields and no more ── */
  const actions = code(ACTIONS);
  const slice = actions.slice(actions.indexOf("export async function admitSuppliedDriveImageBatchAction"), actions.indexOf("export async function listRevisionMediaVideosAction"));
  assert.match(slice, /admitSuppliedDriveBatch\("image", await resolveTenantContext\(\), batchInput\(input\)\)/);
  assert.match(slice, /admitSuppliedDriveBatch\("video", await resolveTenantContext\(\), batchInput\(input\)\)/);
  assert.ok(!/integrationId|connectionId|externalAccountId|tenantId|capability|\bkind\b|mimeType/.test(slice), "no field a client could choose authority with");
  assert.equal((slice.match(/i\.\w+/g) ?? []).filter((x, i, a) => a.indexOf(x) === i).sort().join(","), "i.artifactId,i.driveFileIds,i.pickerBinding,i.revisionNo");

  /* ── 4. THE CHOOSERS ── */
  const media = code(MEDIA_PICKER);
  assert.match(media, /enableFeature\(picker\.Feature\.MULTISELECT_ENABLED\)/, "the Media chooser multi-selects");
  assert.match(media, /setMaxItems\(session\.maxItems\)/, "up to a caller-given maximum");
  assert.ok(media.includes("setIncludeFolders(false)") && media.includes("setSelectFolderEnabled(false)"), "and never a folder");
  assert.ok(!/DocsUploadView|FOLDERS|SUPPORT_DRIVES|SIMPLE_UPLOAD|localStorage|sessionStorage/.test(media));
  const knowledge = code(KNOWLEDGE_PICKER);
  assert.ok(!knowledge.includes("MULTISELECT_ENABLED") && !knowledge.includes("setMaxItems"), "the Knowledge chooser is still one document");
  for (const door of DOORS) {
    const d = code(door);
    assert.match(d, /maxItems:\s*MAX/, `${door}: the chooser is told the server's bound`);
    assert.match(d, /const MAX = CONTENT_INTAKE_BATCH_LIMITS\.(image|video)\.maxFiles;/, `${door}: the bound comes from the one contract`);
    assert.match(d, /accessToken:\s*session\.accessToken/);
    assert.ok(!/admitSuppliedDrive(Image|Video)Action\(/.test(d), `${door}: the door no longer submits one file at a time`);
    assert.equal((d.match(/admitSuppliedDrive(Image|Video)BatchAction\(/g) ?? []).length, 1, `${door}: one batch call site`);
    assert.ok(!/useState[^\n]*accessToken|setAccessToken|localStorage|sessionStorage/.test(d), `${door}: no token kept`);
  }

  /* ── 5. THE COPY: no generic success, and custody is never called approval ── */
  const outcome = code(OUTCOME);
  assert.ok(!/\bSuccess(ful)?\b/.test(outcome), "no generic success word");
  assert.ok(outcome.includes("not reviewed, approved or published"), "admission is said to be custody only");
  assert.ok(outcome.includes("Only part of this batch was admitted"), "a partial batch says so");
  assert.match(outcome, /f\.status === "not-attempted"/, "only not-attempted files are resubmitted");
  assert.match(outcome, /result\.stoppedBy !== "time-budget"/, "and only after a time-budget stop");
  for (const word of ["Approved", "Published", "Selected for", "Ready to publish"]) assert.ok(!outcome.includes(word), `the outcome never says "${word}"`);

  /* ── 6. NO SCOPE, NO SCHEMA ── */
  for (const f of [BATCH, CONTRACTS, MEDIA_PICKER, OUTCOME, ...DOORS]) {
    assert.ok(!/auth\/drive(\.readonly|\.metadata)|GOOGLE_DRIVE_CONTENT_CAPABILITY|GOOGLE_DRIVE_METADATA/.test(raw(f)), `${f}: no wider Drive grant`);
  }
  const migrations = readdirSync("src/db/migrations").filter((f) => f.endsWith(".sql")).sort();
  assert.match(migrations.at(-1)!, /_sci2b_knowledge_integrity_at_insert\.sql$/, "no migration: a batch is orchestration over existing rows"); /* SCI-2A: the newest migration is now the Knowledge version-immutability triggers. */ /* EXTERNAL-AI-DATA-USE-1A: the newest migration is now the external-AI data-use authority. */ /* KT-3: the newest migration is now the knowledge-public-use domain; CONTENT-INTAKE-1 still authored none. */
  assert.ok(!walk("src/db/schema").some((f) => /intake|batch/i.test(f)), "no intake/batch table");

  console.log("content-intake-1 batch-firewall: ok");
}

main();
