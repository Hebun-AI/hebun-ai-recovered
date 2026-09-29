/*
 * tests/heby-truth-ux-repair-1/unknown-not-false.ts — HEBY-TRUTH-UX-REPAIR-1, final truth semantics.
 *
 * Production turn 74577168 (TRH, 08:17Z) grounded Black Rose correctly and still said "YouTube
 * capability unknown", "tenant arming — not done" and "never published anywhere". Proven causes:
 *   1. the work-artifacts line for the same draft asserted "no provider connection exists … nothing
 *      was published" (CGO-2 wording from before any connection or publish path existed);
 *   2. the capability fact sat only inside content-media's long source text, not its summary line;
 *   3. "requires … tenant arming" was read as "arming not done", and nothing told the model that
 *      absence of evidence is not a negative fact.
 * The real work-artifacts sentence is proved against a database in tests/cgo2-destination-grounding.
 * The model's own wording cannot be proved here; what it is GIVEN can.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  answerHebyModelRequest,
  HEBY_MODEL_SYSTEM_INSTRUCTIONS,
  type HebyModelAnswerDeps,
} from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";
import {
  readContentMediaGroundingSource,
  type ContentMediaSourceDeps,
} from "../../src/features/content-composition/heby-content-media-source.server";
import { MEDIA_CHOICE_EXPLANATIONS } from "../../src/features/content-composition/media-choice";
import { createFakeClaudeTransport } from "../helpers/fake-claude-transport";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TRH = { tenantId: "9947c78e-2080-4331-81c6-456cb4be7a96", userId: "u-trh" } as unknown as TenantContext;
const DRAFT = "bd3ab228-61c2-4b42-a2a9-82bd23e8eae1";
const VID = "0e32a72d-e85e-4e97-9c9c-ed29a8058f25";
const QUESTION = "Black Rose Floral Kilim Rug taslağı şu an YouTube'a yüklenmeye hazır mı?";

type Cap = { providerKey: string; readAvailable: boolean; writeCapable: boolean }[];

function readers(capability: Cap | "throws", seen: string[], ready = true): ContentMediaSourceDeps {
  const t = (x: unknown) => seen.push((x as TenantContext).tenantId);
  return {
    listArtifacts: (async (x: unknown) => (t(x), {
      status: "read",
      artifacts: [{ id: DRAFT, artifactType: "content-draft", lifecycleStatus: "draft", currentRevision: 2, title: "Black Rose Floral Kilim Rug", intendedDestination: "youtube" }],
    })) as never,
    listImages: (async (x: unknown) => (t(x), { status: "read", assets: [] })) as never,
    listVideos: (async (x: unknown) => (t(x), {
      status: "read",
      videos: [{ assetId: VID, origin: "supplied", mimeType: "video/mp4", width: 1280, height: 720, durationMs: 15083, videoCodec: "h264", audioCodec: "aac", frameRate: "30/1", lifecycle: "admitted", sourceArtifactId: DRAFT, sourceRevisionNo: 2, invocationId: null }],
    })) as never,
    listGenerations: (async (x: unknown) => (t(x), { status: "read", generations: [] })) as never,
    readReviewStates: (async (x: unknown, ids: readonly string[]) => (t(x), new Map(ids.map((id) => [id, { status: "read", decision: ready ? "accepted" : null }])))) as never,
    readPackage: (async (x: unknown) => (t(x), {
      status: "read",
      package: ready
        ? { selected: [{ mediaAssetId: VID, mediaKind: "video", origin: "supplied" }], blockers: [], ready: true, copyReviewState: "approved", destination: "youtube" }
        : { selected: [], blockers: ["no-media-selected"], ready: false, copyReviewState: "approved", destination: "youtube" },
    })) as never,
    readProviderSwitch: async () => false,
    readCapabilityAvailability: (async (x: unknown) => {
      t(x);
      if (capability === "throws") throw new Error("authority unreadable");
      const available = capability.some((s) => s.readAvailable);
      return {
        readiness: "catalog-ready",
        capabilities: [{ capability: "google.youtube.video.upload", state: available ? "available" : "degraded", reason: null, sources: capability.map((s, i) => ({ integrationId: `i${i}`, accountLabel: null, lastVerifiedAt: null, ...s })) }],
      };
    }) as never,
  };
}

async function detailFor(capability: Cap | "throws", ready = true): Promise<string> {
  const r = await readContentMediaGroundingSource(TRH, readers(capability, [], ready));
  return r.items.find((i) => i.recordRef === `work-artifact/${DRAFT}@2`)!.detail;
}

const UPLOAD: Cap = [{ providerKey: "google-youtube", readAvailable: true, writeCapable: true }];
const READONLY: Cap = [{ providerKey: "google-youtube", readAvailable: true, writeCapable: false }];

async function grounding(route: string, capability: Cap): Promise<{ lines: string; system: string }> {
  const generated: ModelGenerationRequest[] = [];
  const seen: string[] = [];
  const deps: HebyModelAnswerDeps = {
    resolveTenant: async () => TRH,
    readOverview: () => undefined,
    env: { HEBUN_MODEL_CONNECTIVITY_ENABLED: "true", HEBUN_MODEL_PROVIDER: "claude", HEBUN_MODEL_ID: "m", HEBUN_MODEL_CREDENTIAL: "x" },
    resolveDirectorEnabled: async () => true,
    selectTransport: () => ({ transport: createFakeClaudeTransport("success"), transportProvenance: "fake" }),
    generate: async (request, d) => (generated.push(request), generateHebyModelAnswer(request, d)),
    getConversationRepo: () => null,
    newCorrelationId: () => "corr",
    resolveContentMedia: (t) => readContentMediaGroundingSource(t, readers(capability, seen)),
  };
  const answered = await answerHebyModelRequest({ prompt: QUESTION, route }, deps);
  assert.equal(answered.status, "answered");
  assert.ok(seen.length > 0 && seen.every((x) => x === TRH.tenantId), "I · every read is for the asking tenant");
  return { lines: generated[0]!.evidence.join("\n"), system: generated[0]!.systemInstructions };
}

/* Phrases that would turn absence into a negative organizational fact. */
const NEGATIVE_FACTS = /no provider connection exists|nothing was published|nothing is scheduled|never published|not armed|arming (is )?(active|withdrawn)|tenant-arming-withdrawn/i;

