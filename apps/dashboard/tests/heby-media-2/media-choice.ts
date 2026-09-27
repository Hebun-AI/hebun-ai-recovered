/*
 * tests/heby-media-2/media-choice.ts — HEBY-MEDIA-2: the deterministic media-choice evaluator.
 *
 * Fixture cases A–J from the phase brief, plus the firewall: the evaluator is pure, imports nothing
 * at runtime, and reaches no writer, provider, store or clock. The recommendation it produces for
 * Heby travels only inside the HEBY-MEDIA-1 `content-media` evidence item.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  MEDIA_CHOICE_CODES,
  MEDIA_CHOICE_EXPLANATIONS,
  MEDIA_CHOICE_KINDS,
  evaluateMediaChoice,
  formatMediaChoice,
  type DraftMediaFacts,
  type MediaFact,
  type ProviderSwitchFacts,
} from "../../src/features/content-composition/media-choice";
import {
  readContentMediaGroundingSource,
  type ContentMediaSourceDeps,
} from "../../src/features/content-composition/heby-content-media-source.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const OFF: ProviderSwitchFacts = { textToVideo: false, imageToVideo: false, image: "not-read" };
const T2V_ON: ProviderSwitchFacts = { textToVideo: true, imageToVideo: false, image: "not-read" };
const ALL_ON: ProviderSwitchFacts = { textToVideo: true, imageToVideo: true, image: "not-read" };

const SYNTHETIC = "3f7b9e66-b165-86df-ab9b-77fcc7d36f14";

function m(assetId: string, kind: "image" | "video", origin: "generated" | "supplied", review: MediaFact["review"], selected = false, lifecycle: MediaFact["lifecycle"] = "admitted"): MediaFact {
  return { assetId, kind, origin, lifecycle, review, selectedInCurrentRevision: selected };
}

function draft(media: MediaFact[], over: Partial<DraftMediaFacts> = {}): DraftMediaFacts {
  return { artifactId: "a", currentRevision: 3, destination: "instagram", packageReadable: true, media, attempts: [], ...over };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") {
    for (const v of Object.values(o as object)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

async function main(): Promise<void> {
  /* Vocabulary is closed and every code explains itself. */
  assert.deepEqual([...MEDIA_CHOICE_KINDS], ["use-existing", "generate-image", "generate-text-to-video", "generate-image-to-video", "none-ask-human"]);
  for (const c of MEDIA_CHOICE_CODES) assert.ok(MEDIA_CHOICE_EXPLANATIONS[c].length > 0, `${c} has an explanation`);
  for (const s of Object.values(MEDIA_CHOICE_EXPLANATIONS)) {
    assert.doesNotMatch(s, /\b(approved|authorized|executed|score|confidence|engagement|\d+%)\b/i, `no act claim or score: ${s}`);
  }

  /* A · eligible existing media → use-existing */
  {
    const chosen = evaluateMediaChoice(draft([m("v2", "video", "generated", "accepted", true), m("v1", "video", "generated", "accepted", true)]), OFF);
    assert.equal(chosen.kind, "use-existing");
    assert.deepEqual(chosen.assetIds, ["v1", "v2"], "the selection, sorted");
    assert.ok(chosen.reasons.includes("existing-selection-reviewed"));
    const unchosen = evaluateMediaChoice(draft([m("i1", "image", "generated", "accepted")]), OFF);
    assert.equal(unchosen.kind, "use-existing");
    assert.deepEqual(unchosen.assetIds, ["i1"]);
    assert.ok(unchosen.reasons.includes("existing-reviewed-media"));
  }

  /* B · no defensible choice between image and video → none-ask-human */
  {
    const both = evaluateMediaChoice(draft([m("i1", "image", "generated", "accepted"), m("v1", "video", "generated", "accepted")]), ALL_ON);
    assert.equal(both.kind, "none-ask-human");
    assert.ok(both.reasons.includes("multiple-valid-media-paths"));
    assert.ok(both.reasons.includes("human-choice-required"));
    assert.deepEqual(both.assetIds, ["i1", "v1"], "both candidates are named; neither is picked");
  }

  /* C · required provider OFF → provider-disabled */
  {
    const none = evaluateMediaChoice(draft([]), OFF);
    assert.equal(none.kind, "none-ask-human");
    const t2v = none.paths.find((p) => p.path === "generate-text-to-video")!;
    assert.ok(t2v.blockers.includes("provider-disabled"));
    const i2v = none.paths.find((p) => p.path === "generate-image-to-video")!;
    assert.ok(i2v.blockers.includes("provider-disabled"));
    assert.ok(none.blockers.includes("provider-disabled"));
    const image = none.paths.find((p) => p.path === "generate-image")!;
    assert.ok(image.blockers.includes("provider-state-unknown"), "an unread switch is not assumed on");
  }

  /* D · image→video with unresolved data use → data-use-unresolved, even for the ceremony's synthetic id */
  {
    for (const origin of ["supplied", "generated"] as const) {
      const r = evaluateMediaChoice(draft([m(SYNTHETIC, "image", origin, origin === "generated" ? "accepted" : "not-applicable", false)], { destination: null }), ALL_ON);
      const i2v = r.paths.find((p) => p.path === "generate-image-to-video")!;
      assert.ok(i2v.blockers.includes("data-use-unresolved"), `${origin} source is not cleared`);
      assert.notEqual(r.kind, "generate-image-to-video");
    }
    const noSource = evaluateMediaChoice(draft([]), ALL_ON).paths.find((p) => p.path === "generate-image-to-video")!;
    assert.ok(noSource.blockers.includes("no-source-image"));
    assert.ok(noSource.blockers.includes("data-use-unresolved"));
  }

  /* E · price unknown where material; an on switch proves only the switch */
  {
    const r = evaluateMediaChoice(draft([]), T2V_ON);
    assert.equal(r.kind, "generate-text-to-video", "the only unblocked path");
    assert.ok(r.unknowns.includes("price-unknown"));
    assert.ok(r.unknowns.includes("provider-readiness-unverified"));
    for (const p of r.paths) assert.ok(p.unknowns.includes("price-unknown"), `${p.path} carries price-unknown`);
    const pending = evaluateMediaChoice(draft([], { attempts: [{ invocationId: "x", state: "provider-pending", admissionOutcome: "not-attempted", sourceMediaAssetId: null }] }), T2V_ON);
    assert.equal(pending.kind, "none-ask-human", "no second generation is recommended while one is in flight");
    assert.ok(pending.blockers.includes("generation-pending"));
    const unadmitted = evaluateMediaChoice(draft([], { attempts: [{ invocationId: "x", state: "provider-succeeded", admissionOutcome: "not-attempted", sourceMediaAssetId: null }] }), T2V_ON);
    assert.ok(unadmitted.blockers.includes("generation-pending"), "succeeded-but-not-admitted is still pending");
  }

  /* F · destination rules: unknown stays unknown; video publishing is not claimed */
  {
    for (const destination of [null, "tiktok", "youtube", "instagram"] as const) {
      const r = evaluateMediaChoice(draft([m("v1", "video", "generated", "accepted", true)], { destination }), OFF);
      assert.equal(r.kind, "use-existing");
      assert.ok(r.unknowns.includes("destination-rule-unknown"), `${destination}: no media rule is invented`);
      if (destination !== null) assert.ok(r.reasons.includes("publish-capability-unavailable"), `${destination}: a packaged video is not publishable`);
    }
    const image = evaluateMediaChoice(draft([m("i1", "image", "generated", "accepted", true)]), OFF);
    assert.equal(image.reasons.includes("publish-capability-unavailable"), false, "Instagram image publishing exists (PUBLISH-0, Governance-gated)");
  }

  /* G · supplied media is never reviewed, approved or eligible */
  {
    const supplied = evaluateMediaChoice(draft([m("s1", "image", "supplied", "not-applicable"), m("s2", "video", "supplied", "not-applicable")]), OFF);
    assert.equal(supplied.kind, "none-ask-human");
    assert.ok(supplied.reasons.includes("supplied-media-outside-review"));
    assert.ok(supplied.reasons.includes("no-eligible-existing-media"));
    assert.deepEqual(supplied.assetIds, [], "supplied media is not named as usable");
    const selectedSupplied = evaluateMediaChoice(draft([m("s1", "video", "supplied", "not-applicable", true)]), OFF);
    assert.notEqual(selectedSupplied.kind, "use-existing", "a selected supplied asset does not become eligible");
    assert.ok(selectedSupplied.reasons.includes("selected-media-not-eligible"));
    const unreviewed = evaluateMediaChoice(draft([m("g1", "video", "generated", "none", true)]), OFF);
    assert.notEqual(unreviewed.kind, "use-existing");
    assert.ok(unreviewed.reasons.includes("unreviewed-generated-media"));
    const declined = evaluateMediaChoice(draft([m("g1", "image", "generated", "declined")]), OFF);
    assert.ok(declined.reasons.includes("declined-generated-media"));
    const retired = evaluateMediaChoice(draft([m("g1", "image", "generated", "accepted", false, "retired")]), OFF);
    assert.ok(retired.reasons.includes("no-eligible-existing-media"));
    const unreadable = evaluateMediaChoice(draft([m("g1", "image", "generated", "accepted")], { packageReadable: false }), OFF);
    assert.equal(unreadable.kind, "none-ask-human");
    assert.ok(unreadable.blockers.includes("package-unreadable"));
  }

  /* H · it mutates nothing: frozen input survives, and the module is pure */
  {
    const input = deepFreeze(draft([m("v1", "video", "generated", "accepted", true), m("s1", "image", "supplied", "not-applicable")]));
    const switches = deepFreeze({ ...OFF });
    const before = JSON.stringify(input);
    evaluateMediaChoice(input, switches);
    assert.equal(JSON.stringify(input), before);
    const src = readFileSync(path.join(process.cwd(), "src/features/content-composition/media-choice.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const imports = [...src.matchAll(/^import\s.*$/gm)].map((x) => x[0]);
    assert.deepEqual(imports, ['import type { ContentDestination } from "@/features/work-artifacts/contracts";'], "type-only import; nothing at runtime");
    for (const banned of ["fetch(", "process.", "Date", "Math.random", "await ", "async ", "require(", "import(", ".insert(", ".update(", ".delete(", "Director"]) {
      assert.equal(src.includes(banned), false, `the evaluator must not use ${banned}`);
    }
    assert.doesNotMatch(src, /\bresolve[A-Z]\w*\(/, "the evaluator calls no resolver");
  }

  /* I · stable: same input → same output, independent of input order */
  {
    const media = [m("v2", "video", "generated", "accepted"), m("i9", "image", "generated", "none"), m("s1", "image", "supplied", "not-applicable"), m("v1", "video", "generated", "accepted")];
    const a = evaluateMediaChoice(draft(media), OFF);
    const b = evaluateMediaChoice(draft([...media].reverse()), OFF);
    assert.deepEqual(a, b);
    assert.deepEqual(formatMediaChoice(a), formatMediaChoice(b));
    assert.deepEqual(a.explanation, [...a.reasons, ...a.blockers, ...a.unknowns]
      .filter((c, i, all) => all.indexOf(c) === i)
      .sort((x, y) => MEDIA_CHOICE_CODES.indexOf(x) - MEDIA_CHOICE_CODES.indexOf(y))
      .map((c) => MEDIA_CHOICE_EXPLANATIONS[c]), "the explanation is the codes' sentences, in code order");
  }

  /* J · through the integration, the recommendation names only this tenant's facts */
  {
    const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as unknown as TenantContext;
    const D = "57b57106-2848-41f7-a5b3-d2475e0b7dba";
    const seen: unknown[] = [];
    const deps: ContentMediaSourceDeps = {
      listArtifacts: (async (t: unknown) => (seen.push(t), { status: "read", artifacts: [{ id: D, artifactType: "content-draft", lifecycleStatus: "draft", currentRevision: 3, title: "t", intendedDestination: "instagram" }] })) as never,
      listImages: (async (t: unknown) => (seen.push(t), { status: "read", assets: [{ assetId: SYNTHETIC, origin: "supplied", mimeType: "image/png", width: 1, height: 1, lifecycle: "admitted", sourceArtifactId: D, sourceRevisionNo: 3 }] })) as never,
      listVideos: (async (t: unknown) => (seen.push(t), {
        status: "read",
        videos: ["c3", "ad"].map((id) => ({ assetId: id, origin: "generated", mimeType: "video/mp4", width: 1, height: 1, durationMs: 1000, videoCodec: "h264", audioCodec: null, frameRate: "24/1", lifecycle: "admitted", sourceArtifactId: D, sourceRevisionNo: 3, invocationId: `inv-${id}` })),
      })) as never,
      listGenerations: (async (t: unknown) => (seen.push(t), { status: "read", generations: [] })) as never,
      readReviewStates: (async (t: unknown, ids: readonly string[]) => (seen.push(t), new Map(ids.map((id) => [id, { status: "read", decision: "accepted", decisionId: "d", decidedAt: "x", decisionCount: 1 }])))) as never,
      readPackage: (async (t: unknown) => (seen.push(t), { status: "read", package: { revisionNo: 3, selected: [{ mediaAssetId: "ad", mediaKind: "video" }, { mediaAssetId: "c3", mediaKind: "video" }], blockers: ["copy-unreviewed"], ready: false } })) as never,
      readProviderSwitch: async () => false,
    };
    const r = await readContentMediaGroundingSource(TENANT, deps);
    for (const t of seen) assert.equal(t, TENANT);
    const item = r.items[0]!;
    assert.match(item.detail, /media recommendation \(deterministic\): use-existing/);
    assert.match(item.content ?? "", /^assets named: ad, c3$/m);
    assert.match(item.content ?? "", /reasons: existing-selection-reviewed, supplied-media-outside-review, publish-capability-unavailable/);
    assert.match(item.content ?? "", /path generate-image-to-video: blockers provider-disabled, data-use-unresolved/);
  }

  console.log("heby-media-2/media-choice: OK");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
