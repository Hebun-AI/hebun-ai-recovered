/*
 * INSTAGRAM-APPROVAL-PREVIEW-1 — structural boundaries, read as source.
 *
 *   the projection's imports are pinned: legitimate READERS only · it writes nothing, decides nothing,
 *   mints/spends/executes/arms nothing and reaches no provider or network · it re-derives no readiness
 *   (the Content Package verifier answers) · it resolves the GOVERNED references from the payload ·
 *   the image grant is keyed by REQUEST id, never by an asset id from the browser · the surface
 *   component holds no store and renders the preview BEFORE the decision controls, only for the
 *   Instagram kind · Action Authorization still does not depend on the Work Artifact feature.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const walk = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : [],
  );

const PREVIEW = "src/features/instagram-publishing/approval-preview.server.ts";
const COMPONENT = "src/components/decision-workspace/instagram-approval-preview.tsx";
const CARD = "src/components/decision-workspace/action-authorizations.tsx";
const PAGE = "src/app/(dashboard)/approvals/page.tsx";
const ACTIONS = "src/app/(dashboard)/approvals/actions.ts";

/* 1 · Pinned imports: readers and types only. */
{
  const code = codeOnly(read(PREVIEW));
  const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    imports,
    [
      "./contracts",
      "./verify-instagram-package.server",
      "@/db/client.server",
      "@/db/schema/action-authorization",
      "@/features/action-authorization/content-publication-state.server",
      "@/features/auth/tenant/tenant-context",
      "@/features/content-composition/contracts",
      "@/features/governance-decision/persistence.server",
      "@/features/integration-authority/integration-repository.server",
      "@/features/media-assets/media-object-store",
      "@/features/media-assets/read-media-assets.server",
      "@/features/media-assets/read-publish-derivative.server",
      "@/features/work-artifacts/artifact-ref",
      "@/features/work-artifacts/content-digest",
      "@/features/work-artifacts/read-work-artifacts.server",
      "drizzle-orm",
    ].sort(),
    `approval preview imports: ${imports}`,
  );
  for (const verb of [".insert(", ".update(", ".delete(", ".execute(", "transaction("]) {
    assert.ok(!code.includes(verb), `the preview must not ${verb}`);
  }
  for (const forbidden of [
    "approveActionRequest", "rejectActionRequest", "withdraw", "revokeActionPermit", "issuePermit",
    "consumeActionPermit", "executeAuthorizedAction", "recordActionRequest", "resolveExternalSendReachability",
    "armTenant", "withAuthorizedInstagramToken", "publishInstagramImage", "readPublishDerivative(",
    "provider-instagram", "fetch(", "process.env", "selectMediaForRevision", "acceptMediaAsset",
    "declineMediaAsset", "acceptArtifactRevision", "CONTENT_PACKAGE_BLOCKERS", "readContentPackage",
  ]) {
    assert.ok(!code.includes(forbidden), `the preview must not reach ${forbidden}`);
  }
  /* Governed references come from the frozen payload, never from "current" state. */
  assert.ok(/resolveWorkArtifactReference\(tenant, payload\.draftRef,/.test(code), "the caption is the payload's revision");
  assert.ok(/selectMediaAssetRecord\(db, tenantId, payload\.mediaAssetRef\)/.test(code), "the image row is the payload's original");
  assert.ok(/digestArtifactContent\(resolved\.revision\.content\), payload\.draftRevisionDigest/.test(code), "caption bytes re-hashed against the frozen digest");
  assert.ok(/eq\(hebyActionRequests\.tenantId, tenantId\)/.test(code), "every request read is tenant-predicated");
  assert.ok(/eq\(hebyActionRequests\.actionKind, PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND\)/.test(code), "only this kind");
  /* No grant is minted at page load: the verified read (and its grant) is only in the open function. */
  const openAt = code.indexOf("export async function openInstagramApprovalImage");
  assert.ok(openAt > 0 && code.indexOf("readMediaAsset(") > openAt, "readMediaAsset is reached only from the open function");
  const open = code.slice(openAt);
  assert.ok(open.indexOf("row0.byteDigest !== payload.mediaAssetDigest") < open.indexOf("readMediaAsset("), "the digest is compared before any grant exists");
}

/* 2 · Who may import it: the Approvals page and action, and the surface for TYPES only. */
{
  const importers = walk("src").filter((f) => f !== PREVIEW && /instagram-publishing\/approval-preview\.server/.test(codeOnly(read(f)))).sort();
  assert.deepEqual(importers, [ACTIONS, PAGE, CARD, COMPONENT].sort(), `importers: ${importers}`);
  for (const f of [CARD, COMPONENT]) {
    const lines = codeOnly(read(f)).split("\n").join(" ");
    const imports = [...lines.matchAll(/import\s+(type\s+)?[^;]*?from\s+"@\/features\/instagram-publishing\/approval-preview\.server"/g)];
    assert.ok(imports.length > 0 && imports.every((m) => m[1]), `${f} imports the preview for TYPES only`);
  }
  /* Heby / agent code does not reach it. */
  for (const f of walk("src")) {
    if (!/^src\/features\/(heby-[a-z-]+|agent[a-z-]*)\//.test(f)) continue;
    assert.ok(!/approval-preview/.test(read(f)), `${f}: Heby does not reach the approval preview`);
  }
}

/* 3 · The image action takes a REQUEST id and nothing else, and is a read. */
{
  const code = codeOnly(read(ACTIONS));
  const fn = code.slice(code.indexOf("export async function openInstagramApprovalImageAction"));
  const head = fn.slice(0, fn.indexOf("}\n") + 2);
  assert.ok(/input: \{ readonly requestId: string \}/.test(head), "the action's only input is a request id");
  assert.ok(/openInstagramApprovalImage\(await resolveTenantContext\(\)/.test(head), "tenant from the session");
  assert.ok(!/revalidatePath|approve|execute|revoke|reject/.test(head), "it changes nothing");
}

/* 4 · The surface: no store, no provider; rendered only for Instagram; before any control. */
{
  const comp = codeOnly(read(COMPONENT));
  for (const banned of ["@/db/", "drizzle-orm", "fetch(", "readMediaAsset", "getControlPlaneDb", "provider-instagram"]) {
    assert.ok(!comp.includes(banned), `the component must not reach ${banned}`);
  }
  assert.ok(/openInstagramApprovalImageAction\(\{ requestId \}\)/.test(comp), "the image is opened by request id");
  const card = codeOnly(read(CARD));
  const gate = card.indexOf("item.actionKind === PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND ? (");
  const render = card.indexOf("<InstagramApprovalPreview requestId=");
  const control = card.indexOf("Authorize this action", card.indexOf("function RequestCard"));
  assert.ok(gate > 0 && render > gate, "rendered only for the Instagram kind");
  assert.ok(control > render, "the preview precedes the decision control");
  /* Not hidden in a disclosure. */
  const before = card.slice(card.lastIndexOf("<details", render), render);
  assert.ok(card.lastIndexOf("<details", render) < 0 || before.includes("</details>"), "the preview is not inside a <details>");
}

/* 5 · Action Authorization still does not depend on the Work Artifact feature (R3W). */
for (const f of walk("src/features/action-authorization")) {
  assert.ok(!/work-artifacts/.test(read(f)), `${f} must not depend on R3W`);
}

console.log("PASS instagram-approval-preview-1 preview firewall");
