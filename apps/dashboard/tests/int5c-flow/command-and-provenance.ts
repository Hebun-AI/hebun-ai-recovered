/*
 * INT-5C — THE COMMAND CONTRACT, THE JOIN'S SEMANTICS, AND THE TWO STANDINGS.
 *
 * Every case here runs the RELEASED executor with both of its seams injected, so the provider and
 * the Knowledge lookup can be made to answer in each of the ways they really can — without a
 * network, a key, a credential or a database. What is under test is the executor's own reasoning:
 * which sentence it prints, in which tone, and what it refuses to claim.
 *
 * ── THE ONE CONFUSION THIS FILE EXISTS TO PREVENT ────────────────────────────
 *
 *   NO DECLARATION RECORDED   IS NOT   KNOWLEDGE LOOKUP UNAVAILABLE
 *   UNAVAILABLE               IS NOT   EMPTY
 *   PARTIAL                   IS NOT   COMPLETE
 *   JOINED                    IS NOT   AUTHORITATIVE
 *
 * The first is an organizational absence claim about a real human act. The second is Hebun saying it
 * does not know. Collapsing them would make Hebun assert an absence it never established.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HEBY_COMMANDS, findHebyCommandById } from "../../src/features/heby-commands/registry";
import { planHebyCommand, type HebyCommandContext } from "../../src/features/heby-commands";
import { parseHebyInput } from "../../src/features/heby-commands/parser";
import {
  CROSS_SOURCE_JOIN_BUDGET,
  CROSS_SOURCE_PROVENANCE,
  GITHUB_REPOSITORY_RECORD_TYPE,
  runHebyCrossSourceCommand,
} from "../../src/features/heby-commands/cross-source-commands.server";
import type { ExternalReferenceLookup } from "../../src/features/knowledge/external-reference-read.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const CROSS_SOURCE_ROOT = "src/features/heby-commands/cross-source-commands.server.ts";

const CONTEXT: HebyCommandContext = {
  surface: "full-workspace",
  contextLabel: "Platform",
  contextDetail: ["Platform workspace."],
  evidenceLines: [],
  returnLabel: "Back",
};

const COMMAND_ID = "repository-knowledge";
const SLASH = "/repository-knowledge";
const REAL_ID = 1300480452;
const OTHER_ID = 999000111;

const TENANT: TenantContext = asHumanTenantContext({
  tenantId: "10000000-0000-4000-8000-00000000ca01",
  userId: "20000000-0000-4000-8000-00000000ca01",
  authIdentityId: "identity",
  membershipId: "membership",
  membershipVersion: 1,
  roleId: "role",
  sessionContextId: "session",
  provider: "local",
  assuranceLevel: "aal1",
  mfaVerified: false,
  requestId: "int-5c",
  authenticatedAt: "2026-08-26T09:00:00.000Z",
});

function repository(id: number, fullName: string) {
  return {
    repositoryId: id,
    fullName,
    isPrivate: false,
    isArchived: false,
    defaultBranch: "main",
    updatedAt: "2026-08-25T21:39:32Z",
  };
}

function discovered(repositories: ReturnType<typeof repository>[], extra: Record<string, unknown> = {}) {
  return async () => ({
    ok: true as const,
    value: {
      repositories,
      totalReportedByProvider: repositories.length,
      truncated: false,
      ...extra,
    },
  });
}

const resolvedLookup =
  (declarations: readonly { recordId: string; factKey: string; domainKey: string; hasActiveKnowledgeNode: boolean }[]) =>
  async (): Promise<ExternalReferenceLookup> => ({
    status: "resolved",
    declarations: declarations.map((d) => ({ ...d, knowledgeFactId: `fact-${d.recordId}` })),
    queried: declarations.map((d) => d.recordId),
  });

const unavailableLookup =
  (reason: "no-tenant" | "no-database" | "too-many-records" | "query-failed") =>
  async (): Promise<ExternalReferenceLookup> => ({ status: "unavailable", reason });

async function run(deps: Parameters<typeof runHebyCrossSourceCommand>[1]) {
  return runHebyCrossSourceCommand({ commandId: COMMAND_ID, args: [] }, deps);
}

function linesOf(result: Awaited<ReturnType<typeof run>>): readonly string[] {
  assert.equal(result.status, "ok", `expected a rendered result, got ${JSON.stringify(result)}`);
  if (result.status !== "ok") throw new Error("unreachable");
  return result.result.lines;
}

function toneOf(result: Awaited<ReturnType<typeof run>>): string {
  assert.equal(result.status, "ok");
  if (result.status !== "ok") throw new Error("unreachable");
  return result.result.tone;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE REGISTRY CONTRACT
 * ═════════════════════════════════════════════════════════════════════════ */
