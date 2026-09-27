/*
 * tests/heby-media-1/content-media-firewall.ts — HEBY-MEDIA-1.
 *
 * `content-media` is a Heby source class that SHAPES released reads and owns nothing. This pins:
 *   1. the class exists through the released source-class architecture, on Operations only;
 *   2. the shaper imports exactly the named readers and no writer, store read or grant;
 *   3. tenant comes only from the context passed in, and reaches every reader unchanged;
 *   4. store/provider material never reaches an evidence item;
 *   5. the answer flow substitutes the read, removes no evidence, and degrades on failure.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CONTENT_MEDIA_PROVENANCE,
  readContentMediaGroundingSource,
  type ContentMediaSourceDeps,
} from "../../src/features/content-composition/heby-content-media-source.server";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration";
import { HEBY_PROFILED_WORKSPACES, getHebyWorkspaceProfile } from "../../src/features/heby-integration/workspace-registry";
import { resolveSource } from "../../src/features/heby-runtime/source-resolver";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import type { SourceResolution } from "../../src/features/heby-runtime";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const SOURCE_PATH = "src/features/content-composition/heby-content-media-source.server.ts";
const source = readFileSync(path.join(process.cwd(), SOURCE_PATH), "utf8");
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const TENANT = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
} as unknown as TenantContext;

const DRAFT = "57b57106-2848-41f7-a5b3-d2475e0b7dba";
const OTHER = "99999999-9999-4999-8999-999999999999";
const IMG = "3f7b9e66-b165-86df-ab9b-77fcc7d36f14";
const GEN_IMG = "44444444-4444-4444-8444-444444444444";
const VID = "ad4978da-0839-44df-af28-411c55ab84b0";
const OLD_VID = "c3eb1139-08b8-4962-b1de-c1b9844d485e";
const INV = "a0d5ba5d-7804-44bc-a1f8-6bd620b00f15";
const OLD_INV = "895f7bd7-ca29-45e7-8b67-d08815492d1d";

/* Material that must never reach an evidence item. Every one is planted in the fixtures. */
const SECRETS = [
  "tenant/storage/key-SECRET",
  "https://d3u0tzju9qaucj.cloudfront.net/SECRET.mp4",
  "provider-job-SECRET",
  "59ee581e19417b20d9b9be6b75905f9611053e2e054ebb8e2f38e2a9ca9d60c7",
  "1NjiSjjVLNup-DRIVE-SECRET",
  "requested-actor-SECRET",
  "agent-SECRET",
  "prompt-SECRET",
];

