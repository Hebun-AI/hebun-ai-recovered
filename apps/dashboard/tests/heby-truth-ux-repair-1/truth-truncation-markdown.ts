/*
 * tests/heby-truth-ux-repair-1/truth-truncation-markdown.ts — HEBY-TRUTH-UX-REPAIR-1.
 *
 * Three defects seen in the HEBY-CONTENT-OPS-1 production ceremony:
 *   A. Heby said no path publishes a video to YouTube (a static table predating YOUTUBE-WRITE-2).
 *   B. Answers stopped mid-sentence (a 300-token output ceiling; `max_tokens` read and dropped).
 *   C. Markdown was shown as literal characters (the bubble printed the text verbatim).
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  evaluateMediaChoice,
  MEDIA_CHOICE_EXPLANATIONS,
  type DraftMediaFacts,
  type ProviderSwitchFacts,
} from "../../src/features/content-composition/media-choice";
import {
  readContentMediaGroundingSource,
  type ContentMediaSourceDeps,
} from "../../src/features/content-composition/heby-content-media-source.server";
import { answerHebyModelRequest, MODEL_OUTPUT_LIMIT_NOTE } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import {
  MODEL_OUTPUT_TOKEN_CEILING,
  resolveModelConnectivityConfig,
} from "../../src/features/heby-model/model-connectivity-environment.server";
import { MAX_LIVE_OUTPUT_TOKENS } from "../../src/features/heby-model-live/claude-http-transport.server";
import { splitModelDiagnostics } from "../../src/components/layout/heby/heby-provenance";
import { HebyMarkdown, isSafeHebyHref } from "../../src/components/layout/heby/heby-markdown";
import { HebyBubble } from "../../src/components/layout/heby/heby-turns";
import type { ClaudeTransport, ClaudeTransportRequest } from "../../src/features/heby-model";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as unknown as TenantContext;
const DRAFT = "bd3ab228-61c2-4b42-a2a9-82bd23e8eae1";
const VID = "0e32a72d-e85e-4e97-9c9c-ed29a8058f25";
const OFF: ProviderSwitchFacts = { textToVideo: false, imageToVideo: false, image: "not-read" };

function facts(destination: DraftMediaFacts["destination"], kind: "image" | "video"): DraftMediaFacts {
  return {
    artifactId: DRAFT,
    currentRevision: 2,
    destination,
    packageReadable: true,
    media: [{ assetId: VID, kind, origin: "supplied", lifecycle: "admitted", review: "accepted", selectedInCurrentRevision: true }],
    attempts: [],
  };
}

/* ── A · capability truth in the pure evaluator ─────────────────────────── */
function capabilityTruth(): void {
  const capable = evaluateMediaChoice(facts("youtube", "video"), OFF, { youtubeVideoUpload: "write-capable" });
  assert.equal(capable.kind, "use-existing");
  assert.ok(capable.reasons.includes("publish-path-governed"), "a write-capable tenant is told a governed path exists");
  assert.ok(!capable.reasons.includes("publish-capability-unavailable"), "never 'no path publishes' when one does");
  const said = capable.explanation.join(" ");
  assert.doesNotMatch(said, /no path that publishes/i);
  assert.match(said, /human proposal, Governance approval, a single-use permit and tenant arming/, "capable is not authorized or armed");
  assert.match(said, /Heby publishes nothing/, "Heby never claims it publishes");

  const short = evaluateMediaChoice(facts("youtube", "video"), OFF, { youtubeVideoUpload: "not-write-capable" });
  assert.ok(short.reasons.includes("publish-capability-not-granted"), "connected-but-not-write-capable is not publish-capable");
  assert.ok(!short.reasons.includes("publish-path-governed"));

  const unread = evaluateMediaChoice(facts("youtube", "video"), OFF);
  assert.ok(unread.unknowns.includes("publish-capability-unknown"), "nothing read is unknown, never available");
  assert.ok(!unread.reasons.includes("publish-path-governed"));

  /* Capability for YouTube VIDEO answers nothing else. */
  assert.ok(evaluateMediaChoice(facts("youtube", "image"), OFF, { youtubeVideoUpload: "write-capable" }).reasons.includes("publish-capability-unavailable"));
  assert.ok(evaluateMediaChoice(facts("instagram", "video"), OFF, { youtubeVideoUpload: "write-capable" }).reasons.includes("publish-capability-unavailable"));
  assert.ok(evaluateMediaChoice(facts("tiktok" as never, "video"), OFF, { youtubeVideoUpload: "write-capable" }).reasons.includes("publish-capability-unavailable"));

  /* A generation path never lists "a governed path exists" as an unknown. */
  for (const p of capable.paths) assert.ok(!p.unknowns.includes("publish-path-governed"));
  assert.doesNotMatch(MEDIA_CHOICE_EXPLANATIONS["publish-path-governed"], /\b(approved|authorized|published)\b/i);
}

/* ── A · the shaper reads the capability authority, for THIS tenant only ── */
function view(sources: { providerKey: string; readAvailable: boolean; writeCapable: boolean }[], state = "available") {
  return {
    readiness: "catalog-ready",
    capabilities: [
      { capability: "google.youtube.video.upload", state, reason: null, sources: sources.map((s, i) => ({ integrationId: `i${i}`, accountLabel: null, lastVerifiedAt: null, ...s })) },
    ],
  };
}