function theCommandDeclaresExactlyWhatItIs(): void {
  const command = findHebyCommandById(COMMAND_ID);
  assert.ok(command, "the command is registered");
  if (!command) return;

  assert.equal(command.slash, SLASH);
  assert.equal(command.kind, "cross-source-read", "it is the sibling kind, not a widened provider-read");
  assert.equal(command.availability, "available");
  assert.deepEqual(command.args, [], "it takes NO arguments — there is no address a caller could supply");
  assert.equal(command.reachesProvider, true, "it says out loud that it leaves the building");
  assert.equal(command.requiresModel, false, "and it needs no model");
  assert.equal(command.requiresExecution, false, "and no execution runtime");

  /*
   * The commands of this kind are enumerated, and a third would need a deliberate edit here.
   * WORK-ACTIVITY-1 made that edit and added the second: it runs the chain the other way — from the
   * organization's own work OUT to one provider record — which is why it is a sibling of this
   * command rather than an argument on it.
   */
  const crossSource = HEBY_COMMANDS.filter((c) => c.kind === "cross-source-read");
  assert.deepEqual(crossSource.map((c) => c.id), [COMMAND_ID, "work-activity"]);
  /* And THIS command still takes no address, whatever its sibling accepts. */
  assert.deepEqual(
    crossSource.find((c) => c.id === COMMAND_ID)!.args,
    [],
    "`/repository-knowledge` is unchanged — it still takes no arguments",
  );

  /* `/repositories` is untouched and still its own kind. */
  const repositories = findHebyCommandById("repositories");
  assert.equal(repositories?.kind, "provider-read", "INT-5B1's command did not change kind");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE PLAN CARRIES NO PROMPT AND NO ADDRESS
 * ═════════════════════════════════════════════════════════════════════════ */
function theDispatchPlanIsInert(): void {
  const parsed = parseHebyInput(SLASH);
  assert.equal(parsed.kind, "command", `${SLASH} parses as a command`);
  if (parsed.kind !== "command") return;

  const plan = planHebyCommand(parsed.command, parsed.args, CONTEXT);
  assert.equal(plan.kind, "cross-source-read", "it plans as a cross-source read");
  if (plan.kind !== "cross-source-read") return;
  assert.equal(plan.commandId, COMMAND_ID);
  assert.deepEqual(plan.args, []);
  assert.ok(!("prompt" in plan), "the plan has NO representation in which it could reach a model");
  assert.deepEqual(
    Object.keys(plan).sort(),
    ["args", "commandId", "handler", "kind"],
    "and it carries no tenant, no installation, no repository address and no Knowledge fact id",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. AUTHORITY AND SHAPE REFUSALS HAPPEN BEFORE ANY READ
 * ═════════════════════════════════════════════════════════════════════════ */
async function nothingIsReadWithoutATenantOrTheRightKind(): Promise<void> {
  let providerCalls = 0;
  let lookupCalls = 0;
  const counting = {
    discover: async () => {
      providerCalls += 1;
      return { ok: true as const, value: { repositories: [], totalReportedByProvider: 0, truncated: false } };
    },
    lookup: async (): Promise<ExternalReferenceLookup> => {
      lookupCalls += 1;
      return { status: "resolved", declarations: [], queried: [] };
    },
  };

  const noTenant = await run({ resolveTenant: async () => null, ...counting });
  assert.equal(noTenant.status, "unauthorized", "no tenant is unauthorized");
  assert.equal(providerCalls, 0, "and NO provider was contacted");
  assert.equal(lookupCalls, 0, "and NO Knowledge lookup was made");

  const wrongKind = await runHebyCrossSourceCommand(
    { commandId: "repositories", args: [] },
    { resolveTenant: async () => TENANT, ...counting },
  );
  assert.equal(wrongKind.status, "rejected", "a provider-read command is refused by this executor");
  if (wrongKind.status !== "rejected") return;
  assert.equal(wrongKind.reason, "not-a-cross-source-command");

  const unknown = await runHebyCrossSourceCommand(
    { commandId: "not-a-command", args: [] },
    { resolveTenant: async () => TENANT, ...counting },
  );
  assert.equal(unknown.status, "rejected");
  if (unknown.status !== "rejected") return;
  assert.equal(unknown.reason, "unknown-command");

  assert.equal(providerCalls, 0, "none of the refusals contacted a provider");
  assert.equal(lookupCalls, 0, "and none of them read Knowledge");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE JOIN ITSELF
 * ═════════════════════════════════════════════════════════════════════════ */
async function theJoinIsExactAndSaysWhichIsWhich(): Promise<void> {
  const result = await run({
    resolveTenant: async () => TENANT,
    /*
     * THE SECOND REPOSITORY IS NAMED SO THAT A NAME-BASED MATCH WOULD LINK IT.
     *
     * `Hebun-AI/hebun-platform-mirror` CONTAINS the declared fact's key, `hebun-platform`, and its
     * numeric id is NOT declared. An exact join on the provider id renders it as an absence; any
     * similarity, substring or model-assisted fallback would invent a relationship no human ever
     * recorded. This is the fixture that makes "the model cannot infer a link" a measurement.
     */
    discover: discovered([
      repository(REAL_ID, "Hebun-AI/hebun-ai-recovered"),
      repository(OTHER_ID, "Hebun-AI/hebun-platform-mirror"),
    ]),
    lookup: resolvedLookup([
      { recordId: String(REAL_ID), factKey: "hebun-platform", domainKey: "engineering", hasActiveKnowledgeNode: true },
    ]),
  });

  const lines = linesOf(result);
  assert.equal(toneOf(result), "info", "a real joined answer is an informational result");

  const declared = lines.find((l) => l.includes(String(REAL_ID)));
  const undeclared = lines.find((l) => l.includes(String(OTHER_ID)));
  assert.ok(declared && undeclared, "both repositories are rendered");

  assert.match(declared!, /DECLARATION RECORDED/, "the declared one says so");
  assert.match(declared!, /engineering \/ hebun-platform/, "and names WHICH fact holds the relationship");
  assert.match(
    undeclared!,
    /NO DECLARATION RECORDED/,
    "the undeclared one says so — even though its NAME contains the declared fact's key, because " +
      "the join is exact equality on the provider id and never a name match",
  );
  /*
   * ASSERTED ON THE FACT IDENTITY, NOT ON THE PHRASE.
   *
   * "NO DECLARATION RECORDED" CONTAINS "DECLARATION RECORDED", so a substring check would fail on
   * the product's own honest wording — this repository has been bitten by that shape before. What
   * proves no link was invented is that the undeclared line names no fact.
   */
  assert.ok(
    !undeclared!.includes("engineering / hebun-platform"),
    "no inferred matching: a similar name must never produce a relationship a human did not record",
  );
  assert.ok(
    !undeclared!.includes("UNAVAILABLE"),
    "and it is an absence, not an unavailability — the query ran",
  );

  /*
   * IDENTITY IS THE NUMERIC ID. The line carries the released evidence reference, which is composed
   * from the number; the full name is display text beside it. A rename moves the name and not the
   * reference, which is why the join survives one.
   */
  assert.match(
    declared!,
    new RegExp(`\\[integrations/github-organization/github\\.repository\\.activity\\.read/repository/${REAL_ID}\\]`),
    "the evidence identity is the provider's immutable numeric id",
  );

  /* The summary counts both sides and refuses the stronger claim. */
  assert.ok(
    lines.some((l) => /1 of 2 repositories on this page has a recorded Knowledge relationship/.test(l)),
    "the summary counts what was found",
  );
  assert.ok(
    lines.some((l) => /does not mean Hebun looked inside the repository/.test(l)),
    "and states what an absence does NOT mean",
  );

  /* It never claims the repository is active, stale, conflicting or in violation. */
  const body = lines.join("\n");
  for (const forbidden of [/\bstale\b/i, /\bconflict/i, /\bviolat/i, /should be changed/i, /\bout of date\b/i]) {
    assert.ok(!forbidden.test(body), `the result must not claim ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. A FAILED LOOKUP IS NEVER AN ABSENCE
 * ═════════════════════════════════════════════════════════════════════════ */
async function anUnavailableLookupNeverReadsAsNoDeclaration(): Promise<void> {
  for (const reason of ["query-failed", "no-database", "too-many-records", "no-tenant"] as const) {
    const result = await run({
      resolveTenant: async () => TENANT,
      discover: discovered([repository(REAL_ID, "Hebun-AI/hebun-ai-recovered")]),
      lookup: unavailableLookup(reason),
    });
    const lines = linesOf(result);
    const body = lines.join("\n");

    assert.match(body, /KNOWLEDGE LOOKUP UNAVAILABLE/, `${reason} is reported as unavailable`);
    assert.ok(
      !body.includes("NO DECLARATION RECORDED"),
      `${reason} must NEVER be rendered as "no declaration recorded"`,
    );
    assert.match(
      body,
      /UNKNOWN, not absent/,
      `${reason} says explicitly that the answer is unknown rather than empty`,
    );
    /* The repositories themselves are still real and still shown — the provider half succeeded. */
    assert.ok(body.includes(String(REAL_ID)), "the repositories that WERE read are still shown");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. UNAVAILABLE IS NOT EMPTY, AND PARTIAL IS NOT COMPLETE
 * ═════════════════════════════════════════════════════════════════════════ */
async function providerFailuresNeverBecomeAnEmptyList(): Promise<void> {
  let lookupCalls = 0;
  const countingLookup = async (): Promise<ExternalReferenceLookup> => {
    lookupCalls += 1;
    return { status: "resolved", declarations: [], queried: [] };
  };

  /* A refusal from the capability authority. */
  const refused = await run({
    resolveTenant: async () => TENANT,
    discover: async () => ({ ok: false as const, refusal: "capability-not-available" }),
    lookup: countingLookup,
  });
  assert.equal(toneOf(refused), "unavailable", "a refusal is rendered unavailable, never as a result");
  assert.ok(
    !linesOf(refused).some((l) => l.includes("NO DECLARATION RECORDED")),
    "and it claims nothing about what the organization declared",
  );

  /* A provider fault. */
  const failed = await run({
    resolveTenant: async () => TENANT,
    discover: async () => ({ ok: false as const, failure: "transport" as const, reason: "github did not respond" }),
    lookup: countingLookup,
  });
  assert.equal(toneOf(failed), "unavailable");

  /* A total-budget timeout. */
  const timedOut = await run({
    resolveTenant: async () => TENANT,
    discover: () => new Promise(() => {}) as never,
    lookup: countingLookup,
    totalTimeoutMs: 20,
  });
  assert.equal(toneOf(timedOut), "unavailable");
  assert.match(linesOf(timedOut).join("\n"), /NOTHING IS KNOWN/);

  assert.equal(
    lookupCalls,
    0,
    "when the provider half fails, the Knowledge half is not queried at all — half the evidence " +
      "is missing, so no question is answered",
  );

  /* PARTIAL STAYS PARTIAL. */
  const partial = await run({
    resolveTenant: async () => TENANT,
    discover: discovered([repository(REAL_ID, "Hebun-AI/hebun-ai-recovered")], {
      truncated: true,
      totalReportedByProvider: 120,
    }),
    lookup: resolvedLookup([]),
  });
  assert.match(
    linesOf(partial).join("\n"),
    /PARTIAL, NOT COMPLETE: GitHub reports 120 in total/,
    "a truncated provider page is reported as partial, never as the whole set",
  );

  /* A genuinely empty installation is the ONE informational non-result. */
  let emptyLookups = 0;
  const empty = await run({
    resolveTenant: async () => TENANT,
    discover: discovered([]),
    lookup: async (): Promise<ExternalReferenceLookup> => {
      emptyLookups += 1;
      return { status: "resolved", declarations: [], queried: [] };
    },
  });
  assert.equal(toneOf(empty), "info", "GitHub answering 'none' is an answer, not a failure");
  assert.match(linesOf(empty).join("\n"), /nothing to join/);
  assert.equal(emptyLookups, 0, "and with nothing to join, no Knowledge query is spent");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. ONE BATCHED QUERY, NEVER ONE PER REPOSITORY
 * ═════════════════════════════════════════════════════════════════════════ */
async function theJoinIsOneQueryForAWholePage(): Promise<void> {
  const fifty = Array.from({ length: 50 }, (_, i) => repository(1_000_000 + i, `org/repo-${i}`));
  let calls = 0;
  let askedWith: readonly string[] = [];

  const result = await run({
    resolveTenant: async () => TENANT,
    discover: discovered(fifty),
    lookup: async (_tenant, reference, recordIds): Promise<ExternalReferenceLookup> => {
      calls += 1;
      askedWith = recordIds;
      assert.equal(reference.providerKey, "github-organization");
      assert.equal(reference.capability, "github.repository.activity.read");
      assert.equal(reference.recordType, GITHUB_REPOSITORY_RECORD_TYPE);
      return { status: "resolved", declarations: [], queried: [...recordIds] };
    },
  });

  assert.equal(calls, 1, "fifty repositories cost ONE Knowledge query, not fifty");
  assert.equal(calls, CROSS_SOURCE_JOIN_BUDGET.maxKnowledgeQueries, "which is the declared ceiling");
  assert.equal(askedWith.length, 50, "and it asked about every repository on the page");
  assert.equal(askedWith.length, CROSS_SOURCE_JOIN_BUDGET.maxRecordsPerQuery);
  assert.ok(
    askedWith.every((id) => /^\d+$/.test(id)),
    "it asks by numeric provider id, never by repository name",
  );
  assert.equal(linesOf(result).filter((l) => l.includes("NO DECLARATION RECORDED")).length, 50);

  /*
   * A PROVIDER THAT RETURNS MORE THAN THE CEILING IS CUT AT THE COMMAND BOUNDARY.
   *
   * The released seam bounds its own page, and this command restates the ceiling so its promise does
   * not depend on a constant defined two features away. Without that restatement a provider page of
   * sixty would be fanned out whole: sixty rendered rows, and a Knowledge lookup asked about sixty
   * ids — which the read seam would REFUSE as `too-many-records`, turning a working command into
   * "your declarations are unknown" for every repository at once.
   */
  const sixty = Array.from({ length: 60 }, (_, i) => repository(2_000_000 + i, `org/big-${i}`));
  let bigAsked: readonly string[] = [];
  const bounded = await run({
    resolveTenant: async () => TENANT,
    discover: discovered(sixty),
    lookup: async (_tenant, _reference, recordIds): Promise<ExternalReferenceLookup> => {
      bigAsked = recordIds;
      return { status: "resolved", declarations: [], queried: [...recordIds] };
    },
  });
  const rendered = linesOf(bounded).filter((l) => /^\[integrations\//.test(l));
  assert.equal(rendered.length, 50, "an over-long provider page is cut to the ceiling, not fanned out");
  assert.equal(bigAsked.length, 50, "and the Knowledge lookup is asked about at most the ceiling");
  assert.ok(
    !linesOf(bounded).join("\n").includes("KNOWLEDGE LOOKUP UNAVAILABLE"),
    "so the lookup still runs — an unbounded fan-out would have made it refuse for every repository",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. TWO STANDINGS, NEVER MERGED
 * ═════════════════════════════════════════════════════════════════════════ */
async function theProvenanceKeepsTheTwoSourcesApart(): Promise<void> {
  const result = await run({
    resolveTenant: async () => TENANT,
    discover: discovered([repository(REAL_ID, "Hebun-AI/hebun-ai-recovered")]),
    lookup: resolvedLookup([
      { recordId: String(REAL_ID), factKey: "hebun-platform", domainKey: "engineering", hasActiveKnowledgeNode: true },
    ]),
  });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;

  const provenance = result.result.provenance ?? "";
  assert.equal(provenance, CROSS_SOURCE_PROVENANCE, "the released provenance line is what is rendered");

  for (const clause of [
    /authoritative: false/,
    /provider-derived observation/,
    /read live from GitHub just now/i,
    /durable declarations/,
    /recorded by a human/i,
    /never proof/i,
    /derived and non-authoritative/,
    /not Knowledge and not a Governance act/,
    /stored, indexed or admitted anywhere/,
  ]) {
    assert.match(provenance, clause, `the provenance must state ${clause}`);
  }

  /* And it must never make the joined view sound authoritative. */
  for (const forbidden of [/authoritative: true/, /\bsettled\b/i, /\bendorsed\b/i, /\bverified truth\b/i]) {
    assert.ok(!forbidden.test(provenance), `the provenance must not contain ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. THE MODEL IS NOT INVOLVED, AND NOTHING IS PERSISTED
 * ═════════════════════════════════════════════════════════════════════════ */
function theExecutorHasNoModelAndNoWriter(): void {
  const source = read(CROSS_SOURCE_ROOT);
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  for (const banned of [
    "fetch(",
    ".insert(",
    ".update(",
    ".delete(",
    "@/db",
    "next/cache",
    "revalidate",
    "claude",
    "anthropic",
    "model-answer",
    "prompt",
  ]) {
    assert.ok(!code.includes(banned), `the cross-source executor must not contain "${banned}"`);
  }

  /*
   * IT MINTS NO IDENTIFIER AND READS NO CLOCK. The evidence reference is composed by the released
   * INT-5B1 builder from the provider's own id, so this module invents nothing that could later be
   * mistaken for a Hebun record.
   */
  for (const banned of ["randomUUID", "createHash", "Date.now(", "crypto"]) {
    assert.ok(!code.includes(banned), `the cross-source executor must not use ${banned}`);
  }

  /* The join is equality, never similarity. */
  for (const banned of ["similar", "fuzzy", "score", "levenshtein", "includes(repository.fullName"]) {
    assert.ok(!code.toLowerCase().includes(banned.toLowerCase()), `no inferred matching (${banned})`);
  }
}

async function main(): Promise<void> {
  theCommandDeclaresExactlyWhatItIs();
  theDispatchPlanIsInert();
  await nothingIsReadWithoutATenantOrTheRightKind();
  await theJoinIsExactAndSaysWhichIsWhich();
  await anUnavailableLookupNeverReadsAsNoDeclaration();
  await providerFailuresNeverBecomeAnEmptyList();
  await theJoinIsOneQueryForAWholePage();
  await theProvenanceKeepsTheTwoSourcesApart();
  theExecutorHasNoModelAndNoWriter();

  console.log("int5c-flow/command-and-provenance: OK");
}

void main();
