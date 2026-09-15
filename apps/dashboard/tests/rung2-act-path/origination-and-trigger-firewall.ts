/*
 * RUNG 2 ACT PATH — the two new boundaries, proved without a database.
 *
 * WHAT THIS FILE PROVES:
 *
 *   "An agent may name an observation ONLY from the list this request offered it, as a positional
 *    slug, never as an id. The prompt it is shown carries no uuid and no canonical reference, and
 *    denies the observation half explicitly when there is nothing to offer. The narrow issuance
 *    trigger takes no scope, mints nothing, executes nothing and re-decides nothing. No browser,
 *    shell, device or provider mutation authority was added anywhere on the path."
 *
 * The persistence proofs — the whole chain, the quota, the cadence, evidence reuse, withdrawal and
 * cross-tenant isolation — live in `chain-postgres.ts` against a real PostgreSQL. The issuer's own
 * boundaries and the amended namer list live in `rung2-standing-mutation/authority-and-firewall.ts`.
 * This file proves what neither of those owns.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";

/* The schema barrel initialises lazily; the released suites load the client first for this reason. */
import "../../src/db/client.server";

import { parseAgentActionSelection } from "../../src/features/agent-origination/structured-output";
import { recordWorkIsProposable } from "../../src/features/agent-origination/candidate-set.server";
import { ADMITTED_EVIDENCE_SOURCE_CLASSES } from "../../src/features/standing-mutation-authority/contracts";
import { STANDING_ISSUABLE_REQUEST_SCAN_LIMIT } from "../../src/features/action-authorization/read-standing-issuable-requests.server";
import type { OriginationCandidateSet } from "../../src/features/agent-origination/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const codeOf = (s: string): string =>
  withoutComments(s)
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, "``")
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, '""')
    .replace(/'(?:[^'\\]|\\[\s\S])*'/g, "''");

const TRIGGER = "src/features/standing-issuance-trigger/scan-issuable-requests.server.ts";
const TRIGGER_CONTRACTS = "src/features/standing-issuance-trigger/contracts.ts";
const DISCOVERY = "src/features/action-authorization/read-standing-issuable-requests.server.ts";
const INGRESS = "src/app/api/standing-issuance/scan/route.ts";
const DELIVERY_INGRESS = "src/app/api/machine-delivery/scan/route.ts";
const CANDIDATES = "src/features/agent-origination/candidate-set.server.ts";
const ORIGINATION = "src/features/agent-origination/originate-action.server.ts";

const candidates = (observations: { slug: string; label: string; observationRef: string }[]): OriginationCandidateSet => ({
  recipients: [],
  drafts: [],
  work: { organizationLevel: true, departments: [], observations },
});

const OFFERED = [
  { slug: "observation-1", label: "youtube observed 2026-09-15T12:00:00.000Z", observationRef: "provider-observation/11111111-1111-4111-8111-111111111111" },
];

const envelope = (scope: unknown): string =>
  JSON.stringify({ kind: "record-work", args: { title: "Recorded the observation", scope }, reason: "because it happened" });

/* ────────────────────────────────────────────────────────────────────────────
 * 1 · THE AGENT NAMES A SLUG FROM THE OFFERED LIST, OR IT NAMES NOTHING
 * ──────────────────────────────────────────────────────────────────────────── */

const accepted = parseAgentActionSelection(envelope({ kind: "observation", observationSlug: "observation-1" }), candidates(OFFERED));
assert.equal(accepted.status, "selected", JSON.stringify(accepted));
assert.deepEqual(
  accepted.status === "selected" ? accepted.selection : null,
  {
    kind: "record-work",
    title: "Recorded the observation",
    scope: { kind: "observation", observationSlug: "observation-1" },
    reason: "because it happened",
  },
  "an offered slug is admitted, and the slug is what travels — never a reference",
);

/*
 * THE CONTAINMENT. A slug that was not offered is refused, and this matters more here than anywhere
 * else on the boundary: an observation reference is the idempotence anchor of the whole standing
 * act path, so a model that could name an unoffered one could re-spend a fact or reach a row it was
 * never shown.
 */
for (const [slug, why] of [
  ["observation-2", "a slug one past the end of the offered list"],
  ["observation-1 ", "a trailing space — not normalized, not trimmed"],
  ["OBSERVATION-1", "a case variant — membership is exact"],
  ["provider-observation/11111111-1111-4111-8111-111111111111", "the reference itself"],
] as const) {
  const refused = parseAgentActionSelection(envelope({ kind: "observation", observationSlug: slug }), candidates(OFFERED));
  assert.equal(refused.status, "refused", `${why} must be refused`);
  assert.equal(
    refused.status === "refused" ? refused.reason : "",
    "reference-not-offered",
    `${why} must be refused as NOT OFFERED, never repaired`,
  );
}

