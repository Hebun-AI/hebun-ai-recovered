/*
 * HEBY-OBSERVED-PERFORMANCE-READ-1 — `/performance`: revision selection, truthful rendering, and the
 * boundary that keeps observations out of model context.
 *
 *   A. Revisions come from the revision authority, newest draft first, newest revision first;
 *      non-content artifacts are ignored; the measurement read's 50-revision bound is kept and named.
 *   B. Every measurement state renders its own sentence: recorded zero, not reported, no observation,
 *      outside the window, unreadable history, unknown ledger, unmeasurable YouTube; with provider,
 *      measurement type and instant; newest publication first; non-claims only where they apply.
 *   C. The command is a `read`: no model, no provider, available.
 *   D. The composition imports only released readers: no model, transport, provider, writer, EAI or
 *      grounding module — and nothing model-facing imports it. A bite-proof shows the check bites.
 *   E. EAI: `assistance` still allows no `provider-observation` cell.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import {
  readPerformance,
  renderPerformance,
  type PerformanceRead,
} from "../../src/features/heby-commands/performance-read.server";
import { runHebyReadCommand } from "../../src/features/heby-commands/read-commands.server";
import { findHebyCommandById } from "../../src/features/heby-commands";
import { CONTENT_PUBLICATION_REVISIONS_LIMIT } from "../../src/features/action-authorization/content-publication-state.server";
import {
  PUBLICATION_MEASUREMENT_NON_CLAIM,
  YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM,
  type MeasuredPublication,
  type PublicationMeasurement,
  type RevisionPublicationMeasurements,
  type YouTubePublicationMeasurement,
} from "../../src/features/content-publication-measurement/contracts";
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "../../src/features/external-ai-data-use/platform-disclosure-policy";

const TENANT = { tenantId: "t", userId: "u" } as unknown as TenantContext;
const A1 = "11111111-1111-4111-8111-111111111111";
const A2 = "22222222-2222-4222-8222-222222222222";
const NOTE = "33333333-3333-4333-8333-333333333333";
const ref = (id: string, n: number) => `work-artifact/${id}@${n}`;

type Artifact = { id: string; artifactType: string; title: string; currentRevision: number };
const listing = (...artifacts: Artifact[]) => (async () => ({ status: "read", artifacts })) as never;
const histories = (map: Record<string, number>) =>
  (async (_t: unknown, id: string) => Array.from({ length: map[id] ?? 0 }, (_, i) => ({ revisionNo: i + 1, current: i + 1 === map[id] }))) as never;

async function main(): Promise<void> {
  /* ── A. selection and bound ─────────────────────────────────────────────────────────────── */
  {
    let asked: { artifactId: string; revisionNo: number }[] = [];
    const read = await readPerformance(TENANT, {
      listArtifacts: listing(
        { id: A2, artifactType: "content-draft", title: "Newer", currentRevision: 1 },
        { id: NOTE, artifactType: "message-draft", title: "Memo", currentRevision: 4 },
        { id: A1, artifactType: "content-draft", title: "Older", currentRevision: 3 },
      ),
      readHistory: histories({ [A2]: 1, [A1]: 3, [NOTE]: 4 }),
      readMeasurements: (async (_t: unknown, revisions: { artifactId: string; revisionNo: number }[]) => {
        asked = revisions;
        return new Map();
      }) as never,
    });
    assert.equal(read.status, "read");
    assert.deepEqual(
      asked,
      [{ artifactId: A2, revisionNo: 1 }, { artifactId: A1, revisionNo: 3 }, { artifactId: A1, revisionNo: 2 }, { artifactId: A1, revisionNo: 1 }],
      "every revision of every content draft, newest draft first and newest revision first; the memo is ignored",
    );
    if (read.status === "read") {
      assert.equal(read.truncated, false);
      assert.deepEqual(read.checked.map((c) => c.current), [true, true, false, false], "current comes from the revision authority");
    }
  }
  {
    let asked = 0;
    const read = await readPerformance(TENANT, {
      listArtifacts: listing({ id: A1, artifactType: "content-draft", title: "Long", currentRevision: 60 }, { id: A2, artifactType: "content-draft", title: "Next", currentRevision: 1 }),
      readHistory: histories({ [A1]: 60, [A2]: 1 }),
      /* The ledger reads, and records no publication for any of them. */
      readMeasurements: (async (_t: unknown, r: { artifactId: string; revisionNo: number }[]) => (
        (asked = r.length),
        new Map(r.map((x) => [ref(x.artifactId, x.revisionNo), { status: "read", instagram: [], youtubeAcceptedCount: 0, youtube: [] }]))
      )) as never,
    });
    assert.equal(asked, CONTENT_PUBLICATION_REVISIONS_LIMIT, "the measurement read's bound is kept, never looped around");
    assert.ok(read.status === "read" && read.truncated && read.checked[0]!.revisionNo === 60 && read.checked.at(-1)!.revisionNo === 11);
    const text = renderPerformance(read as Extract<PerformanceRead, { status: "read" }>).lines.join("\n");
    assert.match(text, /No accepted Instagram or YouTube publication was found among the 50 content revision\(s\) Hebun could read and check\. This is not a statement about the rest\./);
    assert.ok(!/for this organization's content drafts/.test(text), "a truncated read makes no global absence claim");
    assert.match(text, /Only the newest 50 content revisions were checked .* may not list every publication\./, "a bounded answer says it is bounded");
  }
  {
    const read = await readPerformance(TENANT, {
      listArtifacts: listing({ id: A1, artifactType: "content-draft", title: "Lost", currentRevision: 2 }),
      readHistory: histories({}),
      readMeasurements: (async () => new Map()) as never,
    });
    const text = renderPerformance(read as Extract<PerformanceRead, { status: "read" }>).lines.join("\n");
    assert.match(text, /revision history could not be read for 1 content draft\(s\).*“Lost”/, "an unread history is named, not shown as no publication");
    assert.ok(!/for this organization's content drafts/.test(text), "an unread history makes no global absence claim");
    assert.match(text, /^Hebun could not read and check any content revision, so nothing is said about publications\./, "nothing inspected, nothing claimed");
  }
  {
    const r = await runHebyReadCommand({ commandId: "performance", args: [], route: "/heby" }, {
      resolveTenant: async () => TENANT,
      readPerformance: (async () => ({ status: "unavailable", reason: "drafts-unreadable" })) as never,
    });
    assert.ok(r.status === "ok" && r.result.tone === "unavailable" && /could not read this organization's content drafts/.test(r.result.lines[0]!));
    assert.deepEqual(await runHebyReadCommand({ commandId: "performance", args: [], route: "/heby" }, { resolveTenant: async () => null }), { status: "unauthorized" });
  }

  /* ── B. rendering ───────────────────────────────────────────────────────────────────────── */
  {
    const pub = (id: string, at: string): MeasuredPublication => ({ requestId: "r", attemptId: "a", providerResultId: id, destinationAccountId: "acct", publishedAt: at });
    const ig: PublicationMeasurement[] = [
      { status: "observed", publication: pub("IG-ZERO", "2026-10-03T00:00:00.000Z"), earliestObservedAt: "2026-10-03T06:00:00.000Z", latestObservedAt: "2026-10-09T06:00:00.000Z", latestLikeCount: 0, latestCommentCount: null, evolution: null },
      { status: "no-observation-since-publication", publication: pub("IG-NONE", "2026-10-08T00:00:00.000Z"), latestObservedAt: "2026-10-07T06:00:00.000Z" },
      { status: "absent-from-complete-window", publication: pub("IG-ABSENT", "2026-10-01T00:00:00.000Z"), latestObservedAt: "2026-10-09T06:00:00.000Z", windowMediaCount: 9 },
      { status: "outside-clipped-window", publication: pub("IG-CLIPPED", "2026-09-01T00:00:00.000Z"), latestObservedAt: "2026-10-09T06:00:00.000Z", windowMediaCount: 25 },
      { status: "history-unreadable", publication: pub("IG-UNREAD", "2026-08-01T00:00:00.000Z") },
    ];
    const yt: YouTubePublicationMeasurement[] = [
      { status: "measured", publication: pub("YT-1", "2026-10-02T00:00:00.000Z"), viewCount: 0, likeCount: null, commentCount: 3, providerPublishedAt: null, latestObservedAt: "2026-10-04T12:31:00.000Z", firstObservedAt: "2026-10-04T12:31:00.000Z", storedCount: 1, windowFull: false },
      { status: "no-stored-measurement", publication: pub("YT-2", "2026-09-20T00:00:00.000Z") },
    ];
    const rev = (n: number, current: boolean) => ({ ref: ref(A1, n), artifactId: A1, title: "Kilim", revisionNo: n, current });
    const measurements = new Map<string, RevisionPublicationMeasurements>([
      [ref(A1, 2), { status: "read", instagram: ig, youtubeAcceptedCount: 3, youtube: yt }],
      [ref(A1, 1), { status: "unknown" }],
    ]);
    const { lines, hasPublications } = renderPerformance({ status: "read", checked: [rev(2, true), rev(1, false)], truncated: false, historyUnreadable: [], measurements });
    const text = lines.join("\n");
    assert.ok(hasPublications);
    assert.match(text, /Instagram media IG-ZERO · “Kilim” revision 2 \(current\) · published 2026-10-03 00:00 UTC — likes 0 · comments not reported · as of 2026-10-09 06:00 UTC \(stored media observation; first listed 2026-10-03 06:00 UTC\)\./);
    assert.match(text, /IG-NONE[^\n]*no stored observation of this account since it was published; newest stored observation of the account 2026-10-07 06:00 UTC/);
    assert.match(text, /IG-ABSENT[^\n]*not listed in a later observation that reported the account's full recent window \(observation 2026-10-09 06:00 UTC\)/);
    assert.match(text, /IG-CLIPPED[^\n]*whose window was clipped/);
    assert.match(text, /IG-UNREAD[^\n]*observation history could not be read just now/);
    assert.match(text, /YouTube video measurement · “Kilim” revision 2 \(current\)[^\n]*views 0 · likes not reported · comments 3 · as of 2026-10-04 12:31 UTC/);
    assert.match(text, /YT-2 — no stored measurement/);
    assert.match(text, /name no video and channel Hebun can match[^\n]*revision 2 \(current\): 1/);
    assert.match(text, /publication record could not be read for 1 revision\(s\)[^\n]*revision 1 \(superseded\)/, "an unknown ledger is not 'no publication'");
    assert.ok(text.includes(PUBLICATION_MEASUREMENT_NON_CLAIM) && text.includes(YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM));
    const order = ["IG-NONE", "IG-ZERO", "YT-1", "IG-ABSENT", "YT-2", "IG-CLIPPED", "IG-UNREAD"].map((id) => text.indexOf(id));
    assert.deepEqual([...order].sort((a, b) => a - b), order, "newest publication first, across providers");
    assert.ok(!/No accepted/.test(text));
    for (const word of ["rate", "score", "rank", "trend", "performed", "recommend"]) {
      assert.ok(!new RegExp(`\\b${word}`, "i").test(lines.filter((l) => l !== PUBLICATION_MEASUREMENT_NON_CLAIM && l !== YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM).join("\n")), `no "${word}" outside the non-claims`);
    }

    /* Absence semantics: only a complete read may state a global absence. */
    const mixed = renderPerformance({
      status: "read",
      checked: [rev(2, true), rev(1, false)],
      truncated: false,
      historyUnreadable: [],
      measurements: new Map<string, RevisionPublicationMeasurements>([
        [ref(A1, 2), { status: "read", instagram: [], youtubeAcceptedCount: 0, youtube: [] }],
        [ref(A1, 1), { status: "unknown" }],
      ]),
    }).lines.join("\n");
    assert.ok(!/for this organization's content drafts/.test(mixed), "an unknown ledger makes no global absence claim");
    assert.match(mixed, /was found among the 1 content revision\(s\) Hebun could read and check/, "the absence is scoped to what was read");
    assert.match(mixed, /publication record could not be read for 1 revision\(s\)/, "and the unread part is still named");
    const partHistory = renderPerformance({
      status: "read",
      checked: [rev(1, true)],
      truncated: false,
      historyUnreadable: ["Lost"],
      measurements: new Map<string, RevisionPublicationMeasurements>([[ref(A1, 1), { status: "read", instagram: [], youtubeAcceptedCount: 0, youtube: [] }]]),
    }).lines.join("\n");
    assert.ok(!/for this organization's content drafts/.test(partHistory), "one unread history suppresses the global claim");
    assert.match(partHistory, /was found among the 1 content revision\(s\)[\s\S]*could not be read for 1 content draft\(s\)/);

    const none = renderPerformance({ status: "read", checked: [rev(1, true)], truncated: false, historyUnreadable: [], measurements: new Map([[ref(A1, 1), { status: "read", instagram: [], youtubeAcceptedCount: 0, youtube: [] }]]) });
    assert.deepEqual(none.lines, ["No accepted Instagram or YouTube publication is recorded for this organization's content drafts."], "nothing published, nothing claimed, no non-claim noise");
  }

  /* ── C. the registry ────────────────────────────────────────────────────────────────────── */
  {
    const c = findHebyCommandById("performance");
    assert.ok(c);
    assert.equal(c!.slash, "/performance");
    assert.equal(c!.kind, "read");
    assert.equal(c!.availability, "available");
    assert.equal(c!.requiresModel, false);
    assert.equal(c!.requiresExecution, false);
    assert.ok(!c!.reachesProvider, "a read reaches no provider");
    assert.equal(c!.safeWhenProviderOff, true);
  }

  /* ── D. the import firewall, and that it bites ──────────────────────────────────────────── */
  const ALLOWED = [
    "@/features/auth/tenant/tenant-context",
    "@/features/action-authorization/content-publication-state.server",
    "@/features/content-publication-measurement/contracts",
    "@/features/content-publication-measurement/read-publication-measurement.server",
    "@/features/work-artifacts/artifact-ref",
    "@/features/work-artifacts/contracts",
    "@/features/work-artifacts/read-work-artifacts.server",
  ];
  const importsOf = (src: string) => [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
  const violations = (src: string) => {
    const bad: string[] = importsOf(src).filter((m) => !ALLOWED.includes(m));
    if (/\.(insert|update|delete)\(|\bexecute\(|fetch\(|SourceResolution/.test(src.replace(/\/\*[\s\S]*?\*\//g, ""))) bad.push("write, fetch or grounding in code");
    return bad;
  };
  const SOURCE = readFileSync("src/features/heby-commands/performance-read.server.ts", "utf8");
  assert.deepEqual(violations(SOURCE), [], "the composition imports only released readers and does nothing else");
  for (const mutation of [
    `import { generateHebyModelAnswer } from "@/features/heby-model";`,
    `import { readProviderObservations } from "@/features/provider-observation-history/read-provider-observations.server";`,
    `const x = await fetch("https://graph.instagram.com");`,
    `await db.insert(t).values({});`,
  ]) {
    assert.ok(violations(`${SOURCE}\n${mutation}\n`).length > 0, `bite-proof: ${mutation.slice(0, 40)}… is caught`);
  }
  for (const modelFacing of [
    "src/features/heby-answer/model-answer.server.ts",
    "src/features/content-composition/heby-content-media-source.server.ts",
    "src/features/heby-model/heby-model-generation.server.ts",
    "src/features/heby-answer/model-facing-projection.ts",
  ]) {
    assert.ok(!readFileSync(modelFacing, "utf8").includes("performance-read"), `${modelFacing} does not import the performance read`);
  }
  const READS = readFileSync("src/features/heby-commands/read-commands.server.ts", "utf8");
  assert.ok(importsOf(READS).every((m) => !/heby-model|anthropic|transport|external-ai-data-use/.test(m)), "the read-command module still imports no model or EAI path");
  const HOOK = readFileSync("src/components/layout/heby/use-heby-conversation.ts", "utf8");
  assert.ok(/askHebyAction\(\{ prompt, route: contextRoute, conversationId: prior \}\)/.test(HOOK), "the only model crossing carries no command output");

  /* ── E. EAI policy unchanged ────────────────────────────────────────────────────────────── */
  const assistance = RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells.filter((c) => c.purpose === "assistance").map((c) => c.dataClass).sort();
  assert.deepEqual(assistance, ["conversation", "knowledge", "work-artifact"], "assistance allows no provider-observation");

  console.log("heby-observed-performance-read-1 render + firewall checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
