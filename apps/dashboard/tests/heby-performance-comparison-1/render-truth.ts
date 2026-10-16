/*
 * HEBY-PERFORMANCE-COMPARISON-1 — `/performance` made legible without being judged.
 *
 *   A. The title names the organization the Organization authority returned for the SESSION's tenant;
 *      an unreadable name keeps the result and says so. The tenant handed to that seam is the session's.
 *   B. Publications are grouped Instagram, then YouTube, newest first inside each group; never by a count.
 *   C. Elapsed times: publication → latest reading and that reading's age at the read. Zero is a span,
 *      a negative or future span is not printed as one, and no freshness label exists.
 *   D. Instagram change is printed only from `PublicationMeasurement.evolution` (IG-AN3's output):
 *      comparable values verbatim with their sign, a gap as IG-AN3's own note, no evolution as no change.
 *      A doctored `change` is printed as given — proof that nothing here recomputes it.
 *   E. Truth: 0 stays 0, null stays "not reported", superseded stays superseded, counts read at
 *      different instants are said to be, HOPR-1's absence and bound semantics are unchanged, and no
 *      judgement word appears outside the declared non-claims and limitations.
 */
import assert from "node:assert/strict";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import {
  PERFORMANCE_LIMITATIONS,
  elapsed,
  readPerformance,
  renderPerformance,
  type PerformanceRead,
} from "../../src/features/heby-commands/performance-read.server";
import { runHebyReadCommand } from "../../src/features/heby-commands/read-commands.server";
import {
  PUBLICATION_MEASUREMENT_NON_CLAIM,
  YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM,
  type MeasuredPublication,
  type PublicationMeasurement,
  type RevisionPublicationMeasurements,
  type YouTubePublicationMeasurement,
} from "../../src/features/content-publication-measurement/contracts";
import { INSTAGRAM_MEDIA_GAP_NOTES, type InstagramMediaEvolutionItem } from "../../src/features/instagram-connection-surface/media-measurement-evolution";

const TENANT = { tenantId: "tenant-session", userId: "u" } as unknown as TenantContext;
const A1 = "11111111-1111-4111-8111-111111111111";
const ref = (n: number) => `work-artifact/${A1}@${n}`;
const READ_AT = "2026-10-16T08:00:00.000Z";
const rev = (n: number, current: boolean) => ({ ref: ref(n), artifactId: A1, title: "Kilim", revisionNo: n, current });
const pub = (id: string, at: string): MeasuredPublication => ({ requestId: "r", attemptId: "a", providerResultId: id, destinationAccountId: "acct", publishedAt: at });
type Read = Extract<PerformanceRead, { status: "read" }>;
const base = (measurements: Map<string, RevisionPublicationMeasurements>, checked = [rev(2, true), rev(1, false)]): Read => ({
  status: "read",
  organization: { status: "read", name: "Turkish Rug House" },
  readAt: READ_AT,
  checked,
  truncated: false,
  historyUnreadable: [],
  measurements,
});
const item = (likes: InstagramMediaEvolutionItem["likeCount"], comments: InstagramMediaEvolutionItem["commentCount"]): InstagramMediaEvolutionItem => ({
  mediaId: "IG-A", mediaType: "IMAGE", caption: null, permalink: null, publishedAt: null, likeCount: likes, commentCount: comments,
});
const lineOf = (lines: readonly string[], id: string) => lines.find((l) => l.includes(` ${id} `)) ?? "";