/* Shape before membership — the same order and the same two refusals the other arms use. */
for (const [scope, reason, why] of [
  [{ kind: "observation", observationSlug: "" }, "malformed-reference", "an empty slug"],
  [{ kind: "observation", observationSlug: 7 }, "malformed-reference", "a non-string slug"],
  [{ kind: "observation" }, "invalid-arguments", "a missing slug"],
  [{ kind: "observation", observationSlug: "observation-1", departmentSlug: "finance" }, "invalid-arguments", "an extra key"],
] as const) {
  const refused = parseAgentActionSelection(envelope(scope), candidates(OFFERED));
  assert.equal(refused.status, "refused", `${why} must be refused`);
  assert.equal(refused.status === "refused" ? refused.reason : "", reason, why);
}

/* An offered-nothing list admits nothing, rather than admitting the first thing. */
const noneOffered = parseAgentActionSelection(envelope({ kind: "observation", observationSlug: "observation-1" }), candidates([]));
assert.equal(
  noneOffered.status === "refused" ? noneOffered.reason : "",
  "reference-not-offered",
  "with no observations offered, no observation may be named",
);

/* The other two scopes are untouched by this phase. */
assert.equal(
  parseAgentActionSelection(envelope({ kind: "organization-level" }), candidates([])).status,
  "selected",
  "organization-level work is unchanged",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 2 · A STORED OBSERVATION IS AN INDEPENDENT REASON RECORD-WORK IS PROPOSABLE
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * An organization Hebun could not read this instant may still own observations it demonstrably
 * made. Observation-evidenced work names no department and declares no organizational scope, so
 * making it depend on the structural read would let an organization outage silently disable the
 * only evidence class the standing issuer admits.
 */
assert.equal(
  recordWorkIsProposable({
    recipients: [],
    drafts: [],
    work: { organizationLevel: false, departments: [], observations: OFFERED },
  }),
  true,
  "an unreadable organization does not silence the observation half",
);
assert.equal(
  recordWorkIsProposable({ recipients: [], drafts: [], work: { organizationLevel: false, departments: [], observations: [] } }),
  false,
  "and with nothing at all, record-work is still not proposable",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 3 · THE PROMPT CARRIES NO ID, AND DENIES THE HALF EXPLICITLY WHEN EMPTY
 * ──────────────────────────────────────────────────────────────────────────── */

const originationSource = read(ORIGINATION);

/*
 * The rendered candidate line is `observationSlug=<slug> <label>`. Neither field may carry a uuid or
 * a canonical reference: `observationRef` is server-side only and the released firewall walks the
 * rendered lines for exactly these shapes.
 */
assert.ok(
  /observationSlug=\$\{o\.slug\} \$\{o\.label\}/.test(originationSource),
  "the rendered observation line must carry the slug and the label, and nothing else",
);
assert.equal(
  /\$\{o\.observationRef\}/.test(originationSource),
  false,
  "the canonical reference must never reach a prompt line",
);

/* AN ABSENT SECTION READS AS AN OVERSIGHT; AN EXPLICIT DENIAL IS A FACT THE MODEL CAN ACT ON. */
assert.ok(
  /CANDIDATE OBSERVATIONS: none\./.test(originationSource),
  "an empty observation half must be denied in words, not omitted",
);
assert.ok(
  /you may not propose observation-scoped work right now/.test(originationSource),
  "and the denial must say what the model may not do",
);

/*
 * THE DENIAL IS RENDERED OUTSIDE THE ORGANIZATIONAL BRANCH. If it sat inside the `else`, an
 * organization that read fine would never be told the observation half was empty, and one that did
 * not read would be told nothing about observations at all.
 */
const orgBranch = originationSource.slice(
  originationSource.indexOf("if (candidates.work.organizationLevel) {"),
  originationSource.indexOf("CANDIDATE OBSERVATIONS"),
);
assert.ok(
  orgBranch.includes("} else {") && orgBranch.trimEnd().endsWith("}") === false,
  "the organizational branch must be closed before the observation half is rendered",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 4 · THE TRIGGER TAKES NO SCOPE AND DECIDES NOTHING
 * ──────────────────────────────────────────────────────────────────────────── */

const triggerSource = read(TRIGGER);
const triggerCode = codeOf(triggerSource);
const discoveryCode = codeOf(read(DISCOVERY));

/* NO SCOPE. There is no parameter through which a caller could aim this at anything. */
for (const forbidden of ["tenantId", "agentId", "requestId?", "actionKind", "maxActs", "minIntervalMinutes", "authorizationId", "permitId"]) {
  assert.equal(
    new RegExp(`readonly\\s+${forbidden.replace("?", "")}\\s*[?:]`).test(
      triggerSource.slice(triggerSource.indexOf("export interface ScanIssuableRequestsDeps"), triggerSource.indexOf("function assertServerOnly")),
    ),
    false,
    `the issuance trigger must have no ${forbidden} parameter`,
  );
}
assert.ok(
  /export async function scanIssuableRequests\(\s*deps: ScanIssuableRequestsDeps = \{\},\s*\)/.test(triggerSource),
  "the scan takes injection points and nothing else",
);

/*
 * ONLY A REQUEST ID CROSSES TO THE ISSUER. The tenant is in scope on the candidate right there and
 * must not travel: the issuer re-derives it from the request row, which is what makes a compromised
 * or buggy trigger unable to substitute one.
 */
assert.ok(
  /issue\(\{ requestId \}, issuerDeps \?\? \{\}\)/.test(triggerSource),
  "the issuer is called with a request id alone",
);
assert.equal(
  /issue\(\{[^}]*tenantId/.test(triggerSource),
  false,
  "the tenant the scan just read must never be forwarded as authority",
);

/* A THROW IS NOT A REFUSAL, and an unreadable register is not an empty one. */
assert.ok(triggerSource.includes('status: "failed"'), "a throw is reported as failed, never as refused");
/* Judged on CODE: the comment between the branch and its return is long, and a guard that fired on
 * its own explanation would be punishing the documentation that makes the boundary legible. */
assert.ok(
  /if \(register\.status !== ""\)[\s\S]{0,120}status: ""/.test(triggerCode),
  "an unreadable candidate register fails closed",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 5 · THE DISCOVERY IS A COURTESY FILTER, NOT A SECOND AUTHORITY
 * ──────────────────────────────────────────────────────────────────────────── */

/* It never writes, never locks, never claims. */
for (const banned of ["insert", "update", "delete", "transaction", "for(", "forUpdate"]) {
  assert.equal(
    discoveryCode.includes(`db.${banned}`) || discoveryCode.includes(`.${banned}(`) && banned === "forUpdate",
    false,
    `the discovery must not ${banned}`,
  );
}

/*
 * AND IT DELIBERATELY DOES NOT EVALUATE THE ENVELOPE'S BOUNDS. Every one of these is the issuer's
 * to decide behind its own row lock; a second evaluation here would be a second quota, a second
 * clock and a second cadence that could disagree with the authoritative ones. TRH-25 paid for that
 * lesson: `where not exists` is not a mutex.
 */
for (const bound of ["maxActs", "minIntervalMinutes", "notBefore", "notAfter", "authorizationRevision", "state"]) {
  assert.equal(
    discoveryCode.includes(`standingMutationAuthorizations.${bound}`),
    false,
    `the discovery must not evaluate ${bound} — the issuer owns it, under a lock`,
  );
}

/* THE ACTION SET IS CONSULTED, NEVER RESTATED. */
assert.ok(discoveryCode.includes("MACHINE_EXECUTABLE_ACTION_KINDS"));
assert.equal(
  /["']record-work["']/.test(discoveryCode),
  false,
  "the discovery must not spell an action kind",
);

/* BOUNDED, AND CLAMPED DOWNWARD ONLY — a parameter that can only narrow is not an authority. */
assert.equal(STANDING_ISSUABLE_REQUEST_SCAN_LIMIT, 25);
assert.ok(
  /Math\.min\(\s*deps\.limit \?\? STANDING_ISSUABLE_REQUEST_SCAN_LIMIT,\s*STANDING_ISSUABLE_REQUEST_SCAN_LIMIT,?\s*\)/.test(
    read(DISCOVERY),
  ),
  "no caller may raise the scan ceiling",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 6 · THE INGRESS: ITS OWN SECRET, FAILING CLOSED, NAMING NO SCOPE
 * ──────────────────────────────────────────────────────────────────────────── */

const ingressSource = read(INGRESS);

/*
 * ITS OWN SECRET, NOT THE DELIVERY ONE AND NOT THE OBSERVATION ONE. Ingresses that share a secret
 * are one credential with several doors: rotating for one silently re-authorizes the others.
 */
assert.ok(ingressSource.includes("HEBUN_STANDING_ISSUANCE_TRIGGER_SECRET"));
for (const otherSecret of ["HEBUN_MACHINE_DELIVERY_TRIGGER_SECRET", "HEBUN_OBSERVATION_TRIGGER_SECRET"]) {
  assert.equal(ingressSource.includes(otherSecret), false, `the ingress must not read ${otherSecret}`);
}
assert.notEqual(
  /const TRIGGER_SECRET_ENV = "([^"]+)"/.exec(ingressSource)?.[1],
  /const TRIGGER_SECRET_ENV = "([^"]+)"/.exec(read(DELIVERY_INGRESS))?.[1],
  "the two machine ingresses must not share an env name",
);

/* AN UNSET SECRET REFUSES EVERY REQUEST — an unconfigured deployment is closed, never open. */
assert.ok(/if \(!expected\) return false;/.test(ingressSource));
/* Constant time, with the length compared first because `timingSafeEqual` throws on a mismatch. */
assert.ok(ingressSource.includes("timingSafeEqual"));
assert.ok(/if \(given\.length !== want\.length\) return false;/.test(ingressSource));
/* No query-string or body fallback: a secret that may travel in a URL will be found in a log. */
assert.equal(/searchParams|request\.json\(\)|await request\.text\(\)/.test(ingressSource), false);

/* THE ROUTE DOES NOT NAME THE ISSUER — the indirection is the property, not decoration. */
assert.equal(
  ingressSource.includes("issue-permit-under-standing-authorization"),
  false,
  "the ingress must reach the issuer only through the scan module",
);

/* THE BODY CARRIES COUNTS AND REFUSAL WORDS, NEVER SCOPE. */
const body = ingressSource.slice(ingressSource.indexOf("return Response.json({"));
for (const leaked of ["tenantId", "requestId", "permitId", "agentId"]) {
  assert.equal(
    new RegExp(`\\b${leaked}\\b`).test(body),
    false,
    `the scan report must not echo ${leaked} — it would be an enumeration surface`,
  );
}
/*
 * AND THE PER-CANDIDATE LIST ITSELF IS NOT A FIELD. `result.outcomes` is READ here to compute the
 * failure count — that is the scan's own data being summarized, not echoed. What must not exist is
 * an `outcomes:` key on the response, which would carry every candidate's identity outward.
 */
assert.equal(
  /^\s*outcomes:/m.test(body),
  false,
  "the response must summarize outcomes, never enumerate them",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 7 · NOTHING ON THE PATH GAINED A NEW MUTATION AUTHORITY
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * The whole act path is proposal → authorization. No browser, no shell, no device, no filesystem and
 * no provider WRITE may appear anywhere on it — and the evidence class stayed exactly one member
 * wide, because widening it to make something pass is the one shortcut that would quietly undo the
 * one-fact-one-act rule the issuer rests on.
 */
assert.deepEqual([...ADMITTED_EVIDENCE_SOURCE_CLASSES], ["provider-observations"]);

for (const file of [TRIGGER, TRIGGER_CONTRACTS, DISCOVERY, INGRESS, CANDIDATES]) {
  const source = codeOf(read(file));
  for (const banned of [
    "child_process",
    "node:child_process",
    "puppeteer",
    "playwright",
    "node:fs",
    "writeFile",
    "fetch(",
    "XMLHttpRequest",
    "navigator",
  ]) {
    assert.equal(
      source.includes(banned),
      false,
      `${file} must not reach ${banned} — this path proposes and authorizes, it does not act`,
    );
  }
}

/* The candidate builder READS observations; it must never write one. */
const candidateCode = codeOf(read(CANDIDATES));
for (const banned of ["writeProviderObservation", "observeAuthorizedSubject", "db.insert", "db.transaction"]) {
  assert.equal(candidateCode.includes(banned), false, `the candidate builder must not ${banned}`);
}

/* ────────────────────────────────────────────────────────────────────────────
 * 8 · RUNG 1 AND RUNG 1.5 SEMANTICS ARE UNTOUCHED
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * The delivery ingress, its scan and its register are byte-relevant neighbours of everything this
 * phase added. None of them may have learned about standing issuance: a permit issued under an
 * envelope is an ORDINARY permit, and the delivery path must not be able to tell the difference.
 */
for (const file of [
  DELIVERY_INGRESS,
  "src/features/machine-delivery-trigger/scan-deliverable-permits.server.ts",
  "src/features/action-authorization/read-machine-deliverable-permits.server.ts",
  "src/features/governed-machine-execution/execute-record-work-as-machine.server.ts",
]) {
  const source = read(file);
  for (const banned of [
    "standing-issuance-trigger",
    "issue-permit-under-standing-authorization",
    "scanIssuableRequests",
    "standingAuthorizationId",
  ]) {
    assert.equal(
      source.includes(banned),
      false,
      `${file} must not know about standing issuance — a standing-issued permit is an ordinary permit`,
    );
  }
}

console.log(
  "PASS rung2 act path — the agent names only what it was offered, and the trigger decides WHEN, never WHETHER",
);
