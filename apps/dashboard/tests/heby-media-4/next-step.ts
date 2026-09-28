/*
 * tests/heby-media-4/next-step.ts — HEBY-MEDIA-4: observe, never drive. Cases A–O.
 *
 *   facts → choice (HEBY-MEDIA-2) → prefill (HEBY-MEDIA-3) → next step (HEBY-MEDIA-4)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { evaluateMediaChoice, type DraftMediaFacts, type GenerationAttemptFact, type MediaFact, type ProviderSwitchFacts } from "../../src/features/content-composition/media-choice";
import { prefillFromChoice } from "../../src/features/content-composition/media-prefill";
import {
  MEDIA_NEXT_STEP_CODES,
  MEDIA_NEXT_STEP_EXPLANATIONS,
  evaluateMediaNextStep,
  formatMediaNextStep,
  type MediaNextStep,
  type PackageStateFact,
} from "../../src/features/content-composition/media-next-step";
import { readContentMediaPrefills, type ContentMediaSourceDeps } from "../../src/features/content-composition/heby-content-media-source.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const NEXT = strip(read("src/features/content-composition/media-next-step.ts"));
const COMPONENT = strip(read("src/components/operations-preparation/heby-media-prefill.tsx"));

const OFF: ProviderSwitchFacts = { textToVideo: false, imageToVideo: false, image: "not-read" };
const T2V_ON: ProviderSwitchFacts = { textToVideo: true, imageToVideo: false, image: "not-read" };
const m = (assetId: string, kind: "image" | "video", origin: "generated" | "supplied", review: MediaFact["review"], selected = false): MediaFact => ({
  assetId, kind, origin, lifecycle: "admitted", review, selectedInCurrentRevision: selected,
});
const at = (invocationId: string, state: string, admissionOutcome = "not-attempted"): GenerationAttemptFact => ({ invocationId, state, admissionOutcome, sourceMediaAssetId: null });
const draft = (media: MediaFact[], attempts: GenerationAttemptFact[] = [], over: Partial<DraftMediaFacts> = {}): DraftMediaFacts => ({
  artifactId: "d1", currentRevision: 3, destination: "instagram", packageReadable: true, media, attempts, ...over,
});
const BLOCKED_COPY: PackageStateFact = { status: "read", ready: false, blockers: ["copy-unreviewed"] };
const READY: PackageStateFact = { status: "read", ready: true, blockers: [] };
const NO_MEDIA: PackageStateFact = { status: "read", ready: false, blockers: ["no-media-selected", "copy-unreviewed"] };

function step(facts: DraftMediaFacts, pkg: PackageStateFact = NO_MEDIA, sw: ProviderSwitchFacts = OFF): MediaNextStep {
  const choice = evaluateMediaChoice(facts, sw);
  return evaluateMediaNextStep(facts, choice, prefillFromChoice(facts, choice), pkg);
}

async function main(): Promise<void> {
  for (const c of MEDIA_NEXT_STEP_CODES) assert.ok(MEDIA_NEXT_STEP_EXPLANATIONS[c].length > 0);

  /* A · pending with the provider → pending; observe is a human click; nothing completed */
  {
    const s = step(draft([], [at("i1", "provider-pending")]));
    assert.equal(s.state, "generation-pending");
    assert.equal(s.humanAction, "observe-generation");
    assert.equal(s.mediaComplete, false);
    assert.deepEqual(s.invocationIds, ["i1"]);
    for (const st of ["registered", "dispatching", "dispatch-unknown"]) {
      const x = step(draft([], [at("i1", st)]));
      assert.equal(x.state, "generation-pending");
      assert.equal(x.humanAction, "none", `${st} has no human control; nothing is retried`);
    }
  }

  /* B · provider succeeded, not admitted → admission is not claimed */
  {
    const s = step(draft([], [at("i1", "provider-succeeded")]));
    assert.equal(s.state, "generation-awaiting-admission");
    assert.equal(s.humanAction, "admit-generation");
    assert.equal(s.mediaComplete, false);
    assert.deepEqual(s.assetIds, [], "no asset is named before admission");
  }

  /* C · admitted generated media without review → awaiting review */
  {
    const s = step(draft([m("g1", "video", "generated", "none")], [at("i1", "provider-succeeded", "admitted")]));
    assert.equal(s.state, "media-awaiting-review");
    assert.equal(s.humanAction, "review-media");
    assert.deepEqual(s.assetIds, ["g1"]);
  }

  /* D · declined → not eligible, no selection step */
  {
    const s = step(draft([m("g1", "video", "generated", "declined")]));
    assert.notEqual(s.state, "media-awaiting-selection");
    assert.ok(s.reasons.includes("media-review-declined"));
    assert.equal(s.mediaComplete, false);
  }

  /* E · accepted, not selected → awaiting selection */
  {
    const s = step(draft([m("v1", "video", "generated", "accepted")]));
    assert.equal(s.state, "media-awaiting-selection");
    assert.equal(s.humanAction, "select-media");
    assert.deepEqual(s.assetIds, ["v1"]);
  }

  /* F / G · selected → media complete; copy-unreviewed is outside the media loop */
  {
    const s = step(draft([m("ad", "video", "generated", "accepted", true), m("c3", "video", "generated", "accepted", true), m("s1", "image", "supplied", "not-applicable")]), BLOCKED_COPY);
    assert.equal(s.state, "media-complete");
    assert.equal(s.mediaComplete, true);
    assert.equal(s.humanAction, "none", "the media loop stops; it does not pursue copy review");
    assert.equal(s.packageReady, false);
    assert.deepEqual(s.outsideMediaBlockers, ["copy-unreviewed"]);
    assert.ok(s.reasons.includes("media-selection-satisfied"));
    assert.ok(s.reasons.includes("content-package-blocked"));
    assert.ok(s.reasons.includes("remaining-concern-outside-media"));
    assert.ok(s.reasons.includes("readiness-is-not-publish-authorization"));
    assert.deepEqual(s.assetIds, ["ad", "c3"]);
  }

  /* H · package ready → reported; never publish capability, authorization or success */
  {
    const s = step(draft([m("i1", "image", "generated", "accepted", true)]), READY);
    assert.equal(s.state, "media-complete");
    assert.equal(s.packageReady, true);
    assert.ok(s.reasons.includes("content-package-ready"));
    assert.ok(s.reasons.includes("readiness-is-not-publish-authorization"));
    for (const line of s.explanation) assert.doesNotMatch(line, /\b(published|authorized|approved)\b/i);
  }

  /* I · supplied media is never "awaiting review" */
  {
    const s = step(draft([m("s1", "image", "supplied", "not-applicable"), m("s2", "video", "supplied", "not-applicable")]));
    assert.notEqual(s.state, "media-awaiting-review");
    assert.ok(s.reasons.includes("supplied-media-outside-review"));
    assert.equal(s.reasons.includes("media-review-required"), false);
  }

  /* J · a blocked generation stays blocked and visible */
  {
    const onlyT2v = step(draft([]), NO_MEDIA, T2V_ON);
    assert.equal(onlyT2v.state, "media-blocked");
    assert.equal(onlyT2v.humanAction, "none");
    assert.ok(onlyT2v.unknowns.includes("price-unknown"), "HEBY-MEDIA-2 unknowns carried unchanged");
    const off = step(draft([]));
    assert.equal(off.state, "ask-human");
    assert.ok(off.blockers.includes("provider-disabled"));
  }

  /* K · stale facts: nothing is stored; the next evaluation reflects current truth */
  {
    const before = step(draft([m("v1", "video", "generated", "accepted")]));
    const after = step(draft([m("v1", "video", "generated", "accepted", true)]), BLOCKED_COPY);
    assert.equal(before.state, "media-awaiting-selection");
    assert.equal(after.state, "media-complete");
    assert.equal(step(draft([m("v1", "video", "generated", "accepted")], [], { packageReadable: false }), { status: "unavailable" }).state, "unavailable");
  }

  /* L / M · through the integration: session tenant only, no sensitive material */
  {
    const seen: unknown[] = [];
    const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as unknown as TenantContext;
    const D = "57b57106-2848-41f7-a5b3-d2475e0b7dba";
    const deps: ContentMediaSourceDeps = {
      listArtifacts: (async (t: unknown) => (seen.push(t), { status: "read", artifacts: [{ id: D, artifactType: "content-draft", lifecycleStatus: "draft", currentRevision: 3, title: "t", intendedDestination: "instagram" }] })) as never,
      listImages: (async (t: unknown) => (seen.push(t), { status: "read", assets: [{ assetId: "b4", origin: "supplied", mimeType: "image/jpeg", width: 1, height: 1, lifecycle: "admitted", sourceArtifactId: D, sourceRevisionNo: 3, storageKey: "KEY-SECRET" }] })) as never,
      listVideos: (async (t: unknown) => (seen.push(t), {
        status: "read",
        videos: ["ad", "c3"].map((id) => ({ assetId: id, origin: "generated", mimeType: "video/mp4", width: 1, height: 1, durationMs: 1, videoCodec: "h264", audioCodec: null, frameRate: "24/1", lifecycle: "admitted", sourceArtifactId: D, sourceRevisionNo: 3, invocationId: `i-${id}`, byteDigest: "DIGEST-SECRET" })),
      })) as never,
      listGenerations: (async (t: unknown) => (seen.push(t), { status: "read", generations: [{ invocationId: "i-ad", state: "provider-succeeded", admissionOutcome: "admitted", sourceArtifactId: D, sourceRevisionNo: 3, sourceMediaAssetId: "3f", provider: "higgsfield", model: "m", simulated: false, providerOutputRef: "https://cdn.example/SECRET" }] })) as never,
      readReviewStates: (async (t: unknown, idsIn: readonly string[]) => (seen.push(t), new Map(idsIn.map((id) => [id, { status: "read", decision: "accepted", decisionId: "d", decidedAt: "x", decisionCount: 1 }])))) as never,
      readPackage: (async (t: unknown) => (seen.push(t), { status: "read", package: { revisionNo: 3, selected: [{ mediaAssetId: "ad", mediaKind: "video" }, { mediaAssetId: "c3", mediaKind: "video" }], blockers: ["copy-unreviewed"], ready: false } })) as never,
      readProviderSwitch: async () => false,
    };
    const listing = await readContentMediaPrefills(TENANT, deps);
    for (const t of seen) assert.equal(t, TENANT);
    assert.equal(listing.status, "read");
    if (listing.status !== "read") return;
    const s = listing.nextSteps[0]!;
    assert.equal(s.state, "media-complete", "the production shape: media complete");
    assert.deepEqual(s.outsideMediaBlockers, ["copy-unreviewed"]);
    const all = JSON.stringify(listing);
    for (const x of ["SECRET", "https://", "storage"]) assert.equal(all.includes(x), false, `must not carry ${x}`);
    assert.equal((await readContentMediaPrefills(null, deps)).status, "unavailable");
  }

  /* N · zero new mutation authority */
  {
    const imports = [...NEXT.matchAll(/^import\s.*$/gm)].map((x) => x[0]);
    assert.deepEqual(imports, [
      'import type { DraftMediaFacts, MediaChoice, MediaChoiceCode } from "./media-choice";',
      'import type { MediaPrefill } from "./media-prefill";',
    ], "type-only imports; nothing at runtime");
    for (const banned of ["fetch(", "process.", "Date", "Math.random", "await ", "async ", "require(", "import(", ".insert(", ".update(", ".delete(", "setTimeout", "setInterval"]) {
      assert.equal(NEXT.includes(banned), false, `the next-step evaluator must not use ${banned}`);
    }
    assert.doesNotMatch(NEXT, /\b(poll|admit|review|select|publish|dispatch|register)[A-Z]\w*\(/, "no lifecycle call");
    assert.equal((COMPONENT.match(/Action\(/g) ?? []).length, 1, "the component still reaches exactly one action: the existing selection");
    assert.doesNotMatch(COMPONENT, /useEffect|setTimeout|setInterval|observeVideoGenerationAction|admitGeneratedVideoAction|reviewMediaAssetAction/);
    const frozen = Object.freeze(draft([Object.freeze(m("v1", "video", "generated", "accepted", true))]));
    const before = JSON.stringify(frozen);
    step(frozen, BLOCKED_COPY);
    assert.equal(JSON.stringify(frozen), before);
  }

  /* O · stable for identical input, independent of order */
  {
    const media = [m("v2", "video", "generated", "accepted"), m("g1", "video", "generated", "none"), m("v1", "video", "generated", "accepted")];
    const a = step(draft(media, [at("i2", "provider-failed"), at("i1", "provider-succeeded", "refused")]));
    const b = step(draft([...media].reverse(), [at("i1", "provider-succeeded", "refused"), at("i2", "provider-failed")]));
    assert.deepEqual(a, b);
    assert.deepEqual(formatMediaNextStep(a), formatMediaNextStep(b));
    assert.ok(a.reasons.includes("generation-failed"));
    assert.ok(a.reasons.includes("admission-not-completed"));
  }

  console.log("heby-media-4/next-step: OK");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
