/*
 * CONTENT-PUBLISH-FROM-PACKAGE-1 — the package wrapper's contract with faked seams, and the boundary
 * of the new /operations control. No database, no network.
 *
 *   1 · the wrapper hands the released dispatcher exactly the package's chosen medium and the human's
 *       YouTube declarations, and passes refusals (with the prior attempt id) through unchanged
 *   2 · the action takes its tenant from the session and supplies no medium, actor or tenant
 *   3 · the control and the action are not Media doors; the panel shows the control only when READY
 *   4 · the wrapper writes nothing itself and reaches no permit, execution, model or agent seam
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { proposePackagePublication } from "../../src/features/heby-action-inlet/package-publication-proposal.server";
import type { ContentPackageResult } from "../../src/features/content-composition/read-content-package.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const WRAPPER = "src/features/heby-action-inlet/package-publication-proposal.server.ts";
const ACTION = "src/app/(dashboard)/operations/publication-actions.ts";
const CONTROL = "src/components/operations-preparation/propose-publication.tsx";
const PANEL = "src/components/operations-preparation/content-package-panel.tsx";

const ART = "11111111-1111-4111-8111-111111111111";
const IMG = "22222222-2222-4222-8222-222222222222";
const IMG2 = "33333333-3333-4333-8333-333333333333";
const VID = "44444444-4444-4444-8444-444444444444";
const PRIOR = "55555555-5555-4555-8555-555555555555";
const tenant = { tenantId: "t", userId: "u" } as unknown as TenantContext;

type Selected = { mediaAssetId: string; mediaKind: "image" | "video"; lifecycle: string };
const pkg = (destination: string, selected: Selected[], ready = true, reviews: Record<string, string> = {}): ContentPackageResult =>
  ({
    status: "read",
    package: {
      artifactId: ART,
      revisionNo: 3,
      title: "T",
      destination,
      copy: "C",
      copyReviewState: "approved",
      selected,
      mediaReviewStates: Object.fromEntries(selected.map((s) => [s.mediaAssetId, reviews[s.mediaAssetId] ?? "approved"])),
      blockers: ready ? [] : ["copy-unreviewed"],
      ready,
    },
  }) as unknown as ContentPackageResult;

async function contract(): Promise<void> {
  const calls: unknown[] = [];
  const base = (result: ContentPackageResult) => ({
    readPackage: (async () => result) as never,
    propose: (async (command: { commandId: string; args: readonly string[] }, d: { resolveTenant: () => Promise<unknown> }) => {
      calls.push([command.commandId, command.args, await d.resolveTenant()]);
      return command.commandId === "publish"
        ? { status: "ok", kind: "publish-instagram", result: { status: "proposed", requestId: "r-ig" } }
        : { status: "ok", kind: "publish-youtube", result: { status: "proposed", requestId: "r-yt", channelId: "c", channelTitle: "Channel" } };
    }) as never,
  });

  /* Instagram: the one approved image, the revision's ref, nothing else. */
  const ig = await proposePackagePublication(
    tenant,
    { artifactId: ART, revisionNo: 3 },
    base(pkg("instagram", [{ mediaAssetId: IMG, mediaKind: "image", lifecycle: "admitted" }, { mediaAssetId: VID, mediaKind: "video", lifecycle: "admitted" }])),
  );
  assert.deepEqual(ig, { status: "proposed", destination: "instagram", requestId: "r-ig" });
  assert.deepEqual(calls.pop(), ["publish", [`work-artifact/${ART}@3`, IMG], tenant], "exactly `/publish <revision> <the image the package chose>`, as the session's tenant");

  /* YouTube: the one approved video and the human's four declarations, verbatim. */
  const yt = await proposePackagePublication(
    tenant,
    { artifactId: ART, revisionNo: 3, youtube: { privacyStatus: "private", categoryId: "22", madeForKids: "no", syntheticMedia: "yes" }, acknowledgesPriorAttemptId: PRIOR },
    base(pkg("youtube", [{ mediaAssetId: VID, mediaKind: "video", lifecycle: "admitted" }])),
  );
  assert.deepEqual(yt, { status: "proposed", destination: "youtube", requestId: "r-yt", channelTitle: "Channel" });
  assert.deepEqual(calls.pop(), ["publish-youtube", [`work-artifact/${ART}@3`, VID, "private", "22", "no", "yes", PRIOR], tenant], "exactly `/publish-youtube` in its argument order");

  /* Refusals before the inlet: each one calls nothing. */
  const before = calls.length;
  const refusal = async (label: string, run: Promise<unknown>, reason: string) => {
    const r = (await run) as { status: string; reason?: string };
    assert.equal(r.status === "refused" && r.reason, reason, `${label}: ${JSON.stringify(r)}`);
  };
  await refusal("no session", proposePackagePublication(null, { artifactId: ART, revisionNo: 3 }, base(pkg("instagram", []))), "unauthenticated");
  await refusal("bad artifact", proposePackagePublication(tenant, { artifactId: "x", revisionNo: 3 }, base(pkg("instagram", []))), "invalid-input");
  await refusal("bad ack", proposePackagePublication(tenant, { artifactId: ART, revisionNo: 3, acknowledgesPriorAttemptId: "x" }, base(pkg("instagram", []))), "invalid-input");
  await refusal("unreadable", proposePackagePublication(tenant, { artifactId: ART, revisionNo: 3 }, base({ status: "unavailable", reason: "persistence-unavailable" })), "persistence-unavailable");
  await refusal("not found", proposePackagePublication(tenant, { artifactId: ART, revisionNo: 3 }, base({ status: "not-found" })), "draft-not-found");
  await refusal("no destination", proposePackagePublication(tenant, { artifactId: ART, revisionNo: 3 }, base(pkg("internal", []))), "destination-not-publishable");
  await refusal("not ready", proposePackagePublication(tenant, { artifactId: ART, revisionNo: 3 }, base(pkg("instagram", [{ mediaAssetId: IMG, mediaKind: "image", lifecycle: "admitted" }], false))), "package-not-ready");
  await refusal("no image", proposePackagePublication(tenant, { artifactId: ART, revisionNo: 3 }, base(pkg("instagram", [{ mediaAssetId: VID, mediaKind: "video", lifecycle: "admitted" }]))), "no-publishable-media");
  await refusal("unapproved image", proposePackagePublication(tenant, { artifactId: ART, revisionNo: 3 }, base(pkg("instagram", [{ mediaAssetId: IMG, mediaKind: "image", lifecycle: "admitted" }], true, { [IMG]: "unreviewed" }))), "no-publishable-media");
  await refusal("two images", proposePackagePublication(tenant, { artifactId: ART, revisionNo: 3 }, base(pkg("instagram", [{ mediaAssetId: IMG, mediaKind: "image", lifecycle: "admitted" }, { mediaAssetId: IMG2, mediaKind: "image", lifecycle: "admitted" }]))), "media-choice-ambiguous");
  await refusal("youtube without declarations", proposePackagePublication(tenant, { artifactId: ART, revisionNo: 3 }, base(pkg("youtube", [{ mediaAssetId: VID, mediaKind: "video", lifecycle: "admitted" }]))), "invalid-input");
  assert.equal(calls.length, before, "no refusal above reached an inlet");

  /* The inlet's refusal passes through, and DUPLICATE-GUARD-1's attempt id is surfaced for an explicit retry. */
  const passed = await proposePackagePublication(tenant, { artifactId: ART, revisionNo: 3 }, {
    ...base(pkg("instagram", [{ mediaAssetId: IMG, mediaKind: "image", lifecycle: "admitted" }])),
    propose: (async () => ({ status: "ok", kind: "publish-instagram", result: { status: "refused", reason: "prior-publication-unacknowledged", detail: `latest-attempt=${PRIOR}` } })) as never,
  });
  assert.deepEqual(passed, { status: "refused", reason: "prior-publication-unacknowledged", detail: `latest-attempt=${PRIOR}`, priorAttemptId: PRIOR });
  /* The dispatcher's own refusals keep their meaning. */
  const viaRegistry = await proposePackagePublication(tenant, { artifactId: ART, revisionNo: 3 }, {
    ...base(pkg("instagram", [{ mediaAssetId: IMG, mediaKind: "image", lifecycle: "admitted" }])),
    propose: (async () => ({ status: "refused", reason: "not-proposable" })) as never,
  });
  assert.deepEqual(viaRegistry, { status: "refused", reason: "not-proposable" });
}

