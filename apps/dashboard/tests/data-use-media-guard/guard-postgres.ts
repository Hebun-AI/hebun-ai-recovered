/*
 * DATA-USE-MEDIA-GUARD-1 — custody is not permission to send an organization's media to an external
 * generative model. Real Postgres, the released MEDIA-5 and IMAGE → VIDEO authorities, and the REAL
 * recorded data-use decisions (nothing injected unless a case says so). The providers are counted
 * fakes that carry the real provider NAMES, so the decision under test is the production one — and no
 * byte leaves this process.
 *
 * THE CLAIM:
 *
 *   "A supplied image — reviewed, accepted, selected, in a READY package, with the provider switched
 *    on — is refused for Higgsfield image-to-video and for OpenAI reference edit with
 *    `source-data-use-not-cleared`, before any row, upload or generation call. A generated image is
 *    refused for Higgsfield (no decision covers it) and allowed for OpenAI reference edit (MEDIA-5's
 *    production-accepted decision). A generated image made FROM a supplied photograph, or a derivative
 *    of one, carries the supplied lineage and is refused. Unknown, denied and unresolvable refuse alike.
 *    Another tenant's asset is unresolvable. Admission, social publishing and Heby do not touch this
 *    gate, and no application door can pass a decision list."
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import sharp from "sharp";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import { requestMediaGeneration } from "../../src/features/media-assets/request-media-generation.server";
import * as lifecycle from "../../src/features/media-assets/async-generation-lifecycle.server";
import { mediaAssetStorageKey } from "../../src/features/media-assets/contracts";
import {
  RECORDED_DATA_USE_DECISIONS,
  decideExternalGenerativeDataUse,
  isExternalGenerativeUseCleared,
  type RecordedDataUseDecision,
} from "../../src/features/media-assets/external-generative-data-use";
import {
  resolveExternalGenerativeEligibility,
  resolveSourceLineage,
} from "../../src/features/media-assets/external-generative-eligibility.server";
import { acceptMediaAsset } from "../../src/features/media-asset-review/review-media-asset.server";
import { acceptArtifactRevision } from "../../src/features/work-artifact-review/review-revision.server";
import { selectMediaForRevision } from "../../src/features/content-composition/select-media.server";
import { readContentPackage } from "../../src/features/content-composition/read-content-package.server";
import { OPENAI_IMAGE_PROVIDER } from "../../src/features/media-generation-live/openai-image-transport.server";
import { HIGGSFIELD_PROVIDER } from "../../src/features/media-generation-live/higgsfield-video-transport.server";
import type {
  MediaAsyncGenerationTransport,
  MediaAsyncGenerationTransportResolution,
  MediaAsyncSourcePreparation,
  MediaAsyncTransportRequest,
} from "../../src/features/media-assets/async-generation-transport";
import { createFakeMediaGenerationTransport, createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { createFakeAsyncVideoTransport } from "../helpers/fake-async-video-transport";
import { SIMULATED_PROVIDER_DATA_USE_DECISIONS } from "../helpers/simulated-data-use";
import { seedTenant, type Tenant } from "../mv4-async-generation/scenarios";

const NOW = new Date("2026-09-29T10:00:00.000Z");
const REFUSED = { status: "refused", reason: "source-data-use-not-cleared" } as const;
const sha = (b: Uint8Array | string): string => createHash("sha256").update(b).digest("hex");
const read = (f: string): string => readFileSync(f, "utf8");
const strip = (c: string): string => c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("data-use-media-guard/guard-postgres: exited before completing");
    process.exitCode = 1;
  }
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

async function one<T>(client: Client, sql: string, args: unknown[] = []): Promise<T> {
  return (await client.query(sql, args)).rows[0] as T;
}

async function main(): Promise<void> {
  /* ══ 0. THE RECORDED DECISIONS ARE EXACTLY THE DIRECTOR'S, AND NAME THE REAL PROVIDERS ══ */
  {
    assert.equal(RECORDED_DATA_USE_DECISIONS.length, 1, "one recorded decision today");
    const [only] = RECORDED_DATA_USE_DECISIONS;
    assert.deepEqual(
      { provider: only!.provider, purpose: only!.purpose, lineage: only!.lineage, decision: only!.decision },
      { provider: OPENAI_IMAGE_PROVIDER, purpose: "reference-edit", lineage: "generated-only", decision: "allowed" },
      "MEDIA-5's production-accepted combination, and nothing wider",
    );
    assert.match(only!.evidence, /MEDIA-5/, "the row cites its Director evidence");
    assert.ok(!RECORDED_DATA_USE_DECISIONS.some((d) => d.provider === HIGGSFIELD_PROVIDER), "no decision names Higgsfield — a missing decision, not a verdict");
    assert.ok(!RECORDED_DATA_USE_DECISIONS.some((d) => d.lineage === "includes-supplied"), "no decision covers supplied media");

    /* Provider and purpose are both part of the key. */
    const gen = { status: "resolved", lineage: "generated-only" } as const;
    const sup = { status: "resolved", lineage: "includes-supplied" } as const;
    const d = (provider: string, purpose: "reference-edit" | "image-to-video", lineage: typeof gen | typeof sup | { status: "unresolvable" }) =>
      decideExternalGenerativeDataUse({ provider, purpose, lineage }).decision;
    assert.equal(d(OPENAI_IMAGE_PROVIDER, "reference-edit", gen), "allowed");
    assert.equal(d(OPENAI_IMAGE_PROVIDER, "reference-edit", sup), "unknown", "supplied → OpenAI was never decided");
    assert.equal(d(OPENAI_IMAGE_PROVIDER, "image-to-video", gen), "unknown", "same provider, other purpose");
    assert.equal(d(HIGGSFIELD_PROVIDER, "reference-edit", gen), "unknown", "same purpose, other provider");
    assert.equal(d(HIGGSFIELD_PROVIDER, "image-to-video", gen), "unknown");
    assert.equal(d(HIGGSFIELD_PROVIDER, "image-to-video", sup), "unknown");
    assert.equal(d(OPENAI_IMAGE_PROVIDER, "reference-edit", { status: "unresolvable" }), "unknown", "unresolvable is unknown");
    assert.equal(d("some-future-provider", "reference-edit", gen), "unknown", "no wildcard");
    /* Only `allowed` clears. `denied` and `unknown` refuse alike. */
    assert.equal(isExternalGenerativeUseCleared({ decision: "allowed", basis: "x" }), true);
    assert.equal(isExternalGenerativeUseCleared({ decision: "unknown", basis: "x" }), false);
    assert.equal(isExternalGenerativeUseCleared({ decision: "denied", basis: "x" }), false);
  }

  const harness = createDisposablePostgresHarness("hebun_data_use_guard");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = (): ControlPlaneDatabase => handle.db;
  try {
    harness.migrateDatabase();
    await client.connect();
    const a: Tenant = await seedTenant(client, getDb, "Acme");
    const b: Tenant = await seedTenant(client, getDb, "Beta");
    const memory = createMemoryMediaObjectStore();
    const resolveStorage = () => ({ status: "available" as const, store: memory });
    const count = async (sql: string, args: unknown[] = []) => (await one<{ n: number }>(client, sql, args)).n;

    const png = new Uint8Array(await sharp({ create: { width: 96, height: 64, channels: 3, background: { r: 180, g: 90, b: 40 } } }).png().toBuffer());

    /* A SUPPLIED image — the stand-in for a real product photograph — in tenant A. */
    const suppliedId = randomUUID();
    await client.query(
      `insert into media_assets (id, tenant_id, mime_type, byte_size, byte_digest, width, height, storage_backend,
         storage_key, admitted_at, supplied_by_actor_type, supplied_by_actor_id, supplied_source,
         supplied_source_file_id, supplied_source_capability, supplied_artifact_id, supplied_revision_no)
       values ($1,$2,'image/png',$3,$4,96,64,'test-memory',$5, now(),'human',$6,'google-drive','drive-file-1',
         'google.drive.file.content.read',$7,1)`,
      [suppliedId, a.tenantId, png.byteLength, sha(png), mediaAssetStorageKey(a.tenantId, suppliedId), a.ctx.userId, a.draft],
    );
    memory.objects.set(mediaAssetStorageKey(a.tenantId, suppliedId), { bytes: png, contentType: "image/png" });

    /* The OpenAI-named image transport (counted fake; `calls` is every generate()). */
    const openai = createFakeMediaGenerationTransport({ kind: "bytes", bytes: png });
    (openai as { provider: string }).provider = OPENAI_IMAGE_PROVIDER;
    const imageDeps = (extra: Record<string, unknown> = {}) => ({
      getDb,
      now: () => NOW,
      resolveStorage,
      resolveTransport: () => ({ status: "available" as const, transport: openai }),
      ...extra,
    });
    const edit = (t: Tenant, sourceAssetId: string, extra: Record<string, unknown> = {}) =>
      requestMediaGeneration(t.ctx, { artifactId: t.draft, revisionNo: 1, promptText: "Plain linen background.", requestKey: randomUUID(), sourceAssetId }, imageDeps(extra));

    /* A GENERATED image (prompt only) — the MEDIA-2B shape MEDIA-5 was accepted on. */
    const gen = await requestMediaGeneration(a.ctx, { artifactId: a.draft, revisionNo: 1, promptText: "A synthetic tile.", requestKey: randomUUID() }, imageDeps());
    assert.equal(gen.status, "admitted", "text-to-image takes no source and never meets the gate");
    const generatedId = gen.status === "admitted" ? gen.assetId : "";

    /* A GENERATED image made FROM the supplied photograph — only reachable with a (test) decision. */
    const laundered = await edit(a, suppliedId, { dataUseDecisions: SIMULATED_PROVIDER_DATA_USE_DECISIONS.map((r) => ({ ...r, provider: OPENAI_IMAGE_PROVIDER })) });
    assert.equal(laundered.status, "admitted", "fixture: an edit of the supplied photo, under a TEST-ONLY decision");
    const launderedId = laundered.status === "admitted" ? laundered.assetId : "";

    /* The Higgsfield-named image-to-video transport: counted uploads and dispatches, no network. */
    const hf = createFakeAsyncVideoTransport("accept");
    const uploads: string[] = [];
    const hfT = hf as unknown as Record<string, unknown>;
    hfT.provider = HIGGSFIELD_PROVIDER;
    hfT.inputMode = "image";
    hfT.prepareSourceImage = async (input: { bytes: Uint8Array }): Promise<MediaAsyncSourcePreparation> => {
      uploads.push(sha(input.bytes));
      return { status: "prepared", source: Object.freeze({ contentType: "image/png", byteSize: input.bytes.byteLength, reveal: () => "https://cdn.invalid/x" }) };
    };
    /* The provider switch is ON: the resolver answers `available`, which is exactly what arming does. */
    const videoDeps = (extra: Record<string, unknown> = {}) => ({
      getDb,
      now: () => NOW,
      resolveStorage,
      resolveTransport: (req?: MediaAsyncTransportRequest): MediaAsyncGenerationTransportResolution =>
        req?.inputMode === "image"
          ? { status: "available", transport: hf as unknown as MediaAsyncGenerationTransport }
          : { status: "unavailable", reason: "video-generation-disabled" },
      ...extra,
    });
    const i2v = (t: Tenant, sourceAssetId: string, extra: Record<string, unknown> = {}) =>
      lifecycle.requestAsyncVideoGeneration(t.ctx, { artifactId: t.draft, revisionNo: 1, promptText: "Slow push-in.", requestKey: randomUUID(), sourceAssetId }, videoDeps(extra));

    const videoRows = () => count(`select count(*)::int n from media_generation_invocations where output_media_kind='video'`);
    const imageRows = () => count(`select count(*)::int n from media_generation_invocations where output_media_kind='image'`);
    const nothingLeft = async (label: string, before: { video: number; image: number; calls: number }) => {
      assert.equal(uploads.length, 0, `${label}: no upload to Higgsfield`);
      assert.equal(hf.dispatchCalls.length, 0, `${label}: no Higgsfield generation call`);
      assert.equal(openai.calls.length, before.calls, `${label}: no OpenAI call`);
      assert.equal(await videoRows(), before.video, `${label}: no video invocation row`);
      assert.equal(await imageRows(), before.image, `${label}: no image invocation row`);
    };
    const snapshot = async () => ({ video: await videoRows(), image: await imageRows(), calls: openai.calls.length });

    /* ══ 1. SUPPLIED + HIGGSFIELD IMAGE-TO-VIDEO, SWITCH ON, NO DECISION → REFUSED BEFORE THE PROVIDER ══ */
    {
      const before = await snapshot();
      assert.deepEqual(await i2v(a, suppliedId), REFUSED, "supplied → Higgsfield is not cleared");
      await nothingLeft("supplied → Higgsfield", before);
    }

    /* ══ 2. GENERATED + HIGGSFIELD → ALSO REFUSED: no decision covers it (not assumed) ══ */
    {
      const before = await snapshot();
      assert.deepEqual(await i2v(a, generatedId), REFUSED, "generated → Higgsfield has no decision either");
      await nothingLeft("generated → Higgsfield", before);
    }

    /* ══ 3. SUPPLIED + OPENAI REFERENCE EDIT → REFUSED (never decided) ══ */
    {
      const before = await snapshot();
      assert.deepEqual(await edit(a, suppliedId), REFUSED, "supplied → OpenAI is unknown, and unknown refuses");
      await nothingLeft("supplied → OpenAI", before);
    }

    /* ══ 4. GENERATED + OPENAI REFERENCE EDIT → ALLOWED (MEDIA-5's decision, unchanged) ══ */
    {
      const before = openai.calls.length;
      const ok = await edit(a, generatedId);
      assert.equal(ok.status, "admitted", `the released MEDIA-5 behaviour holds (${JSON.stringify(ok)})`);
      assert.equal(openai.calls.length, before + 1, "exactly one provider call");
      assert.equal(openai.calls.at(-1)!.request.mode, "reference-edit");
    }

    /* ══ 5. LINEAGE CANNOT BE LAUNDERED: an edit OF the supplied photo, and a derivative of it ══ */
    {
      const before = await snapshot();
      assert.deepEqual(await resolveSourceLineage(getDb(), a.tenantId, launderedId), { status: "resolved", lineage: "includes-supplied" });
      assert.deepEqual(await edit(a, launderedId), REFUSED, "a generated image made from a supplied photo is still supplied lineage");
      assert.deepEqual(await i2v(a, launderedId), REFUSED);
      await nothingLeft("laundered", before);

      const derivedOfSupplied = randomUUID();
      const derivedOfGenerated = randomUUID();
      for (const [id, from] of [[derivedOfSupplied, suppliedId], [derivedOfGenerated, generatedId]] as const) {
        await client.query(
          `insert into media_assets (id, tenant_id, derived_from_asset_id, derivation, mime_type, byte_size, byte_digest, width, height,
             storage_backend, storage_key, admitted_at)
           values ($1,$2,$3,'jpeg-publish-v1','image/jpeg',10,$4,96,64,'test-memory',$5, now())`,
          [id, a.tenantId, from, sha(id), mediaAssetStorageKey(a.tenantId, id)],
        );
      }
      assert.deepEqual(await resolveSourceLineage(getDb(), a.tenantId, derivedOfSupplied), { status: "resolved", lineage: "includes-supplied" }, "a derivative carries its source's lineage");
      assert.deepEqual(await resolveSourceLineage(getDb(), a.tenantId, derivedOfGenerated), { status: "resolved", lineage: "generated-only" });
      assert.deepEqual(await edit(a, derivedOfSupplied), REFUSED, "the publish JPEG of a supplied photo is refused too");
    }

    /* ══ 6. REVIEW ACCEPTED + SELECTED + READY PACKAGE + SWITCH ON → STILL REFUSED ══ */
    {
      const accepted = await acceptMediaAsset(a.ctx, { assetId: suppliedId, byteDigest: sha(png), justification: "Governance accepts these exact supplied bytes for use." }, { getDb, now: () => NOW } as never);
      assert.equal(accepted.status, "reviewed", "Governance accepted the supplied image");
      assert.deepEqual(await selectMediaForRevision(a.ctx, { artifactId: a.draft, revisionNo: 1, mediaAssetId: suppliedId }, { getDb }), { status: "selected" });
      const rev = await one<{ id: string }>(client, `select id from work_artifact_revisions where tenant_id=$1 and artifact_id=$2 and revision_no=1`, [a.tenantId, a.draft]);
      const revAccepted = await acceptArtifactRevision(a.ctx, { artifactId: a.draft, revisionId: rev.id, justification: "Governance accepts this exact copy." }, { getDb, now: () => NOW } as never);
      assert.equal(revAccepted.status, "reviewed", `the draft revision is accepted (${JSON.stringify(revAccepted)})`);
      const pkg = await readContentPackage(a.ctx, { artifactId: a.draft, revisionNo: 1 }, { getDb });
      assert.ok(pkg.status === "read", "the package reads");
      const selected = pkg.package.selected.map((s) => s.mediaAssetId);
      assert.deepEqual(selected, [suppliedId], "only the supplied image is selected");
      assert.equal(pkg.package.ready, true, `the package is READY (${JSON.stringify(pkg.package.blockers)})`);

      const before = await snapshot();
      assert.deepEqual(await i2v(a, suppliedId), REFUSED, "review + selection + READY + switch ON do not clear data-use for Higgsfield");
      assert.deepEqual(await edit(a, suppliedId), REFUSED, "nor for OpenAI");
      await nothingLeft("reviewed, selected, READY", before);
    }

    /* ══ 7. AN EXPLICIT `denied` REFUSES EXACTLY AS `unknown` DOES ══ */
    {
      const denied: RecordedDataUseDecision[] = [{ provider: OPENAI_IMAGE_PROVIDER, purpose: "reference-edit", lineage: "generated-only", decision: "denied", evidence: "test" }];
      const before = await snapshot();
      assert.deepEqual(await edit(a, generatedId, { dataUseDecisions: denied }), REFUSED, "a recorded denial refuses");
      await nothingLeft("denied", before);
    }

    /* ══ 8. TENANT ISOLATION ══ */
    {
      assert.deepEqual(await resolveSourceLineage(getDb(), b.tenantId, suppliedId), { status: "unresolvable" }, "another tenant's asset has no lineage here");
      assert.deepEqual(await resolveSourceLineage(getDb(), b.tenantId, generatedId), { status: "unresolvable" });
      const v = await resolveExternalGenerativeEligibility(getDb(), b.tenantId, generatedId, { provider: OPENAI_IMAGE_PROVIDER, purpose: "reference-edit" });
      assert.equal(v.decision, "unknown", "even an allowed combination is unknown for another tenant's asset");
      /* The released custody refusal still comes first at the doors, revealing nothing. */
      assert.deepEqual(await edit(b, generatedId), { status: "refused", reason: "source-asset-unresolvable" });
      assert.deepEqual(await i2v(b, suppliedId), { status: "refused", reason: "source-asset-unresolvable" });
      assert.deepEqual(await resolveSourceLineage(getDb(), a.tenantId, randomUUID()), { status: "unresolvable" }, "a missing asset is unresolvable");
    }

    /* ══ 9. A BROKEN LINEAGE (a cycle) IS UNRESOLVABLE, NOT ALLOWED ══ */
    {
      const x = randomUUID();
      const y = randomUUID();
      await client.query(`alter table media_assets disable trigger all`);
      for (const [id, from] of [[x, y], [y, x]] as const) {
        await client.query(
          `insert into media_assets (id, tenant_id, derived_from_asset_id, derivation, mime_type, byte_size, byte_digest, width, height,
             storage_backend, storage_key, admitted_at)
           values ($1,$2,$3,'jpeg-publish-v1','image/jpeg',10,$4,96,64,'test-memory',$5, now())`,
          [id, a.tenantId, from, sha(id), mediaAssetStorageKey(a.tenantId, id)],
        );
      }
      await client.query(`alter table media_assets enable trigger all`);
      assert.deepEqual(await resolveSourceLineage(getDb(), a.tenantId, x), { status: "unresolvable" }, "a cycle never resolves");
    }
  } finally {
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }

  /* ══ 10. STRUCTURE: THE GATE READS ONLY MEDIA PROVENANCE; NO DOOR CAN PASS A DECISION ══ */
  {
    const GATE = "src/features/media-assets/external-generative-eligibility.server.ts";
    const POLICY = "src/features/media-assets/external-generative-data-use.ts";
    const gate = strip(read(GATE));
    const imports = [...gate.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(
      imports.sort(),
      ["./external-generative-data-use", "@/db/client.server", "@/db/schema/media-asset", "drizzle-orm"].sort(),
      "the gate imports Media provenance and the policy — nothing else",
    );
    assert.ok(
      !/decision_records|decisionRecords|review|selection|content-package|provider_connectivity|connectivity-control|permit|action-authorization|heby/i.test(gate),
      "no review, selection, package, switch, permit or Heby state is read",
    );
    const policy = strip(read(POLICY));
    assert.ok(!/^import\s(?!type)/m.test(policy), "the policy is pure: no runtime import");

    const src = walk("src");
    const users = src.filter((f) => /external-generative-(eligibility|data-use)/.test(read(f)) && !/external-generative-(eligibility\.server|data-use)\.ts$/.test(f)).sort();
    assert.deepEqual(
      users,
      [
        "src/features/media-assets/async-generation-lifecycle.server.ts",
        "src/features/media-assets/read-verified-source-image.server.ts",
        "src/features/media-assets/request-media-generation.server.ts",
      ].sort(),
      "only the two generation authorities (and a doc reference) reach the gate — not admission, publishing or Heby",
    );
    const passers = src.filter((f) => /dataUseDecisions/.test(strip(read(f)))).sort();
    assert.deepEqual(
      passers,
      [
        "src/features/media-assets/async-generation-lifecycle.server.ts",
        "src/features/media-assets/external-generative-eligibility.server.ts",
        "src/features/media-assets/request-media-generation.server.ts",
      ].sort(),
      "no application door, UI or Heby module can hand the authority a decision list",
    );
    const actions = strip(read("src/app/(dashboard)/operations/actions.ts"));
    assert.match(actions, /requestMediaGeneration\(tenant, input\)/, "the MEDIA-5 door passes no deps");
    assert.match(actions, /requestAsyncVideoGeneration\(tenant, \{[^}]*\}\)/, "the video door passes no deps");

    /* The gate runs BEFORE the bytes are read for sending (MEDIA-5) and before registration/upload (I2V). */
    const m5 = strip(read("src/features/media-assets/request-media-generation.server.ts"));
    assert.ok(m5.indexOf('purpose: "reference-edit"') > 0 && m5.indexOf('purpose: "reference-edit"') < m5.indexOf("storage.store.get("), "MEDIA-5: data-use before the store read");
    assert.ok(m5.indexOf('purpose: "reference-edit"') < m5.indexOf(".insert(mediaGenerationInvocations)"), "MEDIA-5: data-use before any row");
    const lc = strip(read("src/features/media-assets/async-generation-lifecycle.server.ts"));
    assert.ok(lc.indexOf('purpose: "image-to-video"') > 0 && lc.indexOf('purpose: "image-to-video"') < lc.indexOf(".insert(mediaGenerationInvocations)"), "I2V: data-use before any row");
    assert.ok(lc.indexOf('purpose: "image-to-video"') < lc.indexOf("transport.prepareSourceImage("), "I2V: data-use before the upload");
    /* The provider is the resolved transport's, never a caller string. */
    assert.match(m5, /provider: transport\.provider, purpose: "reference-edit"/);
    assert.match(lc, /provider: transport\.provider, purpose: "image-to-video"/);

    /* Admission is custody and does not consult the gate; neither do the social publishing paths. */
    for (const f of src.filter((p) => /admit-supplied-drive|admit-generated-video|instagram|youtube/i.test(p))) {
      assert.ok(!/external-generative/.test(read(f)), `${f}: admission and publishing never meet the data-use gate`);
    }
  }

  finished = true;
  console.log("data-use-media-guard/guard-postgres: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
