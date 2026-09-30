/*
 * tests/instagram-approval-preview-1/bite-proofs.ts — every guarantee this phase adds is mutated in
 * the SHIPPED SOURCE, and the suite defending it must fail FOR THE INTENDED REASON.
 *
 * Per mutation: it applies exactly once, it reached disk, the defending suite failed and its output
 * names the intended reason. Restoration runs in `finally` and is verified byte-identical; at the
 * end every touched file is re-hashed against its pre-run digest. Only the CHILD suite has a
 * timeout; this process is never killed with a mutation on disk, and a timed-out child is VOID.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SUITE = "tests/instagram-approval-preview-1/preview-postgres.ts";
const FIREWALL = "tests/instagram-approval-preview-1/preview-firewall.ts";
const PREVIEW = "src/features/instagram-publishing/approval-preview.server.ts";
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;

interface Mutation {
  readonly label: string;
  readonly apply: (text: string) => string;
  readonly suite: string;
  readonly expect: RegExp;
}

const once = (text: string, find: string, replace: string) => {
  assert.equal(text.split(find).length - 1, 1, `find-string must occur exactly once: ${find.slice(0, 90)}`);
  return text.replace(find, replace);
};
const OPEN = "export async function openInstagramApprovalImage";
/** Apply a replacement inside the open function only. */
const inOpen = (text: string, find: string, replace: string) => {
  const i = text.indexOf(OPEN);
  assert.ok(i > 0, "open function present");
  return text.slice(0, i) + once(text.slice(i), find, replace);
};

const MUTATIONS: readonly Mutation[] = [
  {
    label: "M1 tenant predicate removed from the request read",
    apply: (t) => once(t, "        eq(hebyActionRequests.tenantId, tenantId),\n", ""),
    suite: SUITE,
    expect: /not-found|Globex sees none/,
  },
  {
    label: "M2 governed revision replaced with the CURRENT revision",
    apply: (t) =>
      once(
        once(
          t,
          "    const resolved = await resolveWorkArtifactReference(tenant, payload.draftRef, deps);",
          "    const governed = await resolveWorkArtifactReference(tenant, payload.draftRef, deps);\n    const resolved = governed.artifact ? await resolveWorkArtifactReference(tenant, `work-artifact/${ref.artifactId}@${governed.artifact.currentRevision}`, deps) : governed;",
        ),
        "resolved.revision.revisionNo === ref.revisionNo && ",
        "",
      ),
    suite: SUITE,
    expect: /B: still revision 1/,
  },
  {
    label: "M3 governed image replaced with the CURRENTLY SELECTED image (grant path)",
    apply: (t) => {
      const withSql = once(t, 'import { and, desc, eq } from "drizzle-orm";', 'import { and, desc, eq, sql } from "drizzle-orm";');
      const injected = inOpen(
        withSql,
        '  if (!payload || !ref) return { status: "refused", reason: "payload-unreadable" };\n',
        '  if (!payload || !ref) return { status: "refused", reason: "payload-unreadable" };\n  const currentRows = (await db.execute(sql`select media_asset_id from content_selected_media where tenant_id=${tenant.tenantId} and artifact_id=${ref.artifactId} order by selected_at desc limit 1`)) as unknown as { rows: { media_asset_id: string }[] };\n  const currentAssetId = currentRows.rows[0]?.media_asset_id ?? payload.mediaAssetRef;\n  const currentAsset = await selectMediaAssetRecord(db, tenant.tenantId, currentAssetId);\n  const governedPayload = { ...payload, mediaAssetRef: currentAssetId, mediaAssetDigest: currentAsset?.byteDigest ?? payload.mediaAssetDigest };\n',
      );
      const i = injected.indexOf(OPEN);
      return injected.slice(0, i) + injected.slice(i).split("payload.mediaAsset").join("governedPayload.mediaAsset").replace("const governedPayload = { ...governedPayload,", "const governedPayload = { ...payload,").replace("?? governedPayload.mediaAssetRef;", "?? payload.mediaAssetRef;").replace("?? governedPayload.mediaAssetDigest };", "?? payload.mediaAssetDigest };");
    },
    suite: SUITE,
    expect: /C: the grant is X, never the newly selected Y/,
  },
  {
    label: "M4 revision digest validation skipped",
    apply: (t) =>
      once(
        t,
        "      const proven =\n        contentDigestsMatch(resolved.revision.contentDigest, payload.draftRevisionDigest) &&\n        contentDigestsMatch(digestArtifactContent(resolved.revision.content), payload.draftRevisionDigest);",
        "      const proven = true;",
      ),
    suite: SUITE,
    expect: /G: no caption shown/,
  },
  {
    label: "M5 media digest validation skipped (preview and grant)",
    apply: (t) =>
      inOpen(
        once(t, '      if (asset.byteDigest !== payload.mediaAssetDigest) image = { status: "digest-mismatch" };\n      else ', "      "),
        '  if (row0.byteDigest !== payload.mediaAssetDigest) return { status: "refused", reason: "digest-mismatch" };\n',
        "",
      ).replace('  if (read.asset.byteDigest !== payload.mediaAssetDigest) return { status: "refused", reason: "digest-mismatch" };\n', ""),
    suite: SUITE,
    expect: /F: mismatch, not a picture/,
  },
  {
    label: "M6 the projection reaches a writer",
    apply: (t) =>
      once(
        t,
        'import { verifyInstagramPackageReadiness, type InstagramPackageFailure } from "./verify-instagram-package.server";\n',
        'import { verifyInstagramPackageReadiness, type InstagramPackageFailure } from "./verify-instagram-package.server";\nimport { approveActionRequest } from "@/features/action-authorization/decide-action-request.server";\nvoid approveActionRequest;\n',
      ),
    suite: FIREWALL,
    expect: /approval preview imports|must not reach approveActionRequest/,
  },
];

function run(suite: string): { ok: boolean; output: string; timedOut: boolean } {
  const r = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: CHILD_TIMEOUT_MS,
  });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}`, timedOut: r.signal === "SIGTERM" && r.status === null };
}

const digest = () => createHash("sha256").update(readFileSync(path.join(ROOT, PREVIEW))).digest("hex");

function main(): void {
  const before = digest();
  for (const s of [SUITE, FIREWALL]) {
    const base = run(s);
    assert.equal(base.ok, true, `baseline ${s} must pass before any mutation:\n${base.output.slice(-2000)}`);
  }
  const file = path.join(ROOT, PREVIEW);
  for (const m of MUTATIONS) {
    const original = readFileSync(file);
    const text = original.toString("utf8");
    try {
      writeFileSync(file, m.apply(text));
      assert.notEqual(readFileSync(file, "utf8"), text, `${m.label}: mutation reached disk`);
      const r = run(m.suite);
      assert.equal(r.timedOut, false, `${m.label}: the defending suite TIMED OUT — a VOID result, not a bite`);
      assert.equal(r.ok, false, `${m.label}: the mutation SURVIVED — ${m.suite} still passed`);
      assert.match(r.output, m.expect, `${m.label}: failed, but not for the intended reason:\n${r.output.slice(-1500)}`);
      console.log(`BITE ${m.label}`);
    } finally {
      writeFileSync(file, original);
      assert.ok(readFileSync(file).equals(original), `${m.label}: restoration is byte-identical`);
    }
  }
  assert.equal(digest(), before, `${PREVIEW}: byte-identical to its pre-run state`);
  console.log(`BYTE-IDENTICAL ${path.basename(PREVIEW)}=${before.slice(0, 12)}`);
  console.log(`instagram-approval-preview-1/bite-proofs: ${MUTATIONS.length} mutations bit`);
}

main();
