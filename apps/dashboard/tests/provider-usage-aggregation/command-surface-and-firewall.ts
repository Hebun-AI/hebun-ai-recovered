/*
 * R2F.1 — the `/usage` command, the shared read seam, and the firewalls around both.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "`/usage` is a real, available READ that answers from the SAME aggregation seam the provider
 *    matrix uses, keeps working while the provider is off, refuses without a tenant, states its
 *    totals as recorded lower bounds rather than spend — and neither it nor the seam can write,
 *    dispatch, price, or govern anything."
 *
 * No database, no network, no key: the seam is injected, so everything here is provable offline.
 * The ARITHMETIC is proven against a real PostgreSQL in the sibling durability suite, because the
 * things that could go wrong there are properties of the database, not of this wiring.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { findHebyCommandById, HEBY_COMMANDS } from "../../src/features/heby-commands/registry";
import { runHebyReadCommand } from "../../src/features/heby-commands/read-commands.server";
import {
  REAL_PROVIDER_TRANSPORT,
  emptyRecordedUsageTotals,
  hasNoRecordedUsage,
  type RecordedProviderUsage,
  type RecordedProviderUsageRead,
} from "../../src/features/heby-provider-ops/usage-contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

const AGGREGATION_PATH = "src/features/heby-provider-ops/provider-usage-aggregation.server.ts";
const CONTRACTS_PATH = "src/features/heby-provider-ops/usage-contracts.ts";
const MATRIX_PAGE = "src/app/(dashboard)/director/provider-matrix/page.tsx";
const CARD_PATH = "src/components/platform-providers/recorded-usage-card.tsx";
const READ_COMMANDS_PATH = "src/features/heby-commands/read-commands.server.ts";

const AGGREGATION_CODE = codeOf(read(AGGREGATION_PATH));
const CARD_CODE = codeOf(read(CARD_PATH));
const SRC_FILES = collect("src");

const TENANT = {
  tenantId: "aaaaaaaa-0000-0000-0000-000000000001",
  userId: "bbbbbbbb-0000-0000-0000-000000000002",
} as TenantContext;

function sampleUsage(): RecordedProviderUsage {
  const totals = {
    recordedCalls: 5,
    fullyMeasuredCalls: 4,
    unknownTokenRows: 1,
    inputTokens: 3798,
    outputTokens: 894,
    totalTokens: 4692,
  };
  return {
    totals,
    byProvider: [{ key: "claude", ...totals }],
    byModel: [{ key: "claude-haiku-4-5", ...totals }],
    byDay: [{ key: "2026-08-10", ...totals }],
  };
}

async function main(): Promise<void> {
  /* ═══════════════════════════════════════════════════════════════════════
   * 1. THE REGISTRY DESCRIPTOR IS NOW REAL
   * ═══════════════════════════════════════════════════════════════════════ */
  const command = findHebyCommandById("usage");
  assert.ok(command, "/usage exists in the registry");
  assert.equal(command.availability, "available", "/usage is no longer source-less");
  assert.equal(command.kind, "read", "/usage reads; it never acts");
  assert.equal(command.safeWhenProviderOff, true, "usage is readable while the provider is off");
  assert.equal(command.requiresModel, false, "/usage asks no model anything");
  assert.equal(command.requiresExecution, false, "/usage executes nothing");
  assert.equal(command.handler, "usage");
  assert.equal(
    command.unavailableReason,
    undefined,
    "an available command carries no unavailable reason",
  );
  assert.equal(command.category, "platform");

  /* ── RECORD INTEGRITY: the stale claim must be GONE from the repository ──
   * The old reason said no aggregation authority existed. One does now, so the sentence is a
   * false statement about shipped code — and a suite can pass while a stale claim survives
   * unless the claim's own absence is asserted. Matched on distinctive FRAGMENTS rather than
   * the whole paragraph, so a reworded survivor is still caught.                              */
  const STALE_CLAIMS = [
    "No usage-aggregation authority exists",
    "Hebun has no seam that totals them",
  ] as const;
  const ALL_SRC = SRC_FILES.map((f) => read(f)).join("\n");
  for (const stale of STALE_CLAIMS) {
    assert.ok(
      !ALL_SRC.includes(stale),
      `R2F.1 built this capability, so the claim that it does not exist must be gone: "${stale}"`,
    );
  }
  assert.ok(
    !/spend/i.test(command.description),
    "the description promises tokens, not spend — Hebun has no pricing",
  );
  assert.ok(/recorded/i.test(command.description), "the description says RECORDED");

  /* The registry-wide invariant, asserted for the whole set rather than assumed for one entry. */
  assert.ok(
    HEBY_COMMANDS.every((c) => c.safeWhenProviderOff),
    "every command degrades honestly with the provider off",
  );

  /* ═══════════════════════════════════════════════════════════════════════
   * 2. THE COMMAND ANSWERS FROM THE INJECTED SEAM — NOT A SECOND SUM
   * ═══════════════════════════════════════════════════════════════════════ */
  const seen: TenantContext[] = [];
  const result = await runHebyReadCommand(
    { commandId: "usage", args: [], route: "/heby" },
    {
      resolveTenant: async () => TENANT,
      readUsage: async (t) => {
        seen.push(t);
        return { status: "read", usage: sampleUsage() };
      },
    },
  );
  assert.equal(result.status, "ok");
  if (result.status !== "ok") throw new Error("unreachable");
  assert.equal(seen.length, 1, "the aggregation seam was consulted exactly once");
  assert.equal(seen[0]!.tenantId, TENANT.tenantId, "with the SERVER-resolved tenant");

  const body = result.result.lines.join("\n");
  assert.ok(body.includes("3,798"), "the seam's input total is what is rendered");
  assert.ok(body.includes("894"), "the seam's output total is what is rendered");
  assert.ok(body.includes("4,692"), "the seam's grand total is what is rendered");
  assert.ok(body.includes("claude-haiku-4-5"), "the model breakdown comes from the same seam");
  assert.ok(body.includes("2026-08-10"), "the day breakdown comes from the same seam");
  assert.equal(result.result.tone, "info");
  assert.ok(
    /did not fully report: 1\b/.test(body),
    "the one unreported row is stated, not silently absorbed",
  );

  /* ═══════════════════════════════════════════════════════════════════════
   * 3. WORDING — PROVEN BY MECHANISM, NOT BY BANNED SUBSTRINGS
   *
   * The closing lines deliberately CONTAIN "bill" and "charge" in order to deny them
   * ("not a bill, not a charge"). A test that merely forbade those substrings would flag the
   * denial itself and force the honest sentence to be deleted — the same trap that once flagged
   * `automaticReplay: false` as a replay. So these assertions target the AFFIRMATIVE claim
   * shapes and money notation, neither of which a denial produces.
   * ═══════════════════════════════════════════════════════════════════════ */
  const AFFIRMATIVE_SPEND_CLAIMS = [
    /\byou spent\b/i,
    /\byour organization spent\b/i,
    /\btotal spend\b/i,
    /\bamount charged\b/i,
    /\bcost:/i,
  ];
  for (const claim of AFFIRMATIVE_SPEND_CLAIMS) {
    assert.ok(!claim.test(body), `usage output must not assert spend: ${claim}`);
  }
  for (const money of [/\$\s?\d/, /\bUSD\b/, /€\s?\d/, /₺\s?\d/]) {
    assert.ok(!money.test(body), `usage output carries no money notation: ${money}`);
  }
  /* Absence of a lie is not the same as truth — the honest framing must actually be present. */
  assert.ok(/RECORDED totals/.test(body), "the totals are explicitly labelled recorded");
  assert.ok(/lower bound/i.test(body), "the floor is stated out loud");
  assert.ok(/no pricing/i.test(body), "the absence of pricing is stated");
  assert.ok(/no budget/i.test(body), "the absence of a budget is stated");
  assert.ok(
    /no price, no currency, no budget/.test(result.result.provenance),
    "the provenance repeats what the numbers are not",
  );

  /* ═══════════════════════════════════════════════════════════════════════
   * 4. EMPTY STATE IS HONEST, NOT A ZEROED TOTAL
   * ═══════════════════════════════════════════════════════════════════════ */
  const emptyUsage: RecordedProviderUsage = {
    totals: emptyRecordedUsageTotals(),
    byProvider: [],
    byModel: [],
    byDay: [],
  };
  assert.ok(hasNoRecordedUsage(emptyUsage), "zero recorded calls is the empty state");
  assert.ok(!hasNoRecordedUsage(sampleUsage()), "recorded usage is not the empty state");

  const emptyResult = await runHebyReadCommand(
    { commandId: "usage", args: [], route: "/heby" },
    {
      resolveTenant: async () => TENANT,
      readUsage: async () => ({ status: "read", usage: emptyUsage }),
    },
  );
  assert.equal(emptyResult.status, "ok");
  if (emptyResult.status !== "ok") throw new Error("unreachable");
  const emptyBody = emptyResult.result.lines.join("\n");
  assert.ok(
    /no recorded provider usage/i.test(emptyBody),
    "an empty tenant is told nothing is recorded",
  );
  assert.ok(/real state, not a read failure/i.test(emptyBody), "empty is distinguished from broken");
  assert.ok(
    !/Recorded provider calls: 0/.test(emptyBody),
    "a row of zeroes is not presented as a measurement",
  );

  /* ═══════════════════════════════════════════════════════════════════════
   * 5. UNAVAILABLE IS HONEST, NEVER A ZERO
   * ═══════════════════════════════════════════════════════════════════════ */
  for (const reason of ["persistence-not-configured", "read-failed"] as const) {
    const unavailableResult = await runHebyReadCommand(
      { commandId: "usage", args: [], route: "/heby" },
      {
        resolveTenant: async () => TENANT,
        readUsage: async (): Promise<RecordedProviderUsageRead> => ({
          status: "unavailable",
          reason,
        }),
      },
    );
    assert.equal(unavailableResult.status, "ok");
    if (unavailableResult.status !== "ok") throw new Error("unreachable");
    assert.equal(unavailableResult.result.tone, "unavailable", `${reason} renders as unavailable`);
    assert.ok(
      unavailableResult.result.lines.join("\n").includes(reason),
      "the honest reason is surfaced rather than a fabricated total",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 6. NO TENANT → REFUSED BEFORE ANY READ (the R4B seam, not a second check)
   *
   * R4B refuses a suspended tenant at session resolution, so `resolveTenantContext` returns
   * null for suspended and unauthenticated callers alike. Reproducing that here is the whole
   * suspension contract for this surface: no company-state query belongs in a usage read.
   * ═══════════════════════════════════════════════════════════════════════ */
  let readAttempts = 0;
  const unauthorized = await runHebyReadCommand(
    { commandId: "usage", args: [], route: "/heby" },
    {
      resolveTenant: async () => null,
      readUsage: async () => {
        readAttempts += 1;
        return { status: "read", usage: sampleUsage() };
      },
    },
  );
  assert.deepEqual(unauthorized, { status: "unauthorized" });
  assert.equal(readAttempts, 0, "no usage was read for a caller with no tenant context");

  /* The seam itself refuses a null context rather than reading unscoped. */
  const { readRecordedProviderUsage } = await import(
    "../../src/features/heby-provider-ops/provider-usage-aggregation.server"
  );
  assert.deepEqual(
    await readRecordedProviderUsage(null, { getDb: () => null }),
    { status: "unavailable", reason: "no-authorized-tenant-context" },
    "the seam refuses before it even looks for a database",
  );

  /* ═══════════════════════════════════════════════════════════════════════
   * 7. THE PROVIDER-OFF GUARANTEE, PROVEN BY MECHANISM
   *
   * The usage path cannot consult the Director permission because the aggregation module has no
   * way to reach it: it imports no control, no projection and no transport. So the kill switch
   * cannot suppress a usage read, and no separate "works when off" flag is needed.
   * ═══════════════════════════════════════════════════════════════════════ */
  const PROVIDER_REACH = [
    "resolveClaudeDirectorEnabled",
    "resolveDirectorEnabled",
    "provider-connectivity-control",
    "selectModelTransport",
    "claude-http-transport",
    "resend-email-transport",
    "ClaudeTransport",
    "fetch(",
    "https://",
    "ANTHROPIC",
    "apiKey",
  ];
  for (const forbidden of PROVIDER_REACH) {
    assert.ok(
      !AGGREGATION_CODE.includes(forbidden),
      `the usage seam must not be able to reach ${forbidden}`,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 8. READ-ONLY, PROVEN BY MECHANISM
   * ═══════════════════════════════════════════════════════════════════════ */
  const WRITE_REACH = [
    ".insert(",
    ".update(",
    ".delete(",
    ".transaction(",
    "insert into",
    "delete from",
    "recordActionRequest",
    "consumeActionPermit",
    "executeAuthorizedAction",
    "auditLog",
    "audit_log",
    "revalidatePath",
  ];
  for (const forbidden of WRITE_REACH) {
    assert.ok(
      !AGGREGATION_CODE.includes(forbidden),
      `the usage seam is read-only and must not contain ${forbidden}`,
    );
  }
  assert.ok(AGGREGATION_CODE.includes("select"), "it does read");
  assert.ok(
    AGGREGATION_CODE.includes('"messages"."tenant_id" = '),
    "the tenant predicate is present in the statement itself",
  );

  /* ── THE G2 HEBY↔GOVERNANCE BOUNDARY ─────────────────────────────────────
   * `heby-provider-ops` is a Heby surface, so the G2 firewall forbids it from importing
   * Governance decision authority. This module first reached its database handle through
   * `governance-decision/bootstrap-authority`, purely because that module exposes a convenient
   * null-safe resolver — and the released G2 suite caught it. Asserted here too, so the seam
   * carries its own guard rather than relying on a distant suite to notice a re-import.        */
  const GOVERNANCE_REACH_PATHS = [
    "governance-decision",
    "bootstrap-authority",
    "decision-authority",
    "governance-audit",
  ];
  for (const forbidden of GOVERNANCE_REACH_PATHS) {
    assert.ok(
      !AGGREGATION_CODE.includes(forbidden),
      `a Heby surface must not reach Governance authority, even for a database handle: ${forbidden}`,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 9. NO BUDGET / PRICING / ENFORCEMENT LEAKED IN
   *
   * R2F.1 reports. Anything that would GOVERN spend is out of scope, and its absence is
   * asserted structurally rather than trusted. Comments are stripped first, so a header that
   * explains why pricing is absent does not itself read as pricing.
   * ═══════════════════════════════════════════════════════════════════════ */
  const GOVERNANCE_REACH = [
    "budgetLimit",
    "maxTokensAllowed",
    "quota",
    "pricePerToken",
    "costPerToken",
    "rateCard",
    "currency",
    "invoice",
    "subscription",
    "companies.plan",
  ];
  const R2F1_CODE = [AGGREGATION_CODE, codeOf(read(CONTRACTS_PATH)), CARD_CODE].join("\n");
  for (const forbidden of GOVERNANCE_REACH) {
    assert.ok(
      !R2F1_CODE.includes(forbidden),
      `R2F.1 reports and does not govern: ${forbidden} must not appear`,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 10. ONE COMPUTATION, TWO SURFACES
   *
   * `REAL_PROVIDER_TRANSPORT` is the predicate that decides what counts as provider usage. A
   * second implementation of the total would need it, so its appearing in exactly one non-test
   * source module (besides the contract that defines it) is the mechanism proving there is only
   * one computation. Both consumers are then asserted to go through the shared entry point.
   * ═══════════════════════════════════════════════════════════════════════ */
  const predicateUsers = SRC_FILES.filter(
    (f) => f !== CONTRACTS_PATH && codeOf(read(f)).includes("REAL_PROVIDER_TRANSPORT"),
  );
  assert.deepEqual(
    predicateUsers,
    [AGGREGATION_PATH],
    "exactly one module decides what counts as recorded provider usage",
  );

  const ENTRY = "readRecordedProviderUsage";
  assert.ok(codeOf(read(MATRIX_PAGE)).includes(ENTRY), "the provider matrix uses the shared seam");
  assert.ok(
    codeOf(read(READ_COMMANDS_PATH)).includes(ENTRY),
    "the /usage command defaults to the shared seam",
  );
  /* The card is presentation only — it receives a result and computes no total of its own. */
  for (const forbidden of [".reduce(", "sum(", "select ", "db.", "getDb"]) {
    assert.ok(!CARD_CODE.includes(forbidden), `the card renders and does not compute: ${forbidden}`);
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 11. NO SCHEMA CHANGE
   * ═══════════════════════════════════════════════════════════════════════ */
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) =>
    f.endsWith(".sql"),
  );
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: readonly { readonly tag: string }[];
  };
  assert.equal(
    migrations.length,
    journal.entries.length,
    "every migration file has a journal entry and vice versa",
  );
  /* Order matters: the journal must name the files, in the same sequence, with none invented. */
  assert.deepEqual(
    journal.entries.map((e) => `${e.tag}.sql`),
    [...migrations].sort(),
    "the journal names exactly the migration files on disk, in order",
  );
  assert.ok(
    !migrations.some((f) => /usage|budget|token|cost|price/i.test(f)),
    "R2F.1 added no migration — it reads columns that already existed",
  );

  /* The predicate constant is the stored vocabulary, asserted rather than assumed. */
  assert.equal(REAL_PROVIDER_TRANSPORT, "live");

  console.log("R2F.1 usage command surface + firewall: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
