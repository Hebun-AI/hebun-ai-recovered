/*
 * tests/youtube-write-2/boundaries-and-firewall.ts — YOUTUBE-WRITE-2's structural boundaries, read
 * as source: no second authority, no UI path to the transport, one ledger writer, readiness reused,
 * the narrowest scope, and exactly the approved schema change.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const walk = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : [],
  );

const TRANSPORT = "src/features/provider-google/google-transport.server.ts";
const EXECUTOR = "src/features/action-execution/execute-authorized-action.server.ts";
const PROPOSAL = "src/features/heby-action-inlet/youtube-publish-proposal.server.ts";
const RESOLVE = "src/features/youtube-publishing/resolve-youtube-publish.server.ts";
const MIGRATIONS = "src/db/migrations";

const files = walk("src");

/* 1 · The upload transport is reached from the executor only (read-back from its own seam) — never from UI. */
{
  const uploaders = files.filter((f) => f !== TRANSPORT && /openYouTubeUploadSession|sendYouTubeUploadBytes/.test(codeOnly(read(f))));
  assert.deepEqual(uploaders, [EXECUTOR], `only the executor reaches the upload transport: ${uploaders}`);
  const readers = files.filter((f) => f !== TRANSPORT && /\breadYouTubeVideo\b/.test(codeOnly(read(f))));
  /*
   * YOUTUBE-RECORDED-MEASUREMENT-1 added a SECOND reader of the same single-video transport: the
   * capability-gated read whose answer may be recorded. Still two server seams and never a surface.
   */
  assert.deepEqual(
    readers,
    ["src/features/provider-google/read-youtube-video-metrics.server.ts", "src/features/youtube-publishing/read-youtube-upload.server.ts"],
    `the read-back and the gated measurement read only: ${readers}`,
  );
  for (const f of files.filter((f) => f.endsWith(".tsx"))) {
    assert.ok(!/provider-google\/google-transport/.test(codeOnly(read(f))), `${f} cannot import the Google transport`);
  }
}

/* 2 · One writer of the attempt ledger. */
{
  const writers = files.filter((f) => /\.insert\(\s*actionExecutionAttempts\s*\)/.test(read(f)));
  assert.deepEqual(writers, [EXECUTOR], "execute-authorized-action stays the only attempt writer");
}

/* 3 · Readiness is the Content Package's; nothing recomputes it. */
{
  for (const f of [PROPOSAL, RESOLVE, EXECUTOR]) {
    const code = codeOnly(read(f));
    assert.ok(!/CONTENT_PACKAGE_BLOCKERS|copyReviewState\s*===/.test(code), `${f} does not re-derive readiness`);
  }
  assert.ok(/pkg\.ready/.test(codeOnly(read(PROPOSAL))) && /pkg\.ready/.test(codeOnly(read(RESOLVE))), "the package's own `ready` decides");
  assert.ok(/readContentPackage/.test(codeOnly(read(PROPOSAL))), "the proposal reads the Content Package authority");
}

/* 4 · The channel is re-read with the uploading token BEFORE the session is opened. */
{
  const code = codeOnly(read(EXECUTOR));
  const half = code.slice(code.indexOf("async function executeYouTubePublish"));
  const list = half.indexOf("await listChannels(token)");
  const open = half.indexOf("await openSession(input, token)");
  const send = half.indexOf("await sendBytes(");
  assert.ok(list > 0 && open > list && send > open, "channels → session → bytes, in that order, in one token spend");
  assert.ok(/channelId !== payload\.expectedChannelId/.test(half), "a different channel is refused");
  assert.ok(half.indexOf("readChannel") < half.indexOf("consumeActionPermit"), "and a pre-flight channel check precedes the spend");
  /* no retry loop around the upload in the executor */
  assert.ok(!/for\s*\(|while\s*\(/.test(half), "the executor never loops an upload");
}

/* 5 · The upload block of the transport: one host, no log, exactly one session POST. */
{
  const code = codeOnly(read(TRANSPORT));
  const block = code.slice(code.indexOf("export interface YouTubeUploadInput"), code.indexOf("export async function readDriveFileImage"));
  assert.ok(block.length > 0);
  assert.ok(!/console\./.test(block), "the upload transport logs nothing");
  assert.equal((block.match(/method:\s*"POST"/g) ?? []).length, 1, "exactly one POST: the one session");
  assert.ok(/location\.startsWith\(`\$\{GOOGLE_YOUTUBE_UPLOAD_ENDPOINT\}\?`\)/.test(block), "the session URI must be Google's upload endpoint");
}

/* 6 · The narrowest scope; nothing wider anywhere in src. */
for (const f of files) {
  const code = codeOnly(read(f));
  for (const banned of ["auth/youtube.force-ssl", "auth/youtubepartner"]) {
    assert.equal(code.includes(banned), false, `${f} must not contain ${banned}`);
  }
  assert.equal(/["']https:\/\/www\.googleapis\.com\/auth\/youtube["']/.test(code), false, `${f} must not request the full youtube scope`);
}

/* 7 · Exactly the approved schema change: migration 68 widens one CHECK and nothing else. */
{
  const sqlFiles = readdirSync(path.join(ROOT, MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort();
  assert.equal(sqlFiles.length, 70, "ledger 70"); /* SUPPLIED-MEDIA-ACCOUNT-PROVENANCE-1: ledger 68 -> 69 (media_assets.supplied_source_integration_id: one nullable column, one composite FK, one CHECK; additive). */  /* KT-3: ledger 69 -> 70 (governance_domain += 'knowledge-public-use': one ALTER TYPE ... ADD VALUE; additive). */
  /* Found by name, not "the newest file" — SUPPLIED-MEDIA-ACCOUNT-PROVENANCE-1 holds the newest line now. */
  const last = sqlFiles.find((f) => /youtube_write2_recipientless_kind\.sql$/.test(f))!;
  assert.equal(sqlFiles.indexOf(last), 67, "migration 68 is YOUTUBE-WRITE-2's");
  const sql = read(path.join(MIGRATIONS, last));
  const statements = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  assert.equal(statements.length, 2, "drop + re-add, nothing more");
  assert.match(statements[0]!, /^ALTER TABLE "action_execution_attempts" DROP CONSTRAINT "action_execution_attempts_recipient_binding_chk";$/);
  assert.match(statements[1]!, /in \('publish-instagram-media', 'publish-youtube-video'\)/);
  assert.ok(!/CREATE TABLE|ADD COLUMN|CREATE TYPE|ALTER TYPE/.test(sql));
}

/* 8 · No new authority: the capability lives on the existing Google connection family. */
{
  const catalog = codeOnly(read("src/features/provider-catalog/catalog.ts"));
  assert.equal((catalog.match(/providerKey: "google-/g) ?? []).length, 2, "still exactly two Google connection definitions");
}

console.log("PASS youtube-write-2 boundaries and firewall");
