/*
 * tests/youtube-recorded-measurement-1/authority-firewall.ts — YOUTUBE-RECORDED-MEASUREMENT-1: who
 * may reach what, read off the real source and the real import graph. No database, no network.
 *
 *   1. the client crosses with a permit id and nothing else;
 *   2. the observation side (composition + gated read) reaches no ledger, permit, decision,
 *      execution or publishing module — directly or transitively;
 *   3. the orchestration holds no SQL, no table, no transport and no credential;
 *   4. the composition reads once and has no timer, loop or retry;
 *   5. the stored facts are closed and minimal;
 *   6. the capability is a read on `google-youtube`, adds no consent entry point and is not a
 *      standing-observable scope; the subject and provenance vocabularies did not move;
 *   7. the existing read-back still stores nothing;
 *   8. the orchestration maps every outcome and hands over exactly the resolved identity.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { findProviderDefinition } from "../../src/features/provider-catalog/catalog";
import {
  GOOGLE_UPGRADEABLE_CAPABILITIES,
  GOOGLE_YOUTUBE_READONLY_SCOPE,
  GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY,
  extraScopesForCapability,
} from "../../src/features/provider-google/contracts";
import {
  OBSERVATION_PROVENANCE_MODES,
  OBSERVATION_SUBJECT_KINDS,
} from "../../src/features/provider-observation-history/contracts";
import {
  YOUTUBE_VIDEO_METRICS_FACT_KEYS,
  YOUTUBE_VIDEO_METRICS_ITEM_FACT_KEYS,
  recordYouTubeVideoObservation,
  youtubeVideoMetricsObservationFacts,
} from "../../src/features/provider-observation-history/record-youtube-video-observation.server";
import { OBSERVABLE_CAPABILITIES } from "../../src/features/standing-observation-authority/contracts";
import {
  recordYouTubePublicationMeasurement,
  type YouTubeMeasurementNotRecordedReason,
} from "../../src/features/youtube-recorded-measurement/record-youtube-publication-measurement.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = path.resolve(__dirname, "../..");
const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
/** Source with comments removed, so prose about a banned thing is not mistaken for reaching it. */
const codeOf = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const COMPOSITION = "src/features/provider-observation-history/record-youtube-video-observation.server.ts";
const READ_SEAM = "src/features/provider-google/read-youtube-video-metrics.server.ts";
const ORCHESTRATION = "src/features/youtube-recorded-measurement/record-youtube-publication-measurement.server.ts";
const IDENTITY = "src/features/action-authorization/content-publication-state.server.ts";
const ACTIONS = "src/app/(dashboard)/approvals/actions.ts";
const CONTROL = "src/components/decision-workspace/youtube-measurement-record.tsx";
const READ_BACK = "src/features/youtube-publishing/read-youtube-upload.server.ts";
const READ_BACK_CONTROL = "src/components/decision-workspace/youtube-upload-status.tsx";

/* ── import graph (runtime imports only; a type-only import carries no reference) ── */
function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith("@/") ? path.join("src", spec.slice(2)) : spec.startsWith(".") ? path.join(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const c = base + ext;
    if (existsSync(path.join(ROOT, c)) && statSync(path.join(ROOT, c)).isFile()) return c;
  }
  return null;
}
function reachable(root: string): Set<string> {
  const seen = new Set<string>();
  const stack = [root];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const m of codeOf(read(file)).matchAll(/(?:import|export)\s+(type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g)) {
      if (m[1]) continue;
      const next = resolveImport(m[2]!, file);
      if (next) stack.push(next);
    }
  }
  return seen;
}

const TENANT = { tenantId: "t", userId: "u" } as unknown as TenantContext;