function shaperDeps(capability: ContentMediaSourceDeps["readCapabilityAvailability"], seen: unknown[]): ContentMediaSourceDeps {
  return {
    listArtifacts: (async () => ({
      status: "read",
      artifacts: [{ id: DRAFT, artifactType: "content-draft", lifecycleStatus: "draft", currentRevision: 2, title: "Black Rose", intendedDestination: "youtube" }],
    })) as never,
    listImages: (async () => ({ status: "read", assets: [] })) as never,
    listVideos: (async () => ({
      status: "read",
      videos: [{ assetId: VID, origin: "supplied", mimeType: "video/mp4", width: 1280, height: 720, durationMs: 15083, videoCodec: "h264", audioCodec: "aac", frameRate: "30/1", lifecycle: "admitted", sourceArtifactId: DRAFT, sourceRevisionNo: 2, invocationId: null }],
    })) as never,
    listGenerations: (async () => ({ status: "read", generations: [] })) as never,
    readReviewStates: (async (_t: unknown, ids: readonly string[]) => new Map(ids.map((id) => [id, { status: "read", decision: "accepted" }]))) as never,
    readPackage: (async () => ({
      status: "read",
      package: { selected: [{ mediaAssetId: VID, mediaKind: "video", origin: "supplied" }], blockers: [], ready: true, copyReviewState: "approved", destination: "youtube" },
    })) as never,
    readProviderSwitch: async () => false,
    readCapabilityAvailability: (async (t: unknown) => {
      seen.push(t);
      return capability!(t as never);
    }) as never,
  };
}

async function shaperTruth(): Promise<void> {
  const cases: [string, ContentMediaSourceDeps["readCapabilityAvailability"], RegExp][] = [
    ["write-capable", (async () => view([{ providerKey: "google-youtube", readAvailable: true, writeCapable: true }])) as never, /publish-path-governed/],
    ["readonly scope only", (async () => view([{ providerKey: "google-youtube", readAvailable: true, writeCapable: false }])) as never, /publish-capability-not-granted/],
    ["degraded", (async () => view([], "degraded")) as never, /publish-capability-not-granted/],
    ["two upload connections", (async () => view([
      { providerKey: "google-youtube", readAvailable: true, writeCapable: true },
      { providerKey: "google-youtube", readAvailable: true, writeCapable: true },
    ])) as never, /publish-capability-not-granted/],
    ["another provider's source", (async () => view([{ providerKey: "google-workspace", readAvailable: true, writeCapable: true }])) as never, /publish-capability-not-granted/],
    ["authority throws", (async () => { throw new Error("db down"); }) as never, /publish-capability-unknown/],
  ];
  for (const [label, capability, expected] of cases) {
    const seen: unknown[] = [];
    const r = await readContentMediaGroundingSource(TENANT, shaperDeps(capability, seen));
    assert.equal(r.state, "resolved", label);
    const content = r.items[0]?.content ?? "";
    assert.match(content, expected, label);
    const reasons = content.split("\n").find((l) => l.startsWith("reasons: ")) ?? "";
    assert.doesNotMatch(reasons, /publish-capability-unavailable/, `${label}: YouTube video is never 'no path'`);
    assert.doesNotMatch(content, /why: Hebun has no path that publishes/, `${label}: the reason Heby reads never says 'no path'`);
    assert.deepEqual(seen, [TENANT], `${label}: the capability is read once, for exactly the authenticated tenant`);
  }
}

