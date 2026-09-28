/*
 * tests/heby-media-3/prefill.ts — HEBY-MEDIA-3: a recommendation prepared for an existing human
 * action, and nothing more. Cases A–L from the phase brief.
 *
 *   Heby prefill (pure data) → existing human UI → explicit click → existing action → writer
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { evaluateMediaChoice, type DraftMediaFacts, type MediaChoice, type MediaFact, type ProviderSwitchFacts } from "../../src/features/content-composition/media-choice";
import { prefillFromChoice, type MediaPrefill } from "../../src/features/content-composition/media-prefill";
import { readContentMediaPrefills, type ContentMediaSourceDeps } from "../../src/features/content-composition/heby-content-media-source.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const PREFILL = strip(read("src/features/content-composition/media-prefill.ts"));
const COMPONENT = strip(read("src/components/operations-preparation/heby-media-prefill.tsx"));
const ACTIONS = strip(read("src/app/(dashboard)/operations/actions.ts"));

const OFF: ProviderSwitchFacts = { textToVideo: false, imageToVideo: false, image: "not-read" };
const T2V_ON: ProviderSwitchFacts = { textToVideo: true, imageToVideo: false, image: "not-read" };
const ALL_ON: ProviderSwitchFacts = { textToVideo: true, imageToVideo: true, image: "not-read" };

const m = (assetId: string, kind: "image" | "video", origin: "generated" | "supplied", review: MediaFact["review"], selected = false): MediaFact => ({
  assetId, kind, origin, lifecycle: "admitted", review, selectedInCurrentRevision: selected,
});
const draft = (media: MediaFact[], over: Partial<DraftMediaFacts> = {}): DraftMediaFacts => ({
  artifactId: "d1", currentRevision: 3, destination: "instagram", packageReadable: true, media, attempts: [], ...over,
});
const prep = (facts: DraftMediaFacts, sw: ProviderSwitchFacts): MediaPrefill => prefillFromChoice(facts, evaluateMediaChoice(facts, sw));

async function main(): Promise<void> {
  /* A · use-existing, not selected → select-existing, data only */
  {
    const p = prep(draft([m("v1", "video", "generated", "accepted"), m("v2", "video", "generated", "accepted")]), OFF);
    assert.equal(p.kind, "select-existing");
    if (p.kind === "select-existing") {
      assert.deepEqual(p.assetIds, ["v1", "v2"]);
      assert.deepEqual(p.alreadySelected, []);
    }
    assert.equal(p.artifactId, "d1");
    assert.equal(p.revisionNo, 3);
    assert.equal(p.recommendation, "use-existing");
  }

  /* B · already selected → satisfied, no action */
  {
    const p = prep(draft([m("v1", "video", "generated", "accepted", true), m("v2", "video", "generated", "accepted", true)]), OFF);
    assert.equal(p.kind, "satisfied");
    assert.equal("alreadySelected" in p, false);
    assert.match(COMPONENT, /prefill\.kind === "satisfied"[\s\S]*?No selection is needed\.[\s\S]*?\) : null\}/);
    const satisfiedBranch = COMPONENT.slice(COMPONENT.indexOf('prefill.kind === "satisfied"'), COMPONENT.indexOf('prefill.kind === "select-existing"'));
    assert.doesNotMatch(satisfiedBranch, /Button|onClick|SelectOne/, "a satisfied prefill renders no control");
  }

  /* C / E · blocked generation, provider off → no actionable prefill */
  {
    const onlyT2v = prep(draft([]), T2V_ON);
    assert.equal(onlyT2v.recommendation, "generate-text-to-video");
    assert.equal(onlyT2v.kind, "generation-not-actionable", "price-unknown and unverified readiness keep it non-actionable");
    if (onlyT2v.kind === "generation-not-actionable") {
      assert.ok(onlyT2v.unknowns.includes("price-unknown"));
      assert.ok(onlyT2v.unknowns.includes("provider-readiness-unverified"));
    }
    const off = prep(draft([]), OFF);
    assert.equal(off.kind, "ask-human");
    if (off.kind === "ask-human") assert.ok(off.blockers.includes("provider-disabled"));
    const genBranch = COMPONENT.slice(COMPONENT.indexOf('prefill.kind === "generation-not-actionable"'), COMPONENT.indexOf('prefill.kind === "ask-human"'));
    assert.doesNotMatch(genBranch, /Button|onClick|Action\(/, "a generation prefill renders no control");
    assert.doesNotMatch(COMPONENT, /request\w*Generation|GenerateVideoWithHebun|GenerateImageWithHebun/, "no generation door is wired");
  }

  /* D · image-to-video with data use unresolved → never actionable, whatever the source id */
  {
    const forced: MediaChoice = {
      ...evaluateMediaChoice(draft([m("3f7b9e66-b165-86df-ab9b-77fcc7d36f14", "image", "supplied", "not-applicable")]), ALL_ON),
      kind: "generate-image-to-video",
    };
    const p = prefillFromChoice(draft([m("3f7b9e66-b165-86df-ab9b-77fcc7d36f14", "image", "supplied", "not-applicable")]), forced);
    assert.equal(p.kind, "generation-not-actionable");
    if (p.kind === "generation-not-actionable") assert.ok(p.blockers.includes("data-use-unresolved"));
    assert.equal(JSON.stringify(p).includes("sourceAssetId"), false, "no source is prepared for a provider");
  }

  /* F · none-ask-human → explanation only */
  {
    const p = prep(draft([m("i1", "image", "generated", "accepted"), m("v1", "video", "generated", "accepted")]), OFF);
    assert.equal(p.kind, "ask-human");
    assert.equal("assetIds" in p, false, "no asset is prepared for an action");
    assert.ok(p.explanation.length > 0);
    const askBranch = COMPONENT.slice(COMPONENT.indexOf('prefill.kind === "ask-human"'), COMPONENT.indexOf("prefill.reviewPending.length"));
    assert.doesNotMatch(askBranch, /Button|onClick/);
  }

  /* G · stale or tampered recommendation → only current, eligible facts are prepared; the writer still decides */
  {
    const facts = draft([m("v1", "video", "generated", "accepted"), m("s1", "video", "supplied", "not-applicable"), m("g1", "video", "generated", "none")]);
    const tampered: MediaChoice = { ...evaluateMediaChoice(facts, OFF), kind: "use-existing", assetIds: ["v1", "s1", "g1", "foreign"] };
    const p = prefillFromChoice(facts, tampered);
    assert.equal(p.kind, "select-existing");
    if (p.kind === "select-existing") assert.deepEqual(p.assetIds, ["v1"], "supplied, unreviewed and unknown ids are never prepared");
    const nothing = prefillFromChoice(facts, { ...tampered, assetIds: ["foreign"] });
    assert.equal(nothing.kind, "ask-human");
    /* The one call site sends exactly the card's three values; the action resolves the tenant and the writer revalidates. */
    const calls = [...COMPONENT.matchAll(/setMediaSelectionAction\(\{([^}]*)\}\)/g)].map((x) => x[1]!.replace(/\s+/g, " ").trim());
    assert.deepEqual(calls, ["artifactId, revisionNo, mediaAssetId: assetId, selected: true"]);
    const action = ACTIONS.slice(ACTIONS.indexOf("export async function setMediaSelectionAction"), ACTIONS.indexOf("export async function readContentPackageAction"));
    assert.match(action, /const tenant = await resolveTenantContext\(\);/);
    assert.match(action, /selectMediaForRevision\(tenant, payload\)/, "the released writer, with the session tenant, unchanged");
  }

  /* H · tenant scope: the reader takes the session tenant and forwards it; none reads nothing */
  {
    const seen: unknown[] = [];
    const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as unknown as TenantContext;
    const D = "57b57106-2848-41f7-a5b3-d2475e0b7dba";
    const deps: ContentMediaSourceDeps = {
      listArtifacts: (async (t: unknown) => (seen.push(t), { status: "read", artifacts: [{ id: D, artifactType: "content-draft", lifecycleStatus: "draft", currentRevision: 3, title: "t", intendedDestination: "instagram" }] })) as never,
      listImages: (async (t: unknown) => (seen.push(t), { status: "read", assets: [{ assetId: "b4", origin: "supplied", mimeType: "image/jpeg", width: 1, height: 1, lifecycle: "admitted", sourceArtifactId: D, sourceRevisionNo: 3, suppliedSourceFileId: "DRIVE-SECRET", storageKey: "KEY-SECRET" }] })) as never,
      listVideos: (async (t: unknown) => (seen.push(t), {
        status: "read",
        videos: ["ad", "c3"].map((id) => ({ assetId: id, origin: "generated", mimeType: "video/mp4", width: 1, height: 1, durationMs: 1, videoCodec: "h264", audioCodec: null, frameRate: "24/1", lifecycle: "admitted", sourceArtifactId: D, sourceRevisionNo: 3, invocationId: `i-${id}`, byteDigest: "DIGEST-SECRET", storageKey: "KEY-SECRET" })),
      })) as never,
      listGenerations: (async (t: unknown) => (seen.push(t), { status: "read", generations: [{ invocationId: "i-ad", state: "provider-succeeded", admissionOutcome: "admitted", sourceArtifactId: D, sourceRevisionNo: 3, sourceMediaAssetId: "3f", provider: "higgsfield", model: "m", simulated: false, providerOutputRef: "https://cdn.example/SECRET" }] })) as never,
      readReviewStates: (async (t: unknown, ids: readonly string[]) => (seen.push(t), new Map(ids.map((id) => [id, { status: "read", decision: "accepted", decisionId: "d", decidedAt: "x", decisionCount: 1 }])))) as never,
      readPackage: (async (t: unknown) => (seen.push(t), { status: "read", package: { revisionNo: 3, selected: [{ mediaAssetId: "ad", mediaKind: "video" }, { mediaAssetId: "c3", mediaKind: "video" }], blockers: ["copy-unreviewed"], ready: false } })) as never,
      readProviderSwitch: async () => false,
    };
    const none = await readContentMediaPrefills(null, deps);
    assert.equal(none.status, "unavailable");
    assert.equal(seen.length, 0, "no tenant, no read");
    const listing = await readContentMediaPrefills(TENANT, deps);
    for (const t of seen) assert.equal(t, TENANT);
    assert.equal(listing.status, "read");
    if (listing.status !== "read") return;
    const p = listing.prefills[0]!;
    /* The production shape: both reviewed videos already selected → satisfied, nothing to do. */
    assert.equal(p.kind, "satisfied");
    if (p.kind === "satisfied") assert.deepEqual(p.assetIds, ["ad", "c3"]);

    /* L · sensitive material never reaches a prefill */
    const all = JSON.stringify(listing);
    for (const s of ["SECRET", "https://", "storage", "Drive"]) assert.equal(all.includes(s), false, `prefill must not carry ${s}`);
  }

  /* I · human attribution: no actor, principal or tenant travels from the prefill or the component */
  {
    for (const src of [PREFILL, COMPONENT]) {
      assert.doesNotMatch(src, /tenantId|userId|actorType|requestedBy|asHumanTenantContext|principal|agentId/i);
    }
    assert.match(ACTIONS, /export async function readHebyMediaPrefillsAction\(\): Promise<ContentMediaPrefillListing> \{\n\s*return readContentMediaPrefills\(await resolveTenantContext\(\)\);\n\}/, "the read takes no input; the tenant is the session's");
  }

  /* J · publish is absent from this phase */
  {
    for (const src of [PREFILL, COMPONENT]) {
      assert.doesNotMatch(src, /publish|heby-action-inlet|action-authorization|action-execution|recordActionRequest/i);
    }
  }

  /* K · the prefill module is pure and cannot mutate */
  {
    const imports = [...PREFILL.matchAll(/^import\s.*$/gm)].map((x) => x[0]);
    assert.deepEqual(imports, ['import type { DraftMediaFacts, GenerationPath, MediaChoice, MediaChoiceCode } from "./media-choice";']);
    for (const banned of ["fetch(", "process.", "Date", "Math.random", "await ", "async ", "require(", "import(", ".insert(", ".update(", ".delete("]) {
      assert.equal(PREFILL.includes(banned), false, `the prefill must not use ${banned}`);
    }
    assert.doesNotMatch(COMPONENT, /useEffect|setTimeout|setInterval/, "nothing acts on render, mount or timer");
    assert.equal((COMPONENT.match(/setMediaSelectionAction\(/g) ?? []).length, 1, "exactly one mutation call site, reached by a click");
    const componentImports = [...COMPONENT.matchAll(/^import\s.*$/gm)].map((x) => x[0]).sort();
    assert.deepEqual(componentImports, [
      'import type { MediaPrefill } from "@/features/content-composition/media-prefill";',
      'import type { MediaNextStep } from "@/features/content-composition/media-next-step";',
      'import { Badge } from "@/components/ui/badge";',
      'import { Button } from "@/components/ui/button";',
      'import { setMediaSelectionAction } from "@/app/(dashboard)/operations/actions";',
      'import { useState, useTransition } from "react";',
    ].sort());
    const frozen = Object.freeze(draft([Object.freeze(m("v1", "video", "generated", "accepted"))]));
    const before = JSON.stringify(frozen);
    prep(frozen, OFF);
    assert.equal(JSON.stringify(frozen), before);
  }

  /* Review is never prefilled: pending review is named, never decided or reasoned */
  {
    const p = prep(draft([m("g1", "video", "generated", "none"), m("v1", "video", "generated", "accepted")]), OFF);
    assert.deepEqual(p.reviewPending, ["g1"]);
    assert.doesNotMatch(COMPONENT, /reviewMediaAssetAction|Accept video|Decline video|justification/);
  }

  /* Stable: same facts → same prefill */
  {
    const f = draft([m("v2", "video", "generated", "accepted"), m("v1", "video", "generated", "accepted")]);
    assert.deepEqual(prep(f, OFF), prep(draft([...f.media].reverse()), OFF));
  }

  console.log("heby-media-3/prefill: OK");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