function fixtures(calls: { tenant: unknown }[]): ContentMediaSourceDeps {
  const seen = (tenant: unknown) => calls.push({ tenant });
  return {
    listArtifacts: (async (tenant: unknown) => {
      seen(tenant);
      return {
        status: "read",
        artifacts: [
          { id: DRAFT, artifactType: "content-draft", lifecycleStatus: "draft", currentRevision: 3, title: "TRH post", intendedDestination: "instagram" },
          { id: OTHER, artifactType: "operational-plan", lifecycleStatus: "draft", currentRevision: 1, title: "A plan", intendedDestination: null },
        ],
      };
    }) as never,
    listImages: (async (tenant: unknown) => {
      seen(tenant);
      return {
        status: "read",
        assets: [
          { assetId: IMG, origin: "supplied", mediaKind: "image", mimeType: "image/png", width: 1280, height: 720, byteSize: 30989, byteDigest: SECRETS[3], lifecycle: "admitted", sourceArtifactId: DRAFT, sourceRevisionNo: 3, suppliedSourceFileId: SECRETS[4], suppliedByActorId: SECRETS[5], storageKey: SECRETS[0] },
          { assetId: GEN_IMG, origin: "generated", mediaKind: "image", mimeType: "image/png", width: 1024, height: 1024, byteSize: 1, byteDigest: SECRETS[3], lifecycle: "admitted", sourceArtifactId: DRAFT, sourceRevisionNo: 2, invocationId: "i", agentId: SECRETS[6], requestedByActorId: SECRETS[5], providerJobId: SECRETS[2], transport: "live", provider: "openai", model: "m" },
        ],
      };
    }) as never,
    listVideos: (async (tenant: unknown) => {
      seen(tenant);
      const v = (assetId: string, invocationId: string, w: number, h: number, ms: number) => ({
        assetId, mediaKind: "video", origin: "generated", mimeType: "video/mp4", byteSize: 1, byteDigest: SECRETS[3], width: w, height: h,
        container: "mp4", durationMs: ms, videoCodec: "h264", audioCodec: null, frameRate: "24/1", admittedAt: "x", lifecycle: "admitted",
        sourceArtifactId: DRAFT, sourceRevisionNo: 3, suppliedByActorId: null, suppliedSourceFileId: null, invocationId, storageKey: SECRETS[0],
      });
      return { status: "read", videos: [v(OLD_VID, OLD_INV, 1024, 576, 3042), v(VID, INV, 1280, 720, 5042)] };
    }) as never,
    listGenerations: (async (tenant: unknown) => {
      seen(tenant);
      const g = (invocationId: string, src: string | null) => ({
        invocationId, outputMediaKind: "video", state: "provider-succeeded", simulated: false, provider: "higgsfield", model: "pixverse/v6",
        providerAcceptedAt: null, providerCompletedAt: null, lastPolledAt: null, pollCount: 6, providerFailure: null, providerOutputReported: true,
        admissionOutcome: "admitted", sourceArtifactId: DRAFT, sourceRevisionNo: 3, requestedAt: "x", sourceMediaAssetId: src,
        providerOutputRef: SECRETS[1], promptText: SECRETS[7],
      });
      return { status: "read", generations: [g(OLD_INV, null), g(INV, IMG)] };
    }) as never,
    readReviewStates: (async (tenant: unknown, ids: readonly string[]) => {
      seen(tenant);
      return new Map(ids.map((id) => [id, { status: "read", decision: id === GEN_IMG ? null : "accepted", decisionId: "d", decidedAt: "t", decisionCount: 1 }]));
    }) as never,
    readPackage: (async (tenant: unknown, input: { artifactId: string; revisionNo: number }) => {
      seen(tenant);
      assert.deepEqual(input, { artifactId: DRAFT, revisionNo: 3 }, "the package is read for the draft's CURRENT revision");
      return {
        status: "read",
        package: {
          artifactId: DRAFT, revisionNo: 3, title: "TRH post", destination: "instagram", copy: "COPY-NOT-CARRIED", copyReviewState: "unreviewed",
          selected: [
            { mediaAssetId: OLD_VID, mediaKind: "video" },
            { mediaAssetId: VID, mediaKind: "video" },
          ],
          mediaReviewStates: {}, blockers: ["copy-unreviewed"], ready: false,
        },
      };
    }) as never,
    readProviderSwitch: async () => false,
  };
}

