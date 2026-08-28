/*
 * GOVERNED-EXECUTION-1 — THE READ SURFACE HOLDS NO AUTHORITY.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The execution ledger can SHOW what already happened and can CAUSE nothing. Its whole import
 *    closure performs no durable write, opens no socket and reaches no model. Its surface is a
 *    server component with no control of any kind, so a retry button has nothing it could call.
 *    The tenant comes from the authorized context and no parameter can name another. The wording
 *    keeps accepted apart from sent and delivered, and unknown apart from failed and from
 *    safe-to-retry. And the phase added no writer to the repository."
 *
 * Structural assertions run over comment-stripped source: they are about what the code can reach,
 * not about what its prose promises.
 *
 * Pure. No database, no network, no model.
 */
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*, which the
// projection reaches transitively. Importing a single table module first re-enters `_base` before
// it has initialized, and the failure looks nothing like an ordering problem.
import "../../src/db/schema";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite, codeOf } from "../helpers/durable-write-detector";
import {
  EXECUTION_LEDGER_WORDING,
  EXECUTION_OUTCOME_WORDING,
  PROVIDER_ACCEPTANCE_NON_CLAIMS,
  UNRECONCILED_ATTEMPT_STATUSES,
  attemptRequiresAttention,
  type ExecutionAttemptStatus,
  type ExecutionAttemptView,
} from "../../src/features/action-execution/contracts";
import {
  readExecutionLedger,
  toExecutionLedgerEntry,
} from "../../src/features/action-execution/execution-ledger-projection.server";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const PROJECTION = "src/features/action-execution/execution-ledger-projection.server.ts";
const READER = "src/features/action-execution/read-execution-attempts.server.ts";
const SURFACE = "src/components/decision-workspace/execution-ledger.tsx";
const ROUTE = "src/app/(dashboard)/approvals/page.tsx";
const CONTRACTS = "src/features/action-execution/contracts.ts";

/** Every status the vocabulary admits. Total coverage, so a new value cannot slip past untested. */
const ALL_STATUSES: readonly ExecutionAttemptStatus[] = [
  "pending",
  "accepted",
  "refused",
  "failed",
  "unknown",
];

function resolveImport(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.normalize(path.join(path.dirname(from), spec));
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    const absolute = path.join(ROOT, candidate);
    if (existsSync(absolute) && statSync(absolute).isFile()) return candidate;
  }
  return null;
}

