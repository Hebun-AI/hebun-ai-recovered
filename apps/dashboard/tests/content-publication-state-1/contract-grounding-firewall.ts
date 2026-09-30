/*
 * tests/content-publication-state-1/contract-grounding-firewall.ts — CONTENT-PUBLICATION-STATE-1.
 *
 *   1. the stage vocabulary is closed, total and composed from the owners' own words;
 *   2. Heby's content-media line carries the three answers and never collapses unknown into none;
 *   3. the projection and the shaper reach no decision, permit, execution, adapter, provider or
 *      arming writer (import graph walked, not asserted in prose);
 *   4. the /operations surface is read-only: one server action that reads, a panel with no control;
 *   5. the obsolete "Hebun has no publishing capability" claim is gone, and nothing overclaims.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  CONTENT_PUBLICATION_NON_CLAIM,
  PUBLICATION_ACTION_KINDS,
  PUBLICATION_DESTINATION,
  PUBLICATION_STAGES,
  PUBLICATION_STAGE_WORDING,
  derivePublicationStage,
  formatPublicationEntry,
  type ContentPublicationState,
  type PublicationHistoryEntry,
} from "../../src/features/action-authorization/content-publication-state";
import { readContentMediaGroundingSource, type ContentMediaSourceDeps } from "../../src/features/content-composition/heby-content-media-source.server";
import { CONTENT_PACKAGE_NON_CLAIMS } from "../../src/features/content-composition/contracts";
import { MEDIA_CHOICE_EXPLANATIONS } from "../../src/features/content-composition/media-choice";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { formatWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import { readContentPublicationState } from "../../src/features/action-authorization/content-publication-state.server";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as unknown as TenantContext;
const YT = "bd3ab228-61c2-4b42-a2a9-82bd23e8eae1";
const IG = "57b57106-2848-41f7-a5b3-d2475e0b7dba";
const NONE = "e6c38ea3-81f5-4a73-bfd6-d89295878dda";
const ref = (id: string, n: number) => `work-artifact/${id}@${n}`;

function entry(over: Partial<PublicationHistoryEntry>): PublicationHistoryEntry {
  return {
    requestId: "ba731823-0000-4000-8000-000000000000",
    actionKind: "publish-youtube-video",
    destination: "youtube",
    destinationAccountId: "UC5Yf5U_YOKR0K38tWF82kjA",
    acknowledgesPriorAttemptId: null,
    payloadDigest: "d".repeat(64),
    requestStatus: "approved",
    proposedAt: "2026-09-28T10:00:00.000Z",
    approvedAt: "2026-09-28T10:05:00.000Z",
    rejectedAt: null,
    permit: { state: "consumed", issuedAt: "2026-09-28T10:05:00.000Z", expiresAt: "2026-09-28T11:05:00.000Z", consumedAt: "2026-09-28T10:06:00.000Z", revokedAt: null },
    attempt: { attemptId: "dfeef4d4-0000-4000-8000-000000000000", status: "accepted", providerResponseClass: "accepted", providerResultId: "DQr18fVuevM", failureClass: null, startedAt: "2026-09-28T10:06:00.000Z", completedAt: "2026-09-28T10:07:00.000Z" },
    stage: "execution-accepted",
    ...over,
  };
}

function groundingDeps(states: Map<string, ContentPublicationState> | "throws"): ContentMediaSourceDeps {
  const artifacts = [
    { id: YT, artifactType: "content-draft", lifecycleStatus: "draft", currentRevision: 2, title: "YT draft", intendedDestination: "youtube" },
    { id: IG, artifactType: "content-draft", lifecycleStatus: "draft", currentRevision: 3, title: "IG draft", intendedDestination: "instagram" },
    { id: NONE, artifactType: "content-draft", lifecycleStatus: "draft", currentRevision: 2, title: "Other draft", intendedDestination: "youtube" },
  ];
  return {
    listArtifacts: (async () => ({ status: "read", artifacts })) as never,
    listImages: (async () => ({ status: "read", assets: [] })) as never,
    listVideos: (async () => ({ status: "read", videos: [] })) as never,
    listGenerations: (async () => ({ status: "read", generations: [] })) as never,
    readReviewStates: (async () => new Map()) as never,
    readPackage: (async (_t: unknown, i: { artifactId: string; revisionNo: number }) => ({
      status: "read",
      package: { artifactId: i.artifactId, revisionNo: i.revisionNo, selected: [], blockers: ["no-media-selected"], ready: false, mediaReviewStates: {} },
    })) as never,
    readProviderSwitch: async () => false,
    readCapabilityAvailability: (async () => ({ capabilities: [] })) as never,
    readPublicationStates: (async (tenant: unknown, revisions: readonly { artifactId: string; revisionNo: number }[]) => {
      assert.equal(tenant, TENANT, "the projection receives exactly the authenticated tenant");
      assert.deepEqual(revisions, [{ artifactId: YT, revisionNo: 2 }, { artifactId: IG, revisionNo: 3 }, { artifactId: NONE, revisionNo: 2 }], "current revisions only");
      if (states === "throws") throw new Error("ledger down");
      return states;
    }) as never,
  };
}

/* ── import graph ─────────────────────────────────────────────────────────── */
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
    const code = codeOf(read(file));
    for (const m of code.matchAll(/(?:import|export)\s+(type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g)) {
      if (m[1]) continue; /* type-only imports carry no runtime reference */
      const next = resolveImport(m[2]!, file);
      if (next) stack.push(next);
    }
  }
  return seen;
}