async function main(): Promise<void> {
  /* ── 1 · The class exists through the released architecture, on Operations only ── */
  assert.ok(HEBY_SOURCE_CLASSES.includes("content-media"));
  const carrying = HEBY_PROFILED_WORKSPACES.filter((w) => getHebyWorkspaceProfile(w).sourceClasses.includes("content-media"));
  assert.deepEqual([...carrying], ["operations"], "content-media is declared by Operations and nothing else");
  assert.equal(getHebyWorkspaceProfile("operations").authority, "advisory-only", "seeing media did not make Operations able to decide");
  const pure = resolveSource("content-media");
  assert.equal(pure.state, "unavailable");
  assert.doesNotMatch(pure.unavailableReason ?? "", /no media|nothing selected/i, "the fallback never claims a draft has no media");

  /* ── 1b · Caption preparation's grounding is unchanged: the class resolves unread there ── */
  const prepare = readFileSync(path.join(process.cwd(), "src/features/work-artifacts/prepare-work-artifact.server.ts"), "utf8");
  assert.match(prepare, /\{ \.\.\.deps, resolveContentMedia: async \(\) => resolveSource\("content-media"\) \}/, "preparation passes the pure, unread content-media resolution");

  /* ── 2 · Imports are exactly the named readers; no writer, store read or grant ── */
  const imports = [...code.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g)].map((m) => ({
    type: Boolean(m[1]),
    names: m[2]!.split(",").map((n) => n.trim()).filter(Boolean).sort(),
    from: m[3]!,
  }));
  const valueImports = Object.fromEntries(imports.filter((i) => !i.type).map((i) => [i.from, i.names]));
  assert.deepEqual(valueImports, {
    "@/features/heby-provider-ops/provider-connectivity-control.server": ["resolveDirectorEnabled"],
    "@/features/media-assets/async-generation-lifecycle.server": ["listArtifactVideoGenerations"],
    "@/features/media-assets/read-media-assets.server": ["listArtifactMediaAssets"],
    "@/features/media-assets/read-media-videos.server": ["listArtifactMediaVideos"],
    "@/features/media-generation-live/higgsfield-video-control": ["HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY", "HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY"],
    "@/features/media-asset-review/review-media-asset.server": ["readMediaAssetReviewStates"],
    "@/features/work-artifacts/read-work-artifacts.server": ["listWorkArtifacts"],
    "@/features/work-artifacts/artifact-ref": ["formatWorkArtifactRef"],
    "@/features/work-artifacts/contracts": ["CONTENT_DRAFT_TYPE"],
    "./read-content-package.server": ["readContentPackage"],
  }, "the shaper imports exactly these readers and constants");
  assert.equal(/\bimport\s+\*|\brequire\(|\bimport\(/.test(code), false, "no namespace, dynamic or require import");
  for (const banned of [
    "acceptMediaAsset", "declineMediaAsset", "selectMediaForRevision", "deselectMediaForRevision",
    "requestMediaGeneration", "requestAsyncVideoGeneration", "registerAsyncMediaGeneration", "dispatchAsyncMediaGeneration",
    "pollAsyncMediaGeneration", "admitGeneratedVideo", "admitSuppliedDrive", "derivePublishJpeg", "deriveNormalizedVideo",
    "retireMediaAsset", "writeGovernanceDecision", "recordGovernanceDecision", "recordActionRequest", "decideActionRequest",
    "consumeActionPermit", "executeAuthorizedAction", "readMediaAsset(", "readMediaVideo(", "resolveMediaObjectStore",
    "resolveMediaStorageV2", "resolveLiveVideoGenerationTransport", "resolveMediaAsyncGenerationTransport", "getDb",
    ".insert(", ".update(", ".delete(", "storageKey", "providerOutputRef", "providerJobId", "byteDigest",
    "suppliedSourceFileId", "suppliedByActorId", "requestedByActorId", "agentId", "promptText", ".copy",
  ]) {
    assert.equal(code.includes(banned), false, `the shaper must not reference ${banned}`);
  }

  /* ── 3 · Tenant only from the context, forwarded unchanged; none means nothing is read ── */
  {
    const calls: { tenant: unknown }[] = [];
    const none = await readContentMediaGroundingSource(null, fixtures(calls));
    assert.equal(none.state, "unavailable");
    assert.equal(calls.length, 0, "no tenant, no read");
    const noUser = await readContentMediaGroundingSource({ tenantId: TENANT.tenantId } as unknown as TenantContext, fixtures(calls));
    assert.equal(noUser.state, "unavailable", "a tenant without an authenticated user reads nothing");
    assert.equal(calls.length, 0);
  }
  const calls: { tenant: unknown }[] = [];
  const r = await readContentMediaGroundingSource(TENANT, fixtures(calls));
  assert.ok(calls.length >= 6);
  for (const c of calls) assert.equal(c.tenant, TENANT, "every reader receives exactly the authenticated tenant");

  /* ── 4 · Shape: what Heby sees, and what never reaches it ── */
  assert.equal(r.sourceClass, "content-media");
  assert.equal(r.state, "resolved");
  assert.equal(r.authoritative, false);
  assert.equal(r.provenance, CONTENT_MEDIA_PROVENANCE);
  assert.deepEqual(r.items.map((i) => i.recordRef), [
    `work-artifact/${DRAFT}@3`,
    "provider-connectivity/higgsfield-video-generation",
    "provider-connectivity/higgsfield-image-to-video",
  ], "one item per open content draft (plans excluded) and one per switch");
  const draft = r.items[0]!;
  assert.match(draft.detail, /package revision 3: 0 images · 2 videos selected/);
  assert.match(draft.detail, /package ready: no/);
  assert.match(draft.detail, /blockers: copy-unreviewed/);
  assert.match(draft.detail, /destination \(declared\): instagram/);
  const content = draft.content ?? "";
  assert.match(content, new RegExp(`video ${VID} · origin generated · video/mp4 · 1280x720 · 5\\.0 s · h264 · no audio · 24/1 fps .* generated from image ${IMG} · review accepted · selected in revision 3`));
  assert.match(content, new RegExp(`video ${OLD_VID} .* generated from text · review accepted · selected in revision 3`));
  assert.match(content, new RegExp(`image ${IMG} · origin supplied .* supplied — outside media review · not selected`));
  assert.match(content, new RegExp(`image ${GEN_IMG} · origin generated .* no review recorded`));
  assert.match(content, new RegExp(`video attempt ${INV} · higgsfield pixverse/v6 · live · state provider-succeeded · admission admitted .* source image ${IMG}`));
  for (const sw of r.items.slice(1)) assert.match(sw.detail, /^switch: off · read fail-closed/);
  const everything = JSON.stringify(r);
  for (const s of [...SECRETS, "COPY-NOT-CARRIED"]) assert.equal(everything.includes(s), false, `evidence must not carry ${s}`);
  for (const i of r.items) assert.doesNotMatch(i.detail, /\bapproved\b|\bauthorized\b|\bpublished\b/i, "detail uses ledger words, never an act claim");

  /* A failed media read is reported as unavailable, never as a draft with no media. */
  const failing = await readContentMediaGroundingSource(TENANT, {
    ...fixtures([]),
    listVideos: (async () => ({ status: "unavailable", reason: "persistence-unavailable" })) as never,
  });
  assert.equal(failing.state, "unavailable");

  /* ── 5 · The answer flow substitutes the read, keeps every other item, degrades on failure ── */
  const ask = (resolveContentMedia: (t: TenantContext) => Promise<SourceResolution>, route = "/operations") =>
    answerHebyModelRequest(
      { prompt: "What media does this post have?", route },
      { resolveTenant: async () => TENANT, resolveDirectorEnabled: async () => false, getConversationRepo: () => null, resolveContentMedia },
    );
  let consulted = 0;
  const withMedia = await ask(async (t) => {
    consulted += 1;
    assert.equal(t, TENANT);
    return readContentMediaGroundingSource(t, fixtures([]));
  });
  assert.equal(consulted, 1);
  assert.equal(withMedia.status, "answered");
  if (withMedia.status !== "answered") return;
  const after = new Set(withMedia.outcome.response.evidence.map((e) => `${e.sourceClass}/${e.recordRef}`));
  assert.ok(after.has(`content-media/work-artifact/${DRAFT}@3`), "content-media evidence reaches the released answer");
  const baseline = await ask(async () => resolveSource("content-media"));
  assert.equal(baseline.status, "answered");
  if (baseline.status !== "answered") return;
  for (const e of baseline.outcome.response.evidence) {
    assert.ok(after.has(`${e.sourceClass}/${e.recordRef}`), `adding the class removed evidence: ${e.sourceClass}/${e.recordRef}`);
  }
  const thrown = await ask(async () => {
    throw new Error("read failed");
  });
  assert.equal(thrown.status, "answered", "a throwing read degrades to the pure resolution");
  let elsewhere = 0;
  await ask(async () => {
    elsewhere += 1;
    return resolveSource("content-media");
  }, "/command");
  assert.equal(elsewhere, 0, "a workspace that does not declare the class never consults it");

  console.log("heby-media-1/content-media-firewall: OK");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