/** The REAL import graph, walked in comment-stripped code — not a list somebody maintained. */
function closure(entry: string): Set<string> {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    let source: string;
    try {
      source = codeOf(read(file));
    } catch {
      continue;
    }
    for (const match of source.matchAll(/(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g)) {
      const resolved = resolveImport(match[1]!, file);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return seen;
}

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE READ PATH REACHES THE LEDGER — AND NO WRITER, ANYWHERE IN ITS CLOSURE.
 *
 * The positive half matters as much as the negative: a firewall that only forbids would still pass
 * if the surface stopped consulting the durable row and started inventing one.
 * ═════════════════════════════════════════════════════════════════════════ */
function readsTheLedgerAndWritesNothing(): void {
  const graph = closure(PROJECTION);

  assert.ok(graph.has(READER), "the projection reaches the released attempt reader");
  assert.ok(
    graph.has("src/db/schema/action-execution.ts"),
    "which reaches the authoritative attempt table",
  );

  /*
   * NO DURABLE WRITE IN THE ENTIRE CLOSURE, measured by the shared detector rather than a second
   * spelling of the same question. This is the load-bearing assertion of the phase.
   */
  for (const file of graph) {
    assert.ok(
      !performsDurableWrite(read(file)),
      `${file} performs a durable write — GOVERNED-EXECUTION-1 is a reader`,
    );
  }

  /* And no raw statement smuggles one past the builder-shaped detector. */
  for (const file of graph) {
    const code = codeOf(read(file));
    for (const raw of [/insert\s+into/i, /update\s+[a-z_"]+\s+set/i, /delete\s+from/i, /truncate\s+table/i]) {
      assert.ok(!raw.test(code), `${file} must not carry raw SQL matching ${raw}`);
    }
    assert.ok(!/\.transaction\(/.test(code), `${file} must not open a transaction`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE READ PATH CANNOT DECIDE, AUTHORIZE, SPEND, EXECUTE OR SEND.
 *
 * Asserted as SYMBOLS over the whole closure, so the guarantee is about what the code can call —
 * not about which module it politely chose to import.
 * ═════════════════════════════════════════════════════════════════════════ */
function reachesNoConsequentialAuthority(): void {
  const graph = closure(PROJECTION);
  const FORBIDDEN_SYMBOLS = [
    "approveActionRequest",
    "rejectActionRequest",
    "revokeActionPermit",
    "consumeActionPermit",
    "executeAuthorizedAction",
    "recordActionRequest",
    "recordActionExecutionEventWithin",
    "recordActionAuthorizationEventWithin",
    "writeGovernanceDecisionWithin",
    "resolveExternalSendAdapter",
    "createResendEmailTransport",
    "resolveGovernanceAuthority",
  ];
  for (const file of graph) {
    const code = codeOf(read(file));
    for (const symbol of FORBIDDEN_SYMBOLS) {
      assert.ok(!code.includes(symbol), `${file} must not reach "${symbol}" — the ledger reports only`);
    }
  }

  /* No credential and no network primitive is reachable from a surface that only reports. */
  for (const file of graph) {
    const code = codeOf(read(file));
    for (const forbidden of [
      "HEBUN_EXTERNAL_SEND_API_KEY",
      "ANTHROPIC",
      "node:http",
      "node:net",
      "node:tls",
      "globalThis.fetch",
      "https://",
    ]) {
      assert.ok(!code.includes(forbidden), `${file} must not reach "${forbidden}"`);
    }
    assert.ok(!/\bfetch\s*\(/.test(code), `${file} must make no network call`);
  }

  /* No model touches the answer: a recorded act may not be summarized, softened or classified. */
  for (const file of graph) {
    const lower = codeOf(read(file)).toLowerCase();
    for (const forbidden of ["anthropic", "selectmodeltransport", "generatehebymodelanswer"]) {
      assert.ok(!lower.includes(forbidden), `${file} must not reach the model via "${forbidden}"`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE PHASE ADDED NO WRITER TO THE REPOSITORY.
 *
 * Measured as a census over `src/`, not asserted about the two new files: a phase that quietly
 * gave some OTHER module a write to the attempt table would pass a narrower check.
 * ═════════════════════════════════════════════════════════════════════════ */
function noNewWriterExists(): void {
  const writers = collect("src")
    .filter((f) => {
      const code = codeOf(read(f));
      return /\.\s*(?:insert|update)\s*\(\s*actionExecutionAttempts\s*\)/.test(code);
    })
    .sort();
  assert.deepEqual(
    writers,
    [path.join("src", "features", "action-execution", "execute-authorized-action.server.ts")],
    "exactly one module writes the attempt table, and it is the released executor",
  );

  /* The new files name no write verb against any table at all. */
  for (const file of [PROJECTION, SURFACE]) {
    assert.ok(!performsDurableWrite(read(file)), `${file} must perform no durable write`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE SURFACE IS A SERVER COMPONENT WITH NO CONTROL.
 *
 * The absence of a retry button is STRUCTURAL, not editorial: with no client boundary and no
 * imported action, there is nothing a control could be wired to.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSurfaceOffersNoControl(): void {
  const code = codeOf(read(SURFACE));

  assert.ok(!code.includes("use client"), "the ledger is a server component — no client boundary");
  for (const forbidden of [
    "<button",
    "<form",
    "onClick",
    "onSubmit",
    "onChange",
    "useState",
    "useTransition",
    "useEffect",
    "startTransition",
    "revalidatePath",
    "approvals/actions",
  ]) {
    assert.ok(!code.includes(forbidden), `the ledger surface must not contain "${forbidden}"`);
  }

  /* It imports no server action, so none of the four mutation boundaries is reachable from it. */
  for (const action of [
    "approveActionRequestAction",
    "rejectActionRequestAction",
    "revokeActionPermitAction",
    "executeAuthorizedActionAction",
  ]) {
    assert.ok(!code.includes(action), `the ledger surface must not reach "${action}"`);
  }

  /*
   * AND NO CONTROL VOCABULARY IS RENDERED. A label is what a human reads as an offer, so the ban
   * is on the rendered words rather than only on the handlers behind them.
   */
  for (const label of [
    ">Retry<",
    ">Replay<",
    ">Reconcile<",
    ">Resolve<",
    ">Dismiss<",
    ">Send again<",
    ">Mark as sent<",
    ">Mark successful<",
    ">Mark failed<",
  ]) {
    assert.ok(!code.includes(label), `the ledger surface must not offer "${label}"`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE TENANT COMES FROM THE AUTHORIZED CONTEXT, AND NOTHING ELSE.
 * ═════════════════════════════════════════════════════════════════════════ */
async function tenantIsolationIsStructural(): Promise<void> {
  const code = codeOf(read(PROJECTION));

  assert.ok(
    /export async function readExecutionLedger\(\s*tenant: TenantContext \| null,/.test(code),
    "the entry point takes the branded authorized context, never a caller-supplied id",
  );
  for (const forbidden of ["tenantId:", "tenantId?:", "allTenants", "crossTenant", "everyTenant"]) {
    assert.ok(!code.includes(forbidden), `no cross-tenant or client-supplied form: "${forbidden}"`);
  }

  /* The projection issues no statement of its own, so the reader's predicate is the only scope. */
  assert.ok(!code.includes(".select("), "the projection adds no statement — it composes the reader");
  assert.ok(
    /eq\(actionExecutionAttempts\.tenantId, tenant\.tenantId\)/.test(codeOf(read(READER))),
    "and the reader it composes scopes every statement by the session tenant",
  );

  /* A missing context is refused before any read is attempted. */
  const noTenant = await readExecutionLedger(null);
  assert.equal(noTenant.status, "unavailable", "no authorized tenant means no ledger");
  assert.equal(
    noTenant.status === "unavailable" ? noTenant.reason : "",
    "no-authorized-tenant-context",
  );

  /* An unreadable store is UNAVAILABLE — never an empty ledger. */
  const tenant = asHumanTenantContext({
    tenantId: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    authIdentityId: "33333333-3333-4333-8333-333333333333",
    membershipId: "44444444-4444-4444-8444-444444444444",
    membershipVersion: 1,
    roleId: "55555555-5555-4555-8555-555555555555",
    sessionContextId: "66666666-6666-4666-8666-666666666666",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "ge1-firewall",
    authenticatedAt: new Date(0).toISOString(),
  });
  const unavailable = await readExecutionLedger(tenant, { getDb: () => null });
  assert.equal(unavailable.status, "unavailable", "an unreadable store never renders as empty");
  assert.equal(
    unavailable.status === "unavailable" ? unavailable.reason : "",
    "persistence-not-configured",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. ONE DEFINITION OF "NEEDS A HUMAN", USED BY BOTH THE SQL AND THE PARTITION.
 *
 * R6B's lesson: SQL duplicating pure logic needs one source and an equivalence test. Before this
 * phase the set was spelled inline in the predicate; a second spelling in the projection could
 * have drifted silently.
 * ═════════════════════════════════════════════════════════════════════════ */
function oneAttentionDefinition(): void {
  assert.deepEqual([...UNRECONCILED_ATTEMPT_STATUSES], ["pending", "unknown"]);

  /* Total over the vocabulary — not a spot check on the two that happen to be true. */
  for (const status of ALL_STATUSES) {
    assert.equal(
      attemptRequiresAttention(status),
      status === "pending" || status === "unknown",
      `attemptRequiresAttention(${status}) must follow the frozen set`,
    );
  }
  assert.equal(
    ALL_STATUSES.filter((s) => attemptRequiresAttention(s)).length,
    UNRECONCILED_ATTEMPT_STATUSES.length,
    "the predicate admits exactly as many statuses as the frozen set holds",
  );

  /* The SQL NAMES the constant rather than repeating its members. */
  const reader = codeOf(read(READER));
  assert.ok(
    /inArray\(\s*actionExecutionAttempts\.status,\s*\[\.\.\.UNRECONCILED_ATTEMPT_STATUSES\]\s*\)/.test(
      reader,
    ),
    "the SQL predicate reads the shared constant",
  );
  assert.ok(
    !/inArray\([^)]*"unknown"[^)]*"pending"/.test(reader) &&
      !/inArray\([^)]*"pending"[^)]*"unknown"/.test(reader),
    "and no literal copy of the set survives beside it",
  );

  /* The projection derives the per-row flag from the same predicate, never its own condition. */
  const projection = codeOf(read(PROJECTION));
  assert.ok(
    projection.includes("attemptRequiresAttention(view.status)"),
    "the projection derives attention from the shared predicate",
  );
  assert.ok(
    !/status === "unknown"|status === "pending"/.test(projection),
    "and never re-tests the statuses by hand",
  );

  /*
   * ── THE ATTENTION LIST IS NOT FILTERED FROM THE BOUNDED PAGE ──────────────
   *
   * The defect this pins was BUILT and caught in review: attention derived from the 50 most recent
   * attempts loses an `unknown` older than fifty newer rows — silently, on the one list whose whole
   * purpose is that an ambiguous irreversible act is never lost.
   */
  assert.ok(
    projection.includes("readUnreconciledAttempts(tenant, bounded)"),
    "attention is read under its own status predicate, in the database",
  );
  /*
   * ASSERT THE ASSIGNMENT, NOT THE CALL. An earlier form of this checked only that the status-
   * filtered read was still CALLED — which stayed true when the result was computed from the
   * bounded page instead and the call's answer simply went unused. The bite-proof found it. What
   * matters is where `needsAttention` gets its value.
   */
  assert.ok(
    projection.includes("const needsAttention = attention.items.map(toExecutionLedgerEntry)"),
    "and the attention list takes its value from that read",
  );
  assert.ok(
    !/entries\.filter/.test(projection),
    "it is never filtered out of the bounded history page",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6b. A BOUNDED LIST SAYS IT IS BOUNDED.
 *
 * R6B: silent truncation reads as "everything is here". On this surface that sentence would mean
 * an irreversible act nobody was shown.
 * ═════════════════════════════════════════════════════════════════════════ */
function theBoundIsDisclosed(): void {
  const projection = codeOf(read(PROJECTION));

  /* The bound is passed explicitly, so the truncation flag compares against a known number. */
  assert.ok(
    projection.includes("const limit = deps.limit ?? EXECUTION_LEDGER_PAGE_LIMIT"),
    "the bound is explicit, not inherited from the reader's default",
  );
  assert.ok(
    projection.includes("historyTruncated: entries.length >= limit") &&
      projection.includes("attentionTruncated: needsAttention.length >= limit"),
    "both lists report whether they filled their bound",
  );

  /* Either half failing makes the whole ledger unavailable — never half an answer. */
  assert.ok(
    projection.includes('if (history.status !== "read") return { status: "unavailable"') &&
      projection.includes('if (attention.status !== "read") return { status: "unavailable"'),
    "a half-readable ledger is unavailable, not a partial history",
  );

  /* And the route hands both flags to the surface rather than dropping them. */
  const route = codeOf(read(ROUTE));
  assert.ok(
    /historyTruncated=\{ledger\.status === "read" \? ledger\.historyTruncated : false\}/.test(route) &&
      /attentionTruncated=\{ledger\.status === "read" \? ledger\.attentionTruncated : false\}/.test(route),
    "the route passes both truncation facts to the surface",
  );

  /* The surface renders both disclosures. */
  const surface = codeOf(read(SURFACE));
  assert.ok(
    surface.includes("EXECUTION_LEDGER_WORDING.historyTruncated") &&
      surface.includes("EXECUTION_LEDGER_WORDING.attentionTruncated"),
    "and the surface renders both",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE PROJECTION CARRIES NO IDENTIFIER IT HAS NO USE FOR.
 * ═════════════════════════════════════════════════════════════════════════ */
function theProjectionWithholds(): void {
  const view: ExecutionAttemptView = {
    attemptId: "attempt-1",
    permitId: "permit-1",
    handoffId: "handoff-secret-1",
    requestId: "request-1",
    actionKind: "send-external-communication",
    adapterId: "resend-email-v1",
    status: "unknown",
    providerResponseClass: "ambiguous",
    providerMessageId: null,
    failureClass: null,
    recipientId: "recipient-1",
    startedAt: new Date(0).toISOString(),
    completedAt: null,
  };
  const entry = toExecutionLedgerEntry(view);

  const serialized = JSON.stringify(entry);
  assert.ok(!serialized.includes("handoff-secret-1"), "the handoff key does not cross to a surface");
  assert.ok(!serialized.includes("recipient-1"), "and neither does the bare recipient id");
  assert.ok(!("handoffId" in entry), "no handoff field exists on the entry");
  assert.ok(!("recipientId" in entry), "no recipient field exists on the entry");

  /* What it DOES carry is copied, not derived — except attention, which is the shared predicate. */
  assert.equal(entry.attemptId, view.attemptId);
  assert.equal(entry.permitId, view.permitId);
  assert.equal(entry.requestId, view.requestId);
  assert.equal(entry.status, view.status);
  assert.equal(entry.completedAt, null, "a null column stays null — nothing is invented");
  assert.equal(entry.requiresAttention, true, "an ambiguous outcome needs a human");

  /* An accepted attempt is not flagged for attention, and keeps the only proof of acceptance. */
  const accepted = toExecutionLedgerEntry({
    ...view,
    status: "accepted",
    providerResponseClass: "accepted",
    providerMessageId: "provider-id-1",
    completedAt: new Date(1000).toISOString(),
  });
  assert.equal(accepted.requiresAttention, false);
  assert.equal(accepted.providerMessageId, "provider-id-1");

  /* And the surface never names the withheld fields either. */
  const surface = codeOf(read(SURFACE));
  for (const withheld of ["handoffId", "recipientId", "tenantId", "endpoint"]) {
    assert.ok(!surface.includes(withheld), `the surface must not render "${withheld}"`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. PRODUCT TRUTH — THE FOUR DISTINCTIONS, PINNED AS TEXT.
 *
 *   accepted != sent      accepted != delivered
 *   unknown  != failed    unknown  != safe-to-retry
 * ═════════════════════════════════════════════════════════════════════════ */
function productTruth(): void {
  const ledgerWording = Object.values(EXECUTION_LEDGER_WORDING).join(" ").toLowerCase();

  /* ACCEPTED IS NOT SENT AND NOT DELIVERED. */
  const accepted = EXECUTION_OUTCOME_WORDING.accepted.toLowerCase();
  assert.ok(accepted.includes("accepted by the provider"), "acceptance is stated as the provider's");
  for (const forbidden of ["delivered", "was sent", "successfully sent", "received"]) {
    assert.ok(!accepted.includes(forbidden), `the accepted line may never say "${forbidden}"`);
  }
  assert.ok(
    PROVIDER_ACCEPTANCE_NON_CLAIMS.includes("does not mean the message was delivered"),
    "and the non-claims say so explicitly",
  );
  /* The surface renders those non-claims rather than paraphrasing them. */
  assert.ok(
    codeOf(read(SURFACE)).includes("PROVIDER_ACCEPTANCE_NON_CLAIMS"),
    "the surface renders the frozen non-claims beside every acceptance",
  );

  /* UNKNOWN IS NOT FAILED. */
  const unknown = EXECUTION_OUTCOME_WORDING.unknown.toLowerCase();
  assert.notEqual(EXECUTION_OUTCOME_WORDING.unknown, EXECUTION_OUTCOME_WORDING.failed);
  assert.ok(!unknown.includes("nothing was sent"), "an unknown outcome may not claim nothing left");
  assert.ok(!unknown.includes("failed"), "and may not call itself a failure");
  assert.ok(unknown.includes("may have accepted"), "it states the provider may hold the request");

  /* UNKNOWN IS NOT SAFE TO RETRY. */
  assert.ok(unknown.includes("do not retry"), "and tells the human not to retry blindly");
  for (const forbidden of ["safe to retry", "you may retry", "retry it", "try again"]) {
    assert.ok(!ledgerWording.includes(forbidden), `the ledger may never say "${forbidden}"`);
  }

  /* THE ATTENTION PREAMBLE STATES THE THREE ABSENT CAPABILITIES BY NAME. */
  const preamble = EXECUTION_LEDGER_WORDING.attentionPreamble.toLowerCase();
  assert.ok(preamble.includes("may already have happened"), "the effect may already have occurred");
  for (const absent of ["automatic retry", "replay", "reconciliation"]) {
    assert.ok(preamble.includes(absent), `the preamble names the absent "${absent}"`);
  }
  assert.ok(
    preamble.includes("no control"),
    "and says the surface offers none, rather than leaving it to be noticed",
  );

  /* PENDING IS NOT SUCCESS. */
  const pending = EXECUTION_LEDGER_WORDING.pendingAfterReload.toLowerCase();
  assert.ok(pending.includes("not a provider success"), "a pending row is not a success");
  assert.ok(pending.includes("not a provider failure"), "and is not a failure either");

  /* A SECOND SEND IS A SECOND AUTHORIZATION, STATED AS A REQUIREMENT. */
  const second = EXECUTION_LEDGER_WORDING.secondSendRequirement.toLowerCase();
  for (const required of ["new proposal", "new governance", "new permit"]) {
    assert.ok(second.includes(required), `a second send requires a "${required}"`);
  }

  /* UNREADABLE IS NOT EMPTY. */
  assert.ok(
    EXECUTION_LEDGER_WORDING.unavailable.toLowerCase().includes("is not an empty one"),
    "an unreadable ledger says it is not an empty one",
  );

  /* NOTHING ANYWHERE IN THE LEDGER VOCABULARY CLAIMS DELIVERY. */
  for (const forbidden of ["delivered", "successfully sent", "the recipient received"]) {
    assert.ok(!ledgerWording.includes(forbidden), `the ledger may never say "${forbidden}"`);
  }

  /*
   * THE WORDING IS A FROZEN VALUE, NOT PROSE INSIDE A COMPONENT.
   *
   * That is what makes every assertion above possible: a sentence typed directly into JSX can be
   * softened by anyone editing layout, and no test would ever see it. The surface must therefore
   * RENDER the constant rather than repeat it.
   */
  const contracts = codeOf(read(CONTRACTS));
  assert.ok(
    contracts.includes("export const EXECUTION_LEDGER_WORDING = Object.freeze({"),
    "the ledger wording is a frozen value in the contracts module",
  );
  const surface = codeOf(read(SURFACE));
  assert.ok(
    surface.includes("EXECUTION_LEDGER_WORDING."),
    "and the surface renders that constant",
  );
  assert.ok(
    !surface.includes(EXECUTION_LEDGER_WORDING.attentionPreamble),
    "rather than carrying its own copy of the sentence, which no test could pin",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. THE ROUTE OWNS THE TENANT AND THE READ; THE COMPONENT OWNS NEITHER.
 * ═════════════════════════════════════════════════════════════════════════ */
function theRouteResolvesAndTheSurfaceRenders(): void {
  const route = codeOf(read(ROUTE));

  assert.ok(/resolveTenantContext\(\)/.test(route), "the route resolves the tenant once");
  assert.ok(
    /readExecutionLedger\(tenant\)/.test(route),
    "and hands that tenant to the ledger read, not a caller-supplied one",
  );

  /* The released availability rule for the authorization queue is UNTOUCHED by this phase. */
  assert.ok(
    /connected\s*=\s*requests\.status === "read" && permits\.status === "read"/.test(route),
    "the queue's connected rule still means both of ITS reads answered",
  );
  /* The ledger's availability is its own — one unreadable read may not hide the other's truth. */
  assert.ok(
    /connected=\{ledger\.status === "read"\}/.test(route),
    "the ledger reports its own availability, independent of the queue's",
  );

  /* Exactly one caller of the ledger read exists, and it is the route. */
  const callers = collect("src")
    .filter((f) => f !== PROJECTION && codeOf(read(f)).includes("readExecutionLedger"))
    .sort();
  assert.deepEqual(
    callers,
    [path.join("src", "app", "(dashboard)", "approvals", "page.tsx")],
    "the ledger read is reachable from the approvals route and nowhere else",
  );

  /* The surface holds no authority of its own — the released presentation rule, re-asserted. */
  const surface = codeOf(read(SURFACE));
  for (const forbidden of [
    '"use server"',
    "drizzle-orm",
    "@/db/",
    "resolveTenantContext",
    "resolveGovernanceAuthority",
    "governance-decision/",
  ]) {
    assert.ok(!surface.includes(forbidden), `the surface must not contain "${forbidden}"`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 10. NO SECOND ACT-HISTORY AUTHORITY WAS CREATED.
 *
 * `/audit` (R7.1.1) owns recorded acts from `audit_log`. This phase reads the ATTEMPT table and
 * must not become a second reader of that ledger — which would also drag the audit WRITER into a
 * read surface's import graph.
 * ═════════════════════════════════════════════════════════════════════════ */
function noSecondActHistory(): void {
  const graph = closure(PROJECTION);
  for (const file of graph) {
    assert.ok(
      !file.startsWith("src/features/governance-audit/"),
      `${file} — the ledger must not reach the audit writer's module`,
    );
    assert.ok(
      !file.startsWith("src/features/governance-activity/"),
      `${file} — /audit owns recorded acts; this phase adds no second reader of them`,
    );
  }
  for (const file of [PROJECTION, SURFACE]) {
    const code = codeOf(read(file));
    for (const forbidden of ["auditLog", "audit_log", "readActionExecutionHistory"]) {
      assert.ok(!code.includes(forbidden), `${file} must not name "${forbidden}"`);
    }
  }
}

async function main(): Promise<void> {
  readsTheLedgerAndWritesNothing();
  reachesNoConsequentialAuthority();
  noNewWriterExists();
  theSurfaceOffersNoControl();
  await tenantIsolationIsStructural();
  oneAttentionDefinition();
  theBoundIsDisclosed();
  theProjectionWithholds();
  productTruth();
  theRouteResolvesAndTheSurfaceRenders();
  noSecondActHistory();

  console.log("ge1-ledger/ledger-read-firewall: OK");
}

void main();