function boundaries(): void {
  /* 2 · the action: session tenant, a pass-through, revalidation only after a filed request. */
  const action = codeOf(read(ACTION));
  assert.match(read(ACTION), /^"use server";/, "a server action file");
  assert.match(action, /const tenant = await resolveTenantContext\(\);/, "the tenant is the session's");
  assert.match(action, /proposePackagePublication\(tenant, \{/, "and is handed to the wrapper");
  assert.equal((action.match(/export async function /g) ?? []).length, 1, "exactly one action");
  for (const banned of ["tenantId", "userId", "actorType", "agentId", "mediaAsset", "videoAsset", "recordActionRequest", "action-execution", "approveActionRequest", "consumeActionPermit"]) {
    assert.ok(!action.includes(banned), `the action names no ${banned}`);
  }
  assert.match(action, /if \(result\.status === "proposed"\) \{\s*revalidatePath\("\/operations"\);\s*revalidatePath\("\/approvals"\);/);

  /* 3 · the control: one action, no Media naming (it is not a Media door), no automatic dispatch. */
  const control = codeOf(read(CONTROL));
  assert.match(control, /import \{ proposePackagePublicationAction \} from "@\/app\/\(dashboard\)\/operations\/publication-actions";/);
  assert.ok(!/media[-_]?asset|mediaAsset|requestMediaGeneration/i.test(control), "the control is not a Media door");
  assert.ok(!/media[-_]?asset|mediaAsset|requestMediaGeneration/i.test(action), "nor is the action");
  assert.ok(!/setTimeout|setInterval|useEffect/.test(control), "nothing dispatches on its own; only a human click does");
  assert.equal((control.match(/proposePackagePublicationAction\(/g) ?? []).length, 1, "one call site");
  for (const banned of ["@/db/", "drizzle-orm", "heby-action-inlet/instagram", "heby-action-inlet/youtube", "action-authorization", "action-execution", "tenantId"]) {
    assert.ok(!control.includes(banned), `the control reaches no ${banned}`);
  }
  for (const line of control.split("\n").filter((l) => l.includes("package-publication-proposal.server"))) {
    assert.ok(/^\s*\}\s*from |^\s*import type /.test(line), `the control names the wrapper only by type: ${line.trim()}`);
  }
  assert.match(control, /useState\("private"\)/, "YouTube privacy starts at the most restrictive value");
  assert.match(control, /useState\(""\);\n\s*const \[madeForKids/, "the category is never defaulted");

  /* The panel renders the control only for a READY Instagram or YouTube package. */
  const panel = codeOf(read(PANEL));
  assert.match(panel, /\{pkg\.ready && \(pkg\.destination === "instagram" \|\| pkg\.destination === "youtube"\) \? \(\s*<ProposePublication /);
  assert.equal((panel.match(/<ProposePublication /g) ?? []).length, 1, "once");
  assert.ok(!/recordActionRequest|action-execution|heby-action-inlet/.test(panel.replace(/"@\/features\/action-authorization\/content-publication-state(?:\.server)?"/g, '""')), "the panel itself reaches no act authority");

  /* 4 · the wrapper: delegates to the two released inlets, writes nothing, reaches no permit or model. */
  const wrapper = codeOf(read(WRAPPER));
  for (const banned of ["recordActionRequest", "action-execution", "consumeActionPermit", "approveActionRequest", "@/db/", "drizzle-orm", ".insert(", ".update(", "agent-origination", "heby-answer", "fetch("]) {
    assert.ok(!wrapper.includes(banned), `the wrapper reaches no ${banned}`);
  }
  assert.match(wrapper, /\(deps\.propose \?\? runHebyProposeCommand\)\(command, \{ \.\.\.deps, resolveTenant: async \(\) => tenant \}\)/, "through the released dispatcher, as the session's tenant");
  assert.ok(!/instagram-publish-proposal|youtube-publish-proposal/.test(read(WRAPPER)), "never past the dispatcher to an inlet");
}

async function main(): Promise<void> {
  await contract();
  boundaries();
  console.log("PASS content-publish-from-package-1 contract and firewall");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