async function main(): Promise<void> {
  /* ── A · an available capability is on the summary line, not only in the source text ── */
  const capable = await detailFor(UPLOAD);
  assert.match(capable, /governed publish path \(YouTube video\): this organization holds the capability now \(read from the integration authority; not an authorization\)/);
  assert.match(capable, /package ready: yes/, "F · readiness unchanged");
  assert.match(capable, /media complete: yes/);

  /* ── B · an insufficient or unreadable capability is never stated as held ── */
  const readonly = await detailFor(READONLY);
  assert.match(readonly, /governed publish path \(YouTube video\) exists; this organization does not hold its capability now/);
  assert.doesNotMatch(readonly, /holds the capability now/);
  const unreadable = await detailFor("throws");
  assert.match(unreadable, /whether this organization holds its capability could not be read/);
  assert.doesNotMatch(unreadable, /holds the capability now|does not hold/, "unknown is not no");

  /* ── F / G · a not-ready draft keeps its real state; capability is still not authorization ── */
  const notReady = await detailFor(UPLOAD, false);
  assert.match(notReady, /package ready: no/);
  assert.match(notReady, /media complete: no/);
  assert.match(notReady, /governed publish path \(YouTube video\): this organization holds the capability now \(read from the integration authority; not an authorization\)/, "G · a not-ready package still has the path, and capability is not authorization");
  assert.doesNotMatch(notReady, /no publish path/, "an unreviewed video does not erase the YouTube path");

  /* ── C / D · the governed-path explanation names the gates without stating their state ── */
  const why = MEDIA_CHOICE_EXPLANATIONS["publish-path-governed"];
  assert.match(why, /requires a human proposal, Governance approval, a single-use permit and tenant arming/);
  assert.match(why, /does not show whether any proposal, approval, permit or arming exists now, or whether this package was uploaded before/);
  assert.match(why, /not shown is not 'not done'/);
  assert.doesNotMatch(why, NEGATIVE_FACTS);

  /* ── the model contract: absence is never turned into a negative fact ── */
  assert.match(HEBY_MODEL_SYSTEM_INSTRUCTIONS, /Never turn missing evidence into a negative fact/);
  assert.match(HEBY_MODEL_SYSTEM_INSTRUCTIONS, /say it is not shown in your context — never that it does not exist, was not done or never happened/);
  assert.match(HEBY_MODEL_SYSTEM_INSTRUCTIONS, /A requirement is not a state/);
  assert.match(HEBY_MODEL_SYSTEM_INSTRUCTIONS, /You never approve, authorize, execute/, "H · Heby's authority line is intact");

  /* ── what the model is GIVEN on both routes the Director uses ── */
  for (const route of ["/heby", "/operations"]) {
    const { lines, system } = await grounding(route, UPLOAD);
    assert.equal(system, HEBY_MODEL_SYSTEM_INSTRUCTIONS, `${route}: the contract reaches the model`);
    const draftLine = lines.split("\n").find((l) => l.startsWith(`[content-media/work-artifact/${DRAFT}@2]`)) ?? "";
    assert.match(draftLine, /governed publish path \(YouTube video\): this organization holds the capability now/, `${route}: A · capability on the draft line`);
    assert.match(draftLine, /package ready: yes/, `${route}: F`);
    assert.match(draftLine, /upload\/posting history of this draft: not carried by this source — unknown here/, `${route}: A · history unknown reaches the model`);
    assert.doesNotMatch(lines, NEGATIVE_FACTS, `${route}: C/D · no negative fact about connection, publish or arming is handed to the model`);
    assert.doesNotMatch(lines, /\barming\b[^.|]*\b(active|withdrawn|armed)\b/i, `${route}: C · no arming state is handed to the model`);
  }

  /*
   * ── Production turn d53d2004 (09:58Z): "Yayınlanmadı" as a STATUS, and "Hebun records every act,
   * so a record would exist" — while its own recorded-acts evidence said coverage is PARTIAL and
   * Hebun does not record every act. Both were model inference; neither was in the grounding.
   */
  /* A · the draft line carries the history as unknown, so an empty status field has its true value */
  for (const d of [capable, readonly, unreadable, notReady]) {
    assert.match(d, /upload\/posting history of this draft: not carried by this source — unknown here, which is not 'none'/);
  }
  assert.doesNotMatch(capable, /\bpublished\b|\buploaded\b(?! before)/i, "the line states no upload outcome either way");

  /* B · labels, headings and status fields are claims too */
  assert.match(HEBY_MODEL_SYSTEM_INSTRUCTIONS, /every heading, label, status field, summary and conclusion you write/);
  assert.match(HEBY_MODEL_SYSTEM_INSTRUCTIONS, /is written as unknown or not shown, never as no, not published, not uploaded or not done/);

  /* C · the grounding is a bounded selection; its silence is not Hebun's */
  assert.match(HEBY_MODEL_SYSTEM_INSTRUCTIONS, /bounded selection of this organization's records, not all of them/);
  assert.match(HEBY_MODEL_SYSTEM_INSTRUCTIONS, /never say that Hebun has no record of something, that Hebun records everything, or that something would appear here had it happened/);

  /* D · a source that IS complete for its question may still be reported as complete */
  assert.match(HEBY_MODEL_SYSTEM_INSTRUCTIONS, /unless a source in your context explicitly says it is complete for that question/);

  /* ── the real work-artifacts sentence (proved against a database in cgo2) says unknown, not no ── */
  const source = readFileSync(path.join(process.cwd(), "src/features/work-artifacts/work-artifact-evidence.server.ts"), "utf8");
  assert.match(source, /this record does not show whether a provider connection exists/);
  assert.doesNotMatch(source.replace(/\/\*[\s\S]*?\*\//g, ""), /"destination is DECLARED ONLY — no provider connection exists/);

  console.log("heby-truth-ux-repair-1/unknown-not-false: OK");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