async function main(): Promise<void> {
  /* ── A. organization ─────────────────────────────────────────────────────────────────────── */
  {
    let askedWith: unknown = null;
    const deps = {
      listArtifacts: (async () => ({ status: "read", artifacts: [] })) as never,
      readOrganization: (async (t: unknown) => ((askedWith = t), { status: "available", organization: { name: "Turkish Rug House" } })) as never,
      now: () => new Date(READ_AT),
    };
    const read = await readPerformance(TENANT, deps);
    assert.equal(askedWith, TENANT, "the Organization authority is asked about the session's tenant, and only that");
    assert.ok(read.status === "read" && read.readAt === READ_AT);
    assert.deepEqual(read.organization, { status: "read", name: "Turkish Rug House" });

    const r = await runHebyReadCommand({ commandId: "performance", args: [], route: "/heby" }, {
      resolveTenant: async () => TENANT,
      readPerformance: ((t: TenantContext) => readPerformance(t, deps)) as never,
    });
    assert.ok(r.status === "ok");
    if (r.status === "ok") {
      assert.equal(r.result.title, "Publication performance · Turkish Rug House", "the name is in the title");
      assert.deepEqual(r.result.lines, ["No accepted Instagram or YouTube publication is recorded for this organization's content drafts."], "HOPR-1's absence sentence is unchanged");
    }

    for (const failing of [
      (async () => ({ status: "unavailable", reason: "read-failed" })) as never,
      (async () => {
        throw new Error("boom");
      }) as never,
    ]) {
      const unnamed = await readPerformance(TENANT, { ...deps, readOrganization: failing });
      assert.ok(unnamed.status === "read" && unnamed.organization.status === "unavailable", "an unreadable name never fails the read");
      const out = renderPerformance(unnamed as Read).lines;
      assert.match(out[0]!, /could not read this organization's name\. The records below are those of this session's active organization\./);
      const rr = await runHebyReadCommand({ commandId: "performance", args: [], route: "/heby" }, {
        resolveTenant: async () => TENANT,
        readPerformance: ((t: TenantContext) => readPerformance(t, { ...deps, readOrganization: failing })) as never,
      });
      assert.ok(rr.status === "ok" && rr.result.title === "Publication performance", "no name is invented");
    }
    const draftsDown = await runHebyReadCommand({ commandId: "performance", args: [], route: "/heby" }, {
      resolveTenant: async () => TENANT,
      readPerformance: (async () => ({ status: "unavailable", reason: "drafts-unreadable", organization: { status: "read", name: "TRH" } })) as never,
    });
    assert.ok(draftsDown.status === "ok" && draftsDown.result.tone === "unavailable" && draftsDown.result.title === "Publication performance · TRH");
  }

  /* ── B–E. one read with every state ─────────────────────────────────────────────────────── */
  const ig: PublicationMeasurement[] = [
    {
      status: "observed", publication: pub("IG-A", "2026-10-11T20:16:00.000Z"),
      earliestObservedAt: "2026-10-12T06:00:00.000Z", latestObservedAt: "2026-10-16T07:00:00.000Z",
      latestLikeCount: 0, latestCommentCount: null,
      evolution: {
        previousObservedAt: "2026-10-15T06:00:00.000Z", latestObservedAt: "2026-10-16T07:00:00.000Z",
        /* A doctored change: 7 is not 0 − 1. If anything here recomputed, this would print −1. */
        item: item({ status: "comparable", previous: 1, latest: 0, change: 7 }, { status: "not-comparable", gap: "latest-not-reported", previous: 0, latest: null }),
      },
    },
    {
      status: "observed", publication: pub("IG-B", "2026-10-10T12:04:00.000Z"),
      earliestObservedAt: "2026-10-11T06:00:00.000Z", latestObservedAt: "2026-10-15T06:00:00.000Z",
      latestLikeCount: 2, latestCommentCount: 0,
      evolution: null,
    },
    {
      /* Equal instants are a span of zero; an observation before publication is not an elapsed time; a future one has no age. */
      status: "observed", publication: pub("IG-SKEW", "2026-10-17T00:00:00.000Z"),
      earliestObservedAt: "2026-10-16T09:00:00.000Z", latestObservedAt: "2026-10-16T09:00:00.000Z",
      latestLikeCount: 3, latestCommentCount: 0,
      evolution: { previousObservedAt: "2026-10-15T06:00:00.000Z", latestObservedAt: "2026-10-16T09:00:00.000Z", item: item({ status: "comparable", previous: 3, latest: 3, change: 0 }, { status: "comparable", previous: 0, latest: 0, change: 0 }) },
    },
    { status: "no-observation-since-publication", publication: pub("IG-NONE", "2026-10-09T00:00:00.000Z"), latestObservedAt: null },
  ];
  const yt: YouTubePublicationMeasurement[] = [
    { status: "measured", publication: pub("YT-1", "2026-09-28T15:38:00.000Z"), viewCount: 1, likeCount: 0, commentCount: null, providerPublishedAt: null, latestObservedAt: "2026-10-01T12:31:00.000Z", firstObservedAt: "2026-10-01T12:31:00.000Z", storedCount: 1, windowFull: false },
    { status: "measured", publication: pub("YT-2", "2026-09-28T20:40:00.000Z"), viewCount: 0, likeCount: 0, commentCount: 0, providerPublishedAt: null, latestObservedAt: "2026-10-01T12:31:00.000Z", firstObservedAt: "2026-10-01T12:31:00.000Z", storedCount: 1, windowFull: false },
    { status: "no-stored-measurement", publication: pub("YT-3", "2026-09-20T00:00:00.000Z") },
  ];
  const measurements = new Map<string, RevisionPublicationMeasurements>([
    [ref(2), { status: "read", instagram: [ig[0]!, ig[3]!, ig[2]!], youtubeAcceptedCount: 3, youtube: yt }],
    [ref(1), { status: "read", instagram: [ig[1]!], youtubeAcceptedCount: 0, youtube: [] }],
  ]);
  const { lines, hasPublications } = renderPerformance(base(measurements));
  assert.ok(hasPublications);

  /* B. groups, newest first inside each, never by count */
  const at = (needle: string) => lines.findIndex((l) => l === needle || l.includes(` ${needle} `));
  const order = ["Instagram", "IG-SKEW", "IG-A", "IG-B", "IG-NONE", "YouTube", "YT-2", "YT-1", "YT-3"].map(at);
  assert.ok(order.every((i) => i >= 0), "every heading and publication is listed");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "Instagram then YouTube; newest publication first inside each group");

  /* C. elapsed times */
  const a = lineOf(lines, "IG-A");
  assert.match(a, /4 d 10 h after publication · observation age 1 h 0 min\./, "publication → latest observation, and its age at the read");
  assert.equal(elapsed("2026-10-16T07:00:00.000Z", "2026-10-16T07:00:00.000Z"), "0 min", "zero is a span");
  assert.equal(elapsed("2026-10-16T07:00:00.000Z", "2026-10-16T07:59:59.000Z"), "59 min", "never rounded up");
  assert.equal(elapsed("2026-10-16T07:00:00.000Z", "2026-10-16T06:00:00.000Z"), null, "negative is not an elapsed time");
  assert.equal(elapsed("not a date", READ_AT), null, "unparseable is not an elapsed time");
  const skew = lineOf(lines, "IG-SKEW");
  assert.match(skew, /not after the recorded publication instant, so no elapsed time is shown/);
  assert.match(skew, /later than this read's clock, so no age is shown/);
  assert.ok(!/-\d+ (d|h|min)/.test(lines.join("\n")), "no negative span anywhere");
  assert.match(lineOf(lines, "YT-1"), /2 d 20 h after publication · measurement age 14 d 19 h\./, "YouTube: the recorded measurement's own instants");
  assert.ok(!/no stored measurement[^\n]*after publication/.test(lineOf(lines, "YT-3")), "no reading, no elapsed time");
  assert.ok(!/after publication/.test(lineOf(lines, "IG-NONE")), "no observation of the post, no elapsed time");
  for (const label of ["stale", "fresh", "recent", "outdated", "old"]) {
    assert.ok(!new RegExp(`\\b${label}\\b`, "i").test(lines.join("\n")), `no freshness label "${label}"`);
  }

  /* D. IG-AN3's output, printed and never recomputed */
  assert.match(a, /Between the two newest stored media observations \(2026-10-15 06:00 UTC → 2026-10-16 07:00 UTC\): likes 1 → 0 \(\+7\) · comments: /);
  assert.ok(a.includes(INSTAGRAM_MEDIA_GAP_NOTES["latest-not-reported"]), "a gap is IG-AN3's own note");
  assert.match(skew, /likes 3 → 3 \(0\) · comments 0 → 0 \(0\)/, "a zero change is a result");
  assert.match(lineOf(lines, "IG-B"), /No change is shown: Hebun's two newest stored media observations do not both list this post\./);
  assert.ok(!/Between/.test(lines.filter((l) => l.startsWith("YouTube")).join("\n")), "no change is shown for YouTube");

  /* E. truth */
  assert.match(a, /likes 0 · comments not reported · as of 2026-10-16 07:00 UTC/, "0 stays 0, null stays not reported");
  assert.match(lineOf(lines, "IG-B"), /revision 1 \(superseded\)/, "superseded stays superseded");
  assert.match(a, /revision 2 \(current\)/);
  assert.match(lineOf(lines, "YT-1"), /comments not reported/);
  assert.ok(lines.includes("These Instagram counts were read at 3 different instants; each describes its own moment."), "different instants are said to be different");
  assert.ok(!lines.some((l) => /These YouTube counts/.test(l)), "one shared instant needs no such sentence");
  assert.ok(lines.includes(PUBLICATION_MEASUREMENT_NON_CLAIM) && lines.includes(YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM));
  for (const l of PERFORMANCE_LIMITATIONS) assert.ok(lines.includes(l), "every limitation is printed");
  assert.ok(!lines.some((l) => /\.\.(\s|$)/.test(l)), "no doubled full stop after an IG-AN3 note (found in local runtime acceptance)");
  const judged = lines.filter((l) => l !== PUBLICATION_MEASUREMENT_NON_CLAIM && l !== YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM && !(PERFORMANCE_LIMITATIONS as readonly string[]).includes(l)).join("\n");
  for (const word of ["rate", "score", "rank", "trend", "performed", "recommend", "best", "better", "worse", "success", "engagement"]) {
    assert.ok(!new RegExp(`\\b${word}`, "i").test(judged), `no "${word}" outside the declared non-claims and limitations`);
  }

  /* HOPR-1 absence and bound semantics, unchanged */
  const truncated = renderPerformance({ ...base(new Map([[ref(2), { status: "read", instagram: [], youtubeAcceptedCount: 0, youtube: [] }]]), [rev(2, true)]), truncated: true }).lines.join("\n");
  assert.ok(!/for this organization's content drafts/.test(truncated) && /Only the newest 1 content revisions were checked/.test(truncated), "a bounded read makes no global absence claim");
  assert.ok(!PERFORMANCE_LIMITATIONS.some((l) => truncated.includes(l)), "no publication, no limitations noise");
  const unknown = renderPerformance(base(new Map([[ref(2), { status: "unknown" }]]), [rev(2, true)])).lines.join("\n");
  assert.ok(/Hebun could not read and check any content revision/.test(unknown) && /publication record could not be read for 1 revision/.test(unknown));
  const partial = renderPerformance({ ...base(measurements), truncated: true }).lines.join("\n");
  assert.ok(/IG-A/.test(partial) && /may not list every publication/.test(partial), "a bounded read with publications still says it is bounded");

  console.log("heby-performance-comparison-1 render + truth checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