async function main(): Promise<void> {
  /* ══ 1 · vocabulary ══ */
  assert.deepEqual([...PUBLICATION_ACTION_KINDS], ["publish-instagram-media", "publish-youtube-video"]);
  assert.deepEqual({ ...PUBLICATION_DESTINATION }, { "publish-instagram-media": "instagram", "publish-youtube-video": "youtube" });
  const cases: [Parameters<typeof derivePublicationStage>[0], string][] = [
    [{ requestStatus: "pending", permit: null, attempt: null }, "request-pending"],
    [{ requestStatus: "rejected", permit: null, attempt: null }, "request-rejected"],
    [{ requestStatus: "withdrawn", permit: null, attempt: null }, "request-withdrawn"],
    [{ requestStatus: "approved", permit: null, attempt: null }, "request-approved-without-permit"],
    [{ requestStatus: "approved", permit: { state: "none" }, attempt: null }, "request-approved-without-permit"],
    [{ requestStatus: "approved", permit: { state: "active" }, attempt: null }, "permit-active"],
    [{ requestStatus: "approved", permit: { state: "expired" }, attempt: null }, "permit-expired"],
    [{ requestStatus: "approved", permit: { state: "revoked" }, attempt: null }, "permit-revoked"],
    [{ requestStatus: "approved", permit: { state: "consumed" }, attempt: null }, "permit-consumed-without-attempt"],
    ...(["pending", "accepted", "refused", "failed", "unknown"] as const).map(
      (s) => [{ requestStatus: "approved", permit: { state: "consumed" }, attempt: { status: s } }, `execution-${s}`] as [Parameters<typeof derivePublicationStage>[0], string],
    ),
  ];
  for (const [input, want] of cases) assert.equal(derivePublicationStage(input), want, JSON.stringify(input));
  assert.equal(new Set(cases.map((c) => c[1])).size, PUBLICATION_STAGES.length, "every stage is reachable");
  for (const s of PUBLICATION_STAGES) {
    assert.ok(PUBLICATION_STAGE_WORDING[s], s);
    assert.doesNotMatch(PUBLICATION_STAGE_WORDING[s], /\bpublished\b|\blive\b|\bsucceeded\b|\bposted\b/i, `${s}: ledger words, no outcome beyond the ledger`);
  }
  assert.match(CONTENT_PUBLICATION_NON_CLAIM, /not a live read of what the provider shows now/);
  assert.match(CONTENT_PUBLICATION_NON_CLAIM, /this revision only/);
  const line = formatPublicationEntry(entry({}));
  assert.match(line, /youtube request ba731823-.* · execution attempt accepted by the provider · attempt dfeef4d4-0000-4000-8000-000000000000 · provider id DQr18fVuevM/);

  /* ══ 1b · the projection's reference is exactly the one the proposals record ══ */
  for (const [id, n] of [[YT, 2], [YT.toUpperCase(), 7], [IG, 999_999_999]] as const) {
    const st = await readContentPublicationState(TENANT, { artifactId: id, revisionNo: n }, { getDb: () => null });
    assert.deepEqual(st, { status: "unknown", artifactRef: formatWorkArtifactRef(id, n), reason: "persistence-not-configured" }, `ref for ${id}@${n}`);
  }
  for (const bad of [{ artifactId: "x", revisionNo: 1 }, { artifactId: YT, revisionNo: 0 }, { artifactId: YT, revisionNo: 1.5 }]) {
    assert.deepEqual(await readContentPublicationState(TENANT, bad, { getDb: () => null }), { status: "unknown", artifactRef: null, reason: "invalid-reference" });
  }

  /* ══ 2 · Heby grounding: recorded / none / unknown, per draft, from the current revision ══ */
  const states = new Map<string, ContentPublicationState>([
    [ref(YT, 2), { status: "recorded", artifactRef: ref(YT, 2), truncated: false, entries: [entry({})] }],
    [ref(IG, 3), { status: "recorded", artifactRef: ref(IG, 3), truncated: true, entries: [
      entry({ requestId: "160d4361-0000-4000-8000-000000000000", actionKind: "publish-instagram-media", destination: "instagram", attempt: { attemptId: "5f5f5f5f-0000-4000-8000-000000000000", status: "accepted", providerResponseClass: "accepted", providerResultId: "18091512017663172", failureClass: null, startedAt: "x", completedAt: null } }),
      entry({ requestId: "22222222-0000-4000-8000-000000000000", actionKind: "publish-instagram-media", destination: "instagram", requestStatus: "pending", approvedAt: null, permit: null, attempt: null, stage: "request-pending" }),
    ] }],
    [ref(NONE, 2), { status: "no-request-recorded", artifactRef: ref(NONE, 2) }],
  ]);
  const r = await readContentMediaGroundingSource(TENANT, groundingDeps(states));
  const detail = (id: string) => r.items.find((i) => i.recordRef.startsWith(`work-artifact/${id}@`))!.detail;
  assert.match(detail(YT), /publication record of this revision \(action ledger\): 1 publish request recorded — youtube request .* execution attempt accepted by the provider · attempt dfeef4d4-[0-9a-f-]+ · provider id DQr18fVuevM/);
  assert.match(detail(YT), /not a live read of what the provider shows now/);
  assert.match(detail(IG), /2 most recent publish requests recorded — instagram request 160d4361.*provider id 18091512017663172; instagram request 22222222.*request awaiting a human decision/, "history in order, truncation said");
  assert.match(detail(NONE), /publication record of this revision \(action ledger\): no publish request is recorded for this revision/);
  for (const id of [YT, IG, NONE]) assert.doesNotMatch(detail(id), /not carried by this source/, "the seam exists now: no 'unknown here' merely for its absence");

  const missing = await readContentMediaGroundingSource(TENANT, groundingDeps(new Map([[ref(YT, 2), { status: "unknown", artifactRef: ref(YT, 2), reason: "read-failed" }]])));
  for (const item of missing.items.filter((i) => i.recordRef.startsWith("work-artifact/"))) {
    assert.match(item.detail, /publication record of this revision: could not be read — unknown here, which is not 'none'/, "unknown and absent-from-answer are both unknown");
    assert.doesNotMatch(item.detail, /no publish request/);
  }
  const thrown = await readContentMediaGroundingSource(TENANT, groundingDeps("throws"));
  assert.equal(thrown.state, "resolved", "a failing ledger does not take the media grounding down");
  for (const item of thrown.items.filter((i) => i.recordRef.startsWith("work-artifact/"))) {
    assert.match(item.detail, /could not be read — unknown here, which is not 'none'/);
  }
  assert.match(MEDIA_CHOICE_EXPLANATIONS["publish-path-governed"], /reads no proposal, approval, permit or arming/);
  assert.match(MEDIA_CHOICE_EXPLANATIONS["publish-path-governed"], /not shown is not 'not done'/);

  /* ══ 3 · firewall: the import graph from the projection and the shaper ══ */
  const FORBIDDEN_MODULES = [
    "src/features/action-authorization/decide-action-request.server.ts",
    "src/features/action-authorization/record-action-request.server.ts",
    "src/features/action-authorization/consume-action-permit.server.ts",
    "src/features/action-authorization/revoke-action-permit.server.ts",
    "src/features/action-authorization/declare-action-purpose.server.ts",
    "src/features/action-execution/execute-authorized-action.server.ts",
    "src/features/action-execution/adapter-registry.server.ts",
    "src/features/action-execution/execution-control.server.ts",
    "src/features/tenant-external-send-authority/authorize-tenant-external-send.server.ts",
    "src/features/provider-google/google-transport.server.ts",
    "src/features/youtube-publishing/resolve-youtube-publish.server.ts",
    "src/features/youtube-publishing/read-youtube-upload.server.ts",
    "src/features/heby-action-inlet/propose-commands.server.ts",
    "src/features/integration-credentials/credential-repository.server.ts",
  ];
  const WRITER_SYMBOLS = /export\s+(?:async\s+)?function\s+(approveActionRequest|rejectActionRequest|recordActionRequest|consumeActionPermit|revokeActionPermit|executeAuthorizedAction|authorizeTenantExternalSend)\b/;
  const projection = "src/features/action-authorization/content-publication-state.server.ts";
  const shaper = "src/features/content-composition/heby-content-media-source.server.ts";
  const shaperBaseline = reachable(shaper);
  for (const root of [projection, "src/features/action-authorization/content-publication-state.ts"]) {
    const graph = reachable(root);
    for (const f of FORBIDDEN_MODULES) assert.equal(graph.has(f), false, `${root} must not reach ${f}`);
    for (const f of graph) assert.doesNotMatch(codeOf(read(f)), WRITER_SYMBOLS, `${root} reaches ${f}, which defines a decision/permit/execution/arming writer`);
    if (root === projection) for (const f of graph) assert.equal(/provider-(instagram|google|youtube)\/.*transport|adapters\//.test(f), false, `no provider transport or adapter: ${f}`);
  }
  for (const f of FORBIDDEN_MODULES) assert.equal(shaperBaseline.has(f), false, `the content-media shaper must not reach ${f}`);
  for (const f of FORBIDDEN_MODULES) assert.ok(existsSync(path.join(ROOT, f)), `forbidden module path is real: ${f}`);
  const projGraph = reachable(projection);
  assert.ok(projGraph.has("src/features/action-authorization/read-action-authorizations.server.ts"), "walker proof: the R3A read seam is reached");
  assert.ok(shaperBaseline.has(projection), "walker proof: the shaper reaches the projection");
  const pc = codeOf(read(projection));
  for (const verb of [".insert(", ".update(", ".delete(", ".transaction(", "fetch("]) assert.equal(pc.includes(verb), false, `projection must not ${verb}`);
  assert.match(pc, /eq\(hebyActionRequests\.tenantId, tenantId\)/, "tenant predicate on the request");
  assert.match(pc, /eq\(actionPermits\.tenantId, hebyActionRequests\.tenantId\)/, "tenant predicate on the permit join");
  assert.match(pc, /eq\(actionExecutionAttempts\.tenantId, actionPermits\.tenantId\)/, "tenant predicate on the attempt join");
  const pure = codeOf(read("src/features/action-authorization/content-publication-state.ts"));
  assert.deepEqual([...pure.matchAll(/^import\s+(?!type)[^;]*from\s+"([^"]+)"/gm)].map((m) => m[1]).sort(),
    ["@/features/instagram-publishing/contracts", "@/features/youtube-publishing/contracts"], "the vocabulary imports only two pure constants");

  /* ══ 4 · /operations: read-only action, control-free panel ══ */
  const actions = read("src/app/(dashboard)/operations/actions.ts");
  const action = actions.slice(actions.indexOf("export async function readContentPublicationStatesAction"));
  const body = action.slice(0, action.indexOf("\n}\n"));
  assert.match(body, /const tenant = await resolveTenantContext\(\);/, "tenant from the session");
  assert.match(body, /readContentPublicationStates\(tenant, revisions\)/);
  assert.doesNotMatch(body, /tenantId|revalidatePath|insert|update/, "no browser tenant, no write, no revalidation");
  const panel = read("src/components/operations-preparation/content-package-panel.tsx");
  const record = codeOf(panel.slice(panel.indexOf("function PublicationRecord")));
  assert.doesNotMatch(record, /<button|onClick|Action\(|href=/, "the publication record offers no control");
  assert.match(record, /could not be read right now\. That is unknown, not “none”/);
  assert.match(record, /No publish request is recorded for this revision\./);
  assert.match(codeOf(panel), /<PublicationRecord publication=\{publication\} \/>/);

  /* ══ 5 · the non-claims: the false one is gone, the true ones stay narrow ══ */
  const joined = CONTENT_PACKAGE_NON_CLAIMS.join(" ");
  assert.doesNotMatch(joined, /no publishing capability|Nothing here sends anything to any platform|when it exists/i, "the obsolete claim is gone");
  assert.match(joined, /does not mean publication is authorized, that sending is armed, that anything was executed, or that a provider accepted anything/);
  assert.match(joined, /separate governed act: a human proposal, a Governance decision, a single-use permit, this organization's external-send arming, then one execution/);
  assert.match(joined, /Governed publishing exists only for Instagram images and YouTube videos/, "no claim that every destination can publish");
  for (const f of ["src/features/content-composition/contracts.ts", "src/components/operations-preparation/content-package-panel.tsx"]) {
    assert.doesNotMatch(read(f), /Hebun cannot post anything|there is no YouTube authority|Hebun has no publishing capability/, `${f}: no stale claim in code or comments`);
  }

  console.log("PASS content-publication-state-1 contract, grounding, firewall, surface, non-claims");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