/* ── B · the output ceiling and the explicit cut ────────────────────────── */
async function truncation(): Promise<void> {
  assert.equal(MODEL_OUTPUT_TOKEN_CEILING, 1024, "Director-set ceiling");
  assert.equal(MAX_LIVE_OUTPUT_TOKENS, MODEL_OUTPUT_TOKEN_CEILING, "the live transport still imports the one ceiling");
  const env = { HEBUN_MODEL_CONNECTIVITY_ENABLED: "true", HEBUN_MODEL_PROVIDER: "claude", HEBUN_MODEL_ID: "m", HEBUN_MODEL_CREDENTIAL: "x" };
  assert.equal(resolveModelConnectivityConfig(env).maxOutputTokens, 1024, "no override → the ceiling (Vercel production sets none)");
  assert.equal(resolveModelConnectivityConfig({ ...env, HEBUN_MODEL_MAX_OUTPUT_TOKENS: "1025" }).maxOutputTokens, 0, "above the ceiling is still refused, never clamped");

  const long = ["## Neden bu öneri?", ...Array.from({ length: 40 }, (_, i) => `- Madde ${i + 1}: **kabul edilmiş** medya ve paket durumu.`)].join("\n");
  const run = async (stopReason: string) => {
    const seen: ClaudeTransportRequest[] = [];
    const transport: ClaudeTransport = {
      async send(request) {
        seen.push(request);
        return { id: "req_1", model: request.model, content: [{ type: "text", text: long }], stopReason, usage: { inputTokens: 10, outputTokens: 1024 } };
      },
    };
    const answered = await answerHebyModelRequest(
      { prompt: "Bu taslak için medya durumu nedir?", route: "/operations" },
      {
        resolveTenant: async () => TENANT,
        readOverview: () => undefined,
        env,
        resolveDirectorEnabled: async () => true,
        selectTransport: () => ({ transport, transportProvenance: "fake" }),
        generate: generateHebyModelAnswer,
        getConversationRepo: () => null,
        newCorrelationId: () => "corr",
        resolveContentMedia: async () => ({ sourceClass: "content-media", state: "unavailable", provenance: "p", authoritative: false, items: [], unavailableReason: "x" }),
      },
    );
    assert.equal(answered.status, "answered");
    if (answered.status !== "answered") throw new Error("unreachable");
    assert.equal(seen[0]!.maxTokens, 1024, "the request carries the ceiling");
    return answered.outcome.response;
  };
  const cut = await run("max_tokens");
  assert.equal(cut.origin, "model");
  assert.equal(cut.body.join("\n"), long, "every generated line reaches the answer; nothing is sliced");
  assert.ok(cut.limitations.includes(MODEL_OUTPUT_LIMIT_NOTE), "a cut answer says it was cut");
  assert.deepEqual(splitModelDiagnostics(cut.limitations).diagnostics, [MODEL_OUTPUT_LIMIT_NOTE], "…where it is read, not behind a disclosure");
  const whole = await run("end_turn");
  assert.ok(!whole.limitations.includes(MODEL_OUTPUT_LIMIT_NOTE), "a finished answer carries no cut note");
}

/* ── C · Markdown renders as elements, and nothing executes ─────────────── */
function markdown(): void {
  const html = renderToStaticMarkup(
    createElement(HebyMarkdown, {
      text: [
        "## Neden bu öneri?",
        "Revision 2'de **seçili** medya *kabul* edilmiş, `0e32a72d` hazır.",
        "- birinci madde",
        "- ikinci **kalın** madde",
        "1. adım bir",
        "2. adım iki",
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(2)>",
        "[güvenli](https://www.hebuntech.com/operations) [iç](/approvals) [kötü](javascript:alert(3)) [veri](data:text/html,x) [çift](//evil.example)",
      ].join("\n"),
    }),
  );
  assert.match(html, /<h3[^>]*>Neden bu öneri\?<\/h3>/, "## renders as a heading");
  assert.match(html, /<strong[^>]*>seçili<\/strong>/, "**x** renders as strong");
  assert.match(html, /<em>kabul<\/em>/);
  assert.match(html, /<code[^>]*>0e32a72d<\/code>/);
  assert.match(html, /<ul[^>]*><li>birinci madde<\/li><li>ikinci <strong[^>]*>kalın<\/strong> madde<\/li><\/ul>/, "- renders as a list");
  assert.match(html, /<ol[^>]*><li>adım bir<\/li><li>adım iki<\/li><\/ol>/);
  assert.doesNotMatch(html, /##|\*\*/, "no Markdown syntax survives as text");
  assert.doesNotMatch(html, /<script|<img|<[a-z]+[^>]*\son[a-z]+=/i, "raw HTML is never rendered as HTML (no tag, no handler attribute)");
  assert.match(html, /&lt;img src=x onerror=alert\(2\)&gt;/, "…the attempt is visible as escaped text");
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, "…it is shown as text");
  assert.match(html, /<a href="https:\/\/www.hebuntech.com\/operations"[^>]*rel="noopener noreferrer"[^>]*>güvenli<\/a>/);
  assert.match(html, /<a href="\/approvals"[^>]*>iç<\/a>/);
  assert.doesNotMatch(html, /href="(javascript|data):|href="\/\//i, "unsafe schemes never become links");
  assert.match(html, /\[kötü\]\(javascript:alert\(3\)\)/, "…they stay visible as text");
  for (const bad of ["javascript:alert(1)", "JAVASCRIPT:x", "data:x", "vbscript:x", "//evil", " /x y"]) assert.equal(isSafeHebyHref(bad), false, bad);

  /* The real bubble uses it; the operator's own text stays verbatim. */
  const bubble = renderToStaticMarkup(createElement(HebyBubble, { turn: { key: "k", role: "heby", content: "## Başlık\n- **a**", durable: true } }));
  assert.match(bubble, /data-heby-markdown/);
  assert.match(bubble, /<h3[^>]*>Başlık<\/h3>/);
  assert.match(bubble, /<li><strong[^>]*>a<\/strong><\/li>/);

  /* Nothing is dropped: an unrecognised construct is shown as the text it was. */
  const table = renderToStaticMarkup(createElement(HebyMarkdown, { text: "| a | b |\n|---|---|\n| 1 | 2 |" }));
  assert.match(table, /\| a \| b \|/);
  assert.match(table, /\| 1 \| 2 \|/);
}

async function main(): Promise<void> {
  capabilityTruth();
  await shaperTruth();
  await truncation();
  markdown();
  console.log("heby-truth-ux-repair-1/truth-truncation-markdown: OK");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
