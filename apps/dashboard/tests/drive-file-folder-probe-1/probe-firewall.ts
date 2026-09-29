/*
 * DRIVE-FILE-FOLDER-PROBE-1 (TEMPORARY) — the probe can only READ, only through the Picker-bound
 * connection, only under the released per-file capability, and reaches nothing consequential.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { runDriveFolderProbe } from "../../src/features/provider-google/drive-file-folder-probe.server";

const ROOT = process.cwd();
const strip = (c: string) => c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const code = (f: string) => strip(readFileSync(path.join(ROOT, f), "utf8"));
const importsOf = (c: string) => [...c.matchAll(/from "([^"]+)"/g)].map((m) => m[1]!).sort();
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = path.join(d, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [path.relative(ROOT, p)] : [];
  });

const PROBE = "src/features/provider-google/drive-file-folder-probe.server.ts";
const DIR = "src/app/(dashboard)/operations/drive-file-probe";
const ACTIONS = `${DIR}/actions.ts`;
const CLIENT = `${DIR}/probe-client.tsx`;
const PAGE = `${DIR}/page.tsx`;

async function main(): Promise<void> {
  /* ── 1. EXACT REACH ── */
  assert.deepEqual(importsOf(code(PROBE)), [
    "./contracts",
    "./google-authorized-call.server",
    "./picker-connection-binding.server",
    "@/features/auth/tenant/tenant-context",
  ]);
  assert.deepEqual(importsOf(code(ACTIONS)), [
    "@/features/auth-runtime/request-session.server",
    "@/features/provider-content-admission/authorize-picker-session.server",
    "@/features/provider-google/drive-file-folder-probe.server",
  ]);
  assert.deepEqual(importsOf(code(CLIENT)), ["./actions", "@/components/knowledge-workspace/google-picker.client", "@/components/ui/button", "react"]);
  assert.deepEqual(importsOf(code(PAGE)), ["./probe-client"]);

  /* ── 2. READ-ONLY: every request is a GET to Drive files/changes; no write verb, no other endpoint ── */
  const probe = code(PROBE);
  assert.ok(!/\b(POST|PUT|PATCH|DELETE)\b/.test(probe), "no write verb");
  assert.equal((probe.match(/method:\s*"GET"/g) ?? []).length, (probe.match(/doFetch\(/g) ?? []).length, "every fetch is a GET");
  assert.deepEqual([...probe.matchAll(/https:\/\/[^"`]+/g)].map((m) => m[0]), ["https://www.googleapis.com/drive/v3/changes"], "the only literal endpoint besides the files endpoint constant");
  for (const banned of [/upload/i, /permissions/, /\/copy/, /\/export/, /watch/, /\binsert\(|\.update\(|\.delete\(/, /getDb|drizzle|schema/, /localStorage|sessionStorage/]) {
    assert.ok(!banned.test(probe), `probe must not contain ${banned}`);
  }
  assert.match(probe, /resolveBoundDriveFileConnection\(tenant, input\.binding\)/, "the connection comes from the signed binding");
  assert.match(probe, /withGoogleAccessToken\(tenant, bound\.integrationId,/, "and the token from exactly that connection");
  assert.ok(!/sources\.find|readAvailable/.test(probe), "never a first-available connection");

  /* ── 3. NOTHING CONSEQUENTIAL, NO SCOPE ── */
  for (const f of [PROBE, ACTIONS, CLIENT, PAGE]) {
    const c = code(f);
    for (const banned of [/media-assets|media-asset-review|content-composition|content-intake/, /governance|action-execution|heby|external-send|permit/i, /media-generation|openai|higgsfield/i, /knowledge-authoring|admit-provider-document/, /SCOPE|auth\/drive/]) {
      assert.ok(!banned.test(c), `${f} must not reach ${banned}`);
    }
  }
  assert.ok(!/useState[^\n]*accessToken|setAccessToken/.test(code(CLIENT)), "the client keeps no token");

  /* ── 4. HIDDEN, NO SCHEMA, NO SCOPE MAP CHANGE ── */
  const linkers = walk("src").filter((f) => !f.startsWith(DIR) && /drive-file-probe/.test(code(f)));
  assert.deepEqual(linkers, [], "no navigation entry points at the probe");
  const diff = execFileSync("git", ["diff", "--name-only", "origin/main", "--", "src/db", "src/features/provider-google/contracts.ts", "src/middleware.ts"], { encoding: "utf8" }).trim();
  assert.equal(diff, "", "no schema, migration, scope-map or middleware change");

  /* ── 5. REFUSES BEFORE ANY NETWORK ── */
  const noNet = (() => {
    throw new Error("NETWORK REACHED");
  }) as never;
  assert.deepEqual(await runDriveFolderProbe(null, { step: "baseline", binding: "x", folderId: "abc" }, { fetchImpl: noNet }), { status: "refused", reason: "unauthenticated" });
  const t = { tenantId: "t", userId: "u", sessionContextId: "s" } as never;
  assert.deepEqual(await runDriveFolderProbe(t, { step: "baseline", binding: "x", folderId: "../etc" }, { fetchImpl: noNet }), { status: "refused", reason: "invalid-input" });
  assert.deepEqual(await runDriveFolderProbe(t, { step: "later", binding: "x", folderId: "abc", startPageToken: "a b" }, { fetchImpl: noNet }), { status: "refused", reason: "invalid-input" });
  assert.deepEqual(await runDriveFolderProbe(t, { step: "later", binding: "x", folderId: "abc", startPageToken: "12", outsideFileId: "x/y" }, { fetchImpl: noNet }), { status: "refused", reason: "invalid-input" });

  console.log("drive-file-folder-probe-1 probe-firewall: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