async function main(): Promise<void> {
  /* ══ 1 · THE CLIENT CROSSES WITH A PERMIT ID AND NOTHING ELSE ══ */
  {
    const actions = read(ACTIONS);
    const at = actions.indexOf("export async function recordYouTubeMeasurementAction(");
    assert.ok(at > 0, "the action exists");
    const body = actions.slice(at, actions.indexOf("\n}\n", at));
    assert.match(body, /\(\s*input: \{ readonly permitId: string \},\s*\)/, "one parameter, one field");
    assert.match(body, /recordYouTubePublicationMeasurement\(await resolveTenantContext\(\), \{ permitId: String\(input\?\.permitId \?\? ""\) \}\)/);
    assert.equal((body.match(/input\??\.\w+/g) ?? []).every((m) => m.endsWith("permitId")), true, "no other input field is read");
    assert.equal(/recordProviderObservation|provider-observation-history/.test(codeOf(actions)), false, "the action never names the writer or its authority");

    const control = codeOf(read(CONTROL));
    assert.deepEqual(control.match(/recordYouTubeMeasurementAction\([^)]*\)/g), ["recordYouTubeMeasurementAction({ permitId })"], "the control sends only the permit id");
    assert.match(control, /\{ permitId \}: \{ readonly permitId: string \}/, "and receives nothing else");
    const copy = read(CONTROL);
    assert.ok(copy.includes("Reads YouTube again now and stores one measurement observation."), "the control says it reads and stores");
    assert.ok(copy.includes("“Read YouTube status” stores nothing."), "and that the read-only action still stores nothing");

    assert.match(codeOf(read(ORCHESTRATION)), /input: \{ readonly permitId: string \}/, "the orchestration accepts only the permit id");
  }

  /* ══ 2 · THE OBSERVATION SIDE REACHES NO LEDGER, PERMIT, DECISION, EXECUTION OR PUBLISHING ══ */
  {
    const FORBIDDEN_DIRS = [
      "src/features/action-authorization/",
      "src/features/action-execution/",
      "src/features/youtube-publishing/",
      "src/features/instagram-publishing/",
      "src/features/heby-action-inlet/",
      "src/features/governed-internal-action/",
      "src/features/governance-decision/decide",
      "src/features/youtube-recorded-measurement/",
    ];
    for (const root of [COMPOSITION, READ_SEAM]) {
      const graph = reachable(root);
      for (const file of graph) {
        for (const dir of FORBIDDEN_DIRS) {
          assert.equal(file.startsWith(dir), false, `${root} reaches ${file} — the observation side may not reach ${dir}`);
        }
      }
      const code = codeOf(read(root));
      for (const banned of [
        "actionPermits", "actionExecutionAttempts", "hebyActionRequests", "decisionRecords", "permitId",
        "@/features/action-authorization", "@/features/action-execution", "@/features/youtube-publishing",
        "@/features/governance", "@/features/heby-action-inlet", "resolveGovernanceAuthority",
        "@/features/knowledge", "@/features/organizational-work",
        "@/db/schema", ".insert(", ".update(", ".delete(", ".transaction(",
      ]) {
        assert.equal(code.includes(banned), false, `${root} must not contain \`${banned}\``);
      }
    }
    /* Walker proofs: it follows real edges, so the absences above are measured rather than vacuous. */
    assert.ok(reachable(COMPOSITION).has(READ_SEAM), "walker proof: the composition reaches the gated read");
    assert.ok(reachable(COMPOSITION).has("src/features/provider-observation-history/write-provider-observation.server.ts"));
    assert.ok(reachable(READ_SEAM).has("src/features/integration-authority/capability-availability.server.ts"), "the read asks the capability authority");
    assert.ok(reachable(ORCHESTRATION).has(IDENTITY), "walker proof: the orchestration is where the ledger is reached");

    /* The gate precedes the credential, and the connection is the exact one named. */
    const seam = codeOf(read(READ_SEAM));
    assert.ok(seam.indexOf("getCapabilityAvailability)(") < seam.indexOf("withGoogleAccessToken)("), "the capability authority is asked before any credential is spent");
    assert.match(seam, /s\.integrationId === input\.integrationId && s\.readAvailable && s\.providerKey === GOOGLE_YOUTUBE_PROVIDER_KEY/);
    assert.equal(seam.includes("fetch("), false, "the seam reuses the released transport and opens no request of its own");
  }

  /* ══ 3 · THE ORCHESTRATION HOLDS NO SQL, NO TABLE, NO TRANSPORT, NO CREDENTIAL ══ */
  {
    const code = codeOf(read(ORCHESTRATION));
    for (const banned of [
      "@/db/", "drizzle", ".select(", ".insert(", ".update(", ".delete(", "sql`", "fetch(",
      "withGoogleAccessToken", "credential-repository", "google-transport", "recordProviderObservation(",
      "actionPermits", "actionExecutionAttempts", "hebyActionRequests", "getCapabilityAvailability",
    ]) {
      assert.equal(code.includes(banned), false, `the orchestration must not contain \`${banned}\``);
    }
    assert.deepEqual(
      [...code.matchAll(/^import\s+(?!type)[^;]*from\s+"([^"]+)"/gm)].map((m) => m[1]).sort(),
      [
        "@/features/action-authorization/content-publication-state.server",
        "@/features/provider-observation-history/record-youtube-video-observation.server",
      ],
      "exactly the two authorities it sits between",
    );
  }

  /* ══ 4 · ONE READ, NO TIMER, NO LOOP, NO RETRY — AND NO DIRECT TABLE ══ */
  {
    const code = codeOf(read(COMPOSITION));
    assert.equal((code.match(/await observe\(/g) ?? []).length, 1, "exactly ONE provider read per call");
    assert.equal((code.match(/await write\(/g) ?? []).length, 1, "and at most one write");
    for (const banned of ["setInterval", "setTimeout", "cron", "while (", "for (", "retry", "providerObservations"]) {
      assert.equal(code.includes(banned), false, `the composition must not contain \`${banned}\``);
    }
    assert.ok(code.indexOf("channelId !== input.expectedChannelId") < code.indexOf("await write("), "the channel is verified before anything is written");
    /* The subject is YouTube's own answer. The expected channel is compared and never becomes the subject. */
    assert.deepEqual(code.match(/youtubeChannelSubjectRef\(([^)]*)\)/g), ["youtubeChannelSubjectRef(channelId)", "youtubeChannelSubjectRef(channelId)"]);
    assert.match(code, /const channelId = outcome\.channelId;/, "and `channelId` is the provider's");
    assert.equal((code.match(/expectedChannelId/g) ?? []).length, 2, "the expected channel appears in the input type and the comparison, nowhere else");
    assert.equal(/facts:[\s\S]*expectedChannelId/.test(code.slice(code.indexOf("await write("))), false, "the expected channel never reaches the record");
  }

  /* ══ 5 · THE STORED FACTS ARE CLOSED AND MINIMAL ══ */
  {
    const hostile = {
      videoId: "vid_1234", channelId: "UCx", publishedAt: null, viewCount: 0, likeCount: null, commentCount: 7,
      observedAt: "2026-10-01T10:00:00.000Z", permitId: "p", expectedChannelId: "UCx", title: "t", raw: { a: 1 },
    };
    const facts = youtubeVideoMetricsObservationFacts(hostile) as { channelId: string; videos: Record<string, unknown>[] };
    assert.deepEqual(Object.keys(facts), [...YOUTUBE_VIDEO_METRICS_FACT_KEYS]);
    assert.deepEqual([...YOUTUBE_VIDEO_METRICS_FACT_KEYS], ["channelId", "videos"]);
    assert.equal(facts.videos.length, 1);
    assert.deepEqual(Object.keys(facts.videos[0]!), [...YOUTUBE_VIDEO_METRICS_ITEM_FACT_KEYS]);
    assert.deepEqual([...YOUTUBE_VIDEO_METRICS_ITEM_FACT_KEYS], ["videoId", "publishedAt", "viewCount", "likeCount", "commentCount"]);
    assert.deepEqual(facts.videos[0], { videoId: "vid_1234", publishedAt: null, viewCount: 0, likeCount: null, commentCount: 7 }, "0 stays 0, null stays null, nothing else passes through");
    const mapper = codeOf(read(COMPOSITION));
    assert.equal(mapper.includes("..."), false, "no spread anywhere in the composition");
  }

  /* ══ 6 · THE CAPABILITY, AND THE VOCABULARIES THAT DID NOT MOVE ══ */
  {
    assert.equal(GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY, "google.youtube.video.metrics.read");
    const youtubeConnection = findProviderDefinition("google-youtube")!;
    assert.deepEqual([...youtubeConnection.capabilityScopes[GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY]!.read], [GOOGLE_YOUTUBE_READONLY_SCOPE]);
    assert.deepEqual([...youtubeConnection.capabilityScopes[GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY]!.write], [], "no write half");
    for (const other of ["google-workspace", "youtube"]) {
      assert.equal(Object.hasOwn(findProviderDefinition(other)!.capabilityScopes, GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY), false, `${other} does not carry it`);
    }
    /* NO OAUTH EXPANSION: it is not a capability an authorization request may name. */
    assert.equal(GOOGLE_UPGRADEABLE_CAPABILITIES.includes(GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY), false);
    assert.equal(extraScopesForCapability(GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY), null);
    /* NOT STANDING-OBSERVABLE: no machine may be authorized to repeat this read. */
    assert.equal(OBSERVABLE_CAPABILITIES.some((c) => c.capabilityKey === GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY || c.providerKey === "google-youtube"), false);
    assert.equal(OBSERVABLE_CAPABILITIES.length, 3, "the observable allow-list did not grow");
    assert.deepEqual([...OBSERVATION_SUBJECT_KINDS], ["youtube-channel", "instagram-account"], "no subject kind was minted");
    assert.deepEqual([...OBSERVATION_PROVENANCE_MODES], ["human", "standing-authorization"]);
    /* No schema or migration names this phase. */
    for (const f of readdirSync(path.join(ROOT, "src/db/schema"))) {
      assert.equal(/video\.metrics|recorded-measurement/.test(read(`src/db/schema/${f}`)), false, `${f} does not name this phase`);
    }
    assert.equal(readdirSync(path.join(ROOT, "src/db/migrations")).some((f) => /recorded_measurement|video_metrics/i.test(f)), false, "no migration");
  }

  /* ══ 7 · THE EXISTING READ-BACK STILL STORES NOTHING ══ */
  {
    const readBack = codeOf(read(READ_BACK));
    for (const banned of ["provider-observation-history", "recordProviderObservation", ".insert(", ".update("]) {
      assert.equal(readBack.includes(banned), false, `the read-back must not contain \`${banned}\``);
    }
    const control = read(READ_BACK_CONTROL);
    assert.ok(control.includes("nothing is stored."), "the read-only control still says nothing is stored");
    assert.equal(control.includes("recordYouTubeMeasurementAction"), false, "and does not record");
  }

  /* ══ 8 · THE IDENTITY READER'S PREDICATES, AND THE ORCHESTRATION'S MAPPING ══ */
  {
    const identity = codeOf(read(IDENTITY));
    const fn = identity.slice(identity.indexOf("export async function readYouTubePublicationIdentity("));
    assert.match(fn, /eq\(actionPermits\.tenantId, tenantId\)/, "tenant predicate on the permit");
    assert.match(fn, /eq\(hebyActionRequests\.tenantId, actionPermits\.tenantId\)/, "tenant predicate on the request join");
    assert.match(fn, /eq\(actionExecutionAttempts\.tenantId, actionPermits\.tenantId\)/, "tenant predicate on the attempt join");
    assert.match(fn, /eq\(hebyActionRequests\.actionKind, PUBLISH_YOUTUBE_VIDEO_ACTION_KIND\)/, "YouTube publications only");
    assert.match(fn, /row\.attemptStatus !== "accepted"/, "accepted attempts only");
    assert.deepEqual(
      [...fn.matchAll(/^\s{8}(\w+): /gm)].map((m) => m[1]),
      ["attemptStatus", "providerMessageId", "expectedChannelId", "integrationId"],
      "four columns are selected and nothing else leaves the ledger",
    );

    const handed: unknown[] = [];
    const run = (identity: unknown, outcome: unknown) =>
      recordYouTubePublicationMeasurement(TENANT, { permitId: "p" }, {
        resolveIdentity: (async () => identity) as never,
        observeAndRecord: (async (_t: unknown, input: unknown) => {
          handed.push(input);
          return outcome;
        }) as never,
      });
    const resolved = { status: "resolved", videoId: "vid_1234", expectedChannelId: "UCx", integrationId: "i" };
    const measurement = { videoId: "vid_1234", channelId: "UCx", publishedAt: null, viewCount: 0, likeCount: null, commentCount: 2, observedAt: "2026-10-01T10:00:00.000Z" };

    const cases: [unknown, unknown, YouTubeMeasurementNotRecordedReason][] = [
      [{ status: "unknown", reason: "read-failed" }, null, "ledger-unreadable"],
      [{ status: "unknown", reason: "persistence-not-configured" }, null, "ledger-unreadable"],
      [{ status: "unknown", reason: "no-authorized-tenant-context" }, null, "unauthenticated"],
      [{ status: "not-resolved", reason: "no-such-publication" }, null, "no-such-upload"],
      [{ status: "not-resolved", reason: "not-accepted" }, null, "not-accepted"],
      [{ status: "not-resolved", reason: "identity-incomplete" }, null, "identity-incomplete"],
      [resolved, { status: "refused", reason: "capability-not-available" }, "capability-not-available"],
      [resolved, { status: "refused", reason: "connection-not-available" }, "connection-not-available"],
      [resolved, { status: "provider-failed", failure: "transport", reason: "x" }, "youtube-unreadable"],
      [resolved, { status: "not-found-at-youtube" }, "not-found-at-youtube"],
      [resolved, { status: "channel-not-reported" }, "channel-not-reported"],
      [resolved, { status: "channel-mismatch" }, "channel-mismatch"],
      [resolved, { status: "observed", measurement, record: { status: "refused", reason: "persistence-unavailable" } }, "write-failed"],
      [resolved, { status: "observed", measurement, record: { status: "already-recorded" } }, "write-failed"],
    ];
    for (const [identityAnswer, outcome, reason] of cases) {
      handed.length = 0;
      assert.deepEqual(await run(identityAnswer, outcome), { status: "not-recorded", reason });
      assert.equal(handed.length, outcome === null ? 0 : 1, `${reason}: the provider side is reached only with a resolved identity`);
    }
    handed.length = 0;
    assert.deepEqual(await run(resolved, { status: "observed", measurement, record: { status: "recorded", observationId: "o" } }), {
      status: "recorded", observationId: "o", videoId: "vid_1234", publishedAt: null, viewCount: 0, likeCount: null, commentCount: 2,
      observedAt: "2026-10-01T10:00:00.000Z",
    });
    assert.deepEqual(handed, [{ videoId: "vid_1234", integrationId: "i", expectedChannelId: "UCx" }], "exactly the resolved identity crosses, and nothing about the permit");
    assert.deepEqual(
      await recordYouTubePublicationMeasurement(null, { permitId: "p" }, { resolveIdentity: (async () => { throw new Error("must not be reached"); }) as never }),
      { status: "not-recorded", reason: "unauthenticated" },
    );

    /* The composition, with both seams faked: nothing is written unless the channel matches. */
    let writes = 0;
    const compose = (observed: unknown) =>
      recordYouTubeVideoObservation(TENANT, { videoId: "vid_1234", integrationId: "i", expectedChannelId: "UCx" }, {
        observe: (async () => observed) as never,
        record: (async () => {
          writes += 1;
          return { status: "recorded", observationId: "o" };
        }) as never,
      });
    const readOk = { status: "read", integrationId: "i", videoId: "vid_1234", channelId: "UCx", publishedAt: null, viewCount: 0, likeCount: null, commentCount: 2, readAt: "2026-10-01T10:00:00.000Z" };
    for (const [observed, status] of [
      [{ status: "refused", reason: "capability-not-available" }, "refused"],
      [{ status: "provider-failed", failure: "auth", reason: "x" }, "provider-failed"],
      [{ status: "not-found" }, "not-found-at-youtube"],
      [{ ...readOk, channelId: null }, "channel-not-reported"],
      [{ ...readOk, channelId: "UCother" }, "channel-mismatch"],
    ] as const) {
      assert.equal((await compose(observed)).status, status);
    }
    assert.equal(writes, 0, "no refusal path reaches the writer");
    assert.equal((await compose(readOk)).status, "observed");
    assert.equal(writes, 1);
  }

  console.log("PASS youtube-recorded-measurement-1 authority firewall");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
