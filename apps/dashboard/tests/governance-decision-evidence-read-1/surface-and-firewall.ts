/*
 * GOVERNANCE-DECISION-EVIDENCE-READ-1 — the boundaries the database test cannot see.
 *
 *   10. the released review-state readers and the /approvals page payload still carry no
 *       justification, actor id or evidence;
 *   11. the server action takes WHICH revision and nothing else; the tenant comes from the session
 *       and authority is asked inside the reader before any revision is read;
 *       the reader writes nothing and imports no writer;
 *       the UI shows the control only from the panel that holds the server's Governance answer, and
 *       the decision dialog is unchanged.
 *
 * Every pattern has its own negative control, so a check that can no longer fail is caught here.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const READER = "src/features/work-artifact-review/read-review-evidence.server.ts";
const STATES = "src/features/work-artifact-review/read-revision-review-states.server.ts";
const REVIEW = "src/features/work-artifact-review/review-revision.server.ts";
const DASHBOARD_READ = "src/features/approvals-dashboard/read-dashboard.server.ts";
const ACTIONS = "src/app/(dashboard)/approvals/actions.ts";
const DETAIL = "src/components/approvals-dashboard/content-detail.tsx";
const DASHBOARD = "src/components/approvals-dashboard/approvals-dashboard.tsx";
const EVIDENCE_UI = "src/components/approvals-dashboard/decision-evidence.tsx";
const CONTRACTS = "src/features/work-artifact-review/contracts.ts";

/* ── 10. THE RELEASED REVIEW-STATE DATA FIREWALL ─────────────────────────── */
const SENSITIVE = /\b(justification|actorId|authoritySourceActorId|evidence)\s*:\s*decisionRecords\./;
assert.ok(SENSITIVE.test("justification: decisionRecords.justification"), "negative control: the pattern bites");
for (const file of [STATES, DASHBOARD_READ]) {
  assert.ok(!SENSITIVE.test(code(file)), `${file} selects no justification, actor or evidence`);
}
const currentStates = code(REVIEW).slice(code(REVIEW).indexOf("export async function readCurrentRevisionReviewStates("));
assert.ok(currentStates.length > 0 && !SENSITIVE.test(currentStates), "readCurrentRevisionReviewStates selects no decision text");
const stateType = read(CONTRACTS).match(/export interface ArtifactRevisionReviewState \{([\s\S]*?)\n\}/)?.[1] ?? "";
const stateKeys = [...stateType.matchAll(/readonly (\w+)/g)].map((m) => m[1]).sort();
assert.deepEqual(stateKeys, ["decidedAt", "decision", "decisionCount", "decisionId", "revisionId", "revisionNo"], "the projected review state did not grow");
assert.ok(!/read-review-evidence/.test(code(DASHBOARD_READ)), "the page payload composition never calls the evidence reader");

/* ── 11. THE SERVER ACTION ───────────────────────────────────────────────── */
const actions = code(ACTIONS);
const action = actions.slice(actions.indexOf("export async function readReviewEvidenceAction("));
const actionBody = action.slice(0, action.indexOf("\n}\n") + 2);
assert.ok(actionBody.length > 0, "the action exists");
assert.match(
  actionBody,
  /input: \{ readonly artifactId: string; readonly revisionNo: number \}/,
  "the action's only parameter names the revision",
);
assert.ok(!/tenantId|actorId|userId|authority/i.test(actionBody.replace(/readRevisionReviewEvidence/, "")), "no tenant, actor or authority parameter");
assert.ok(/tenantId/.test("input: { tenantId: string }"), "negative control: the parameter pattern bites");
assert.match(
  actionBody,
  /return readRevisionReviewEvidence\(await resolveTenantContext\(\), \{\s*artifactId: input\?\.artifactId,\s*revisionNo: input\?\.revisionNo,\s*\}\);/,
  "the tenant is the session's and only the two target fields are forwarded",
);

/* Authority is asked inside the reader, before the first record query. */
const reader = code(READER);
const authorityAt = reader.indexOf("resolveGovernanceAuthority(tenant");
const refusedAt = reader.indexOf('if (!authority.authorized) return { status: "not-authorized" };');
const firstRecordAt = reader.indexOf(".from(workArtifactRevisions)");
assert.ok(authorityAt > 0 && refusedAt > authorityAt && firstRecordAt > refusedAt, "authority, then refusal, then the first record read");
assert.ok(reader.indexOf(".from(decisionRecords)") > firstRecordAt, "decision text is read only after the revision resolved");

/* The reader writes nothing and imports no writer. */
const WRITES = /\.(insert|update|delete)\(|\.transaction\(|recordGovernanceEventWithin|writeGovernanceDecisionWithin|review-revision\.server/;
assert.ok(WRITES.test("await tx.insert(decisionRecords)"), "negative control: the write pattern bites");
assert.ok(!WRITES.test(reader), "the evidence reader writes nothing and imports no writer");
assert.ok(read(READER).includes('throw new Error("Review evidence reads are server-only.")'), "server-only guard");

/* ── THE UI ──────────────────────────────────────────────────────────────── */
const detail = code(DETAIL);
assert.match(detail, /\{evidenceAuthorized && <DecisionEvidence artifactId=\{content\.artifact\.id\} revisionNo=\{content\.artifact\.currentRevision\} \/>\}/, "the control is gated");
assert.match(detail, /evidenceAuthorized = false/, "and hidden by default");
const dashboard = code(DASHBOARD);
assert.equal((dashboard.match(/evidenceAuthorized=/g) ?? []).length, 1, "exactly one place passes the Governance answer");
assert.match(dashboard, /<ContentDetails content=\{current\.content\} tab=\{tab\} evidenceAuthorized=\{data\.authorized\} \/>/, "the detail panel, from the server's answer");
assert.match(dashboard, /<ContentDetails content=\{item\.content\} tab="Details" \/>/, "the decision dialog is unchanged and shows no evidence control");
const ui = code(EVIDENCE_UI);
const uiImports = [...ui.matchAll(/^import (?!type)[\s\S]*?from "([^"]+)";/gm)].map((m) => m[1]).sort();
assert.deepEqual(uiImports, ["@/app/(dashboard)/approvals/actions", "react"], "the client view reaches the server only through the action");
assert.ok(!/useEffect/.test(ui), "nothing is read until the human asks");

console.log(
  "governance-decision-evidence-read-1/surface-and-firewall: review-state payload unchanged, action takes only the target, " +
    "authority before records, reader writes nothing, UI gated and dialog unchanged",
);
