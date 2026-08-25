/*
 * INT-5B1 — AUTHORIZATION, FAILURE SEMANTICS AND THE READ BUDGET.
 *
 * ── THE THREE SENTENCES THIS SUITE DEFENDS ───────────────────────────────────
 *
 *   UNAVAILABLE      IS NOT   EMPTY
 *   PROVIDER_FAILED  IS NOT   EMPTY
 *   PARTIAL          IS NOT   COMPLETE
 *
 * Every path that did not obtain a page must be distinguishable, by an operator, from a page that
 * genuinely contained nothing. A provider that did not answer has not said there is nothing there,
 * and a bounded page is not a total.
 *
 * The provider seam is injected, so this runs with no network, no key and no database. What is NOT
 * injected is the tenant: it is resolved through the same server-side seam the real action uses.
 */
import assert from "node:assert/strict";

import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import {
  GITHUB_PROVIDER_READ_BUDGET,
  runHebyProviderReadCommand,
  type HebyProviderReadCommandResult,
} from "../../src/features/heby-commands/provider-read-commands.server";
import { MAX_REPOSITORIES_PER_PAGE } from "../../src/features/provider-github/contracts";

const TENANT: TenantContext = {
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
  requestId: "req-1",
  authenticatedAt: "2026-08-25T00:00:00.000Z",
};

function repository(id: number, fullName: string) {
  return Object.freeze({
    repositoryId: id,
    fullName,
    isPrivate: false,
    isArchived: false,
    defaultBranch: "main",
    updatedAt: "2026-08-24T00:00:00.000Z",
  });
}

/** Run `/repositories` with an injected provider outcome. */
async function run(
  outcome: unknown,
  options: { readonly tenant?: TenantContext | null; readonly totalTimeoutMs?: number } = {},
): Promise<HebyProviderReadCommandResult> {
  return runHebyProviderReadCommand(
    { commandId: "repositories", args: [] },
    {
      resolveTenant: async () => (options.tenant === undefined ? TENANT : options.tenant),
      discover: (async () => outcome) as never,
      totalTimeoutMs: options.totalTimeoutMs,
    },
  );
}

function lines(result: HebyProviderReadCommandResult): string {
  assert.equal(result.status, "ok");
  if (result.status !== "ok") throw new Error("unreachable");
  return result.result.lines.join("\n");
}

function tone(result: HebyProviderReadCommandResult): string {
  assert.equal(result.status, "ok");
  if (result.status !== "ok") throw new Error("unreachable");
  return result.result.tone;
}

/**
 * The sentence an operator must never be told when Hebun did not get an answer.
 *
 * Asserted as an ABSENCE of an emptiness claim rather than as the presence of a phrase, because a
 * refusal that merely omitted the word "empty" while rendering an empty list would still be the
 * defect. Both halves are checked: nothing may claim emptiness, and the honest disclaimer must be
 * there to say so.
 */
function assertNotReportedAsEmpty(result: HebyProviderReadCommandResult, label: string): void {
  assert.equal(tone(result), "unavailable", `${label}: must never render in an informational tone`);
  if (result.status !== "ok") throw new Error("unreachable");
  const all = `${result.result.lines.join(" ")} ${result.result.provenance}`;
  assert.ok(
    !/\bno repositories\b/i.test(result.result.lines.join(" ")),
    `${label}: must not claim the organization has no repositories`,
  );
  assert.match(
    all,
    /not an empty result|NOTHING IS KNOWN|this is not an empty list/i,
    `${label}: must state that this is not an empty result`,
  );
}

async function main(): Promise<void> {
  /* ── 1. NO TENANT — NOTHING IS CONSULTED ─────────────────────────────────── */
  {
    const result = await run({ ok: true, value: { repositories: [], totalReportedByProvider: 0, truncated: false } }, { tenant: null });
    assert.equal(result.status, "unauthorized", "an unauthenticated caller gets no provider read");
  }

  /* ── 2. THE COMMAND ID IS A LOOKUP KEY INTO A CLOSED SET ─────────────────── */
  {
    const unknown = await runHebyProviderReadCommand(
      { commandId: "not-a-command", args: [] },
      { resolveTenant: async () => TENANT, discover: (async () => { throw new Error("must not run"); }) as never },
    );
    assert.deepEqual(unknown, { status: "rejected", reason: "unknown-command" });

    /*
     * AND A COMMAND OF ANOTHER KIND CANNOT BORROW THIS EXECUTOR. `/status` is a real, available
     * command — it is refused here because it is not a provider-read command, which is the gate
     * that keeps external reach a property of the registry rather than of this module.
     */
    const wrongKind = await runHebyProviderReadCommand(
      { commandId: "status", args: [] },
      { resolveTenant: async () => TENANT, discover: (async () => { throw new Error("must not run"); }) as never },
    );
    assert.deepEqual(wrongKind, { status: "rejected", reason: "not-a-provider-read-command" });
  }

  /* ── 3. EVERY REFUSAL IS DISTINCT, AND NONE OF THEM IS AN EMPTY LIST ─────── */
  {
    const refusals = [
      "no-authorized-tenant-context",
      "connection-authority-unavailable",
      "capability-not-available",
      "no-github-connection",
      "installation-identity-unavailable",
      "github-app-not-configured",
    ] as const;

    const rendered = new Set<string>();
    for (const refusal of refusals) {
      const result = await run({ ok: false, refusal });
      assertNotReportedAsEmpty(result, refusal);
      const text = lines(result);
      assert.ok(!rendered.has(text), `${refusal}: must not render identically to another refusal`);
      rendered.add(text);
    }

    /*
     * THE ONE THAT IS NOT A FAULT AT ALL. "The capability is not available" covers three different
     * situations a person fixes in three different ways, so it must say that rather than collapse
     * them into a single dead end.
     */
    const capability = lines(await run({ ok: false, refusal: "capability-not-available" }));
    assert.match(capability, /three different situations/i, "it separates the three causes");
    assert.match(capability, /Integrations workspace/, "and sends the operator where the fix is");
  }

  /* ── 4. EVERY PROVIDER FAULT IS DISTINCT, AND NONE OF THEM IS EMPTY ──────── */
  {
    const failures = ["auth", "installation", "permission", "identity", "transport", "malformed"] as const;
    const rendered = new Set<string>();
    for (const failure of failures) {
      const result = await run({ ok: false, failure, reason: `github-${failure}` });
      assertNotReportedAsEmpty(result, failure);
      const text = lines(result);
      assert.ok(!rendered.has(text), `${failure}: must not render identically to another fault`);
      rendered.add(text);
    }

    /*
     * 429 AND 5xx ARE `transport`, AND THE LINE SAYS WHAT THAT MEANS. A rate limit tells Hebun
     * nothing about the installation, so reporting it as a lost connection — or as an empty list —
     * would be two different lies.
     */
    const transport = lines(await run({ ok: false, failure: "transport", reason: "github-rate-limited" }));
    assert.match(transport, /rate limit/i, "a rate limit is named as a possible cause");
    assert.match(transport, /NOTHING IS KNOWN/, "and nothing is concluded about the installation");
    assert.match(transport, /left untouched|Nothing was retried/, "and no connection was changed");

    /* `auth` is Hebun's OWN credential, never the tenant's. Saying otherwise misdirects a person. */
    const auth = lines(await run({ ok: false, failure: "auth", reason: "github-refused" }));
    assert.match(auth, /Hebun's own/, "an auth fault implicates Hebun's credential");
    assert.match(auth, /Nothing about your organization/i, "and explicitly not the tenant's installation");
  }

  /* ── 5. A TOTAL-BUDGET TIMEOUT IS A TIMEOUT, NOT AN EMPTY PAGE ───────────── */
  {
    const never = new Promise<never>(() => {});
    const result = await runHebyProviderReadCommand(
      { commandId: "repositories", args: [] },
      {
        resolveTenant: async () => TENANT,
        discover: (() => never) as never,
        totalTimeoutMs: 25,
      },
    );
    assertNotReportedAsEmpty(result, "total-timeout");
    assert.match(lines(result), /stopped waiting/i, "it says Hebun stopped waiting");
    assert.match(lines(result), /25 ms/, "and states the ceiling it stopped at");
  }

  /* ── 6. AN EMPTY PAGE IS A REAL ANSWER, AND ONLY WHEN GITHUB SAID SO ─────── */
  {
    const result = await run({
      ok: true,
      value: { repositories: [], totalReportedByProvider: 0, truncated: false },
    });
    assert.equal(tone(result), "info", "GitHub answering with nothing IS an answer");
    const text = lines(result);
    assert.match(text, /GitHub answered/, "and the line says GitHub answered");
    assert.match(text, /not a failed read/i, "and distinguishes itself from a failure");
  }

  /* ── 7. PARTIAL IS NOT COMPLETE ──────────────────────────────────────────── */
  {
    const truncated = await run({
      ok: true,
      value: {
        repositories: [repository(1300480452, "Hebun-AI/hebun")],
        totalReportedByProvider: 12,
        truncated: true,
      },
    });
    const text = lines(truncated);
    assert.match(text, /PARTIAL, NOT COMPLETE/, "a truncated page says so in terms nobody misreads");
    assert.match(text, /12 in total/, "and states the provider's own count");

    /* A provider that reported NO total cannot be presented as complete either. */
    const unknownTotal = await run({
      ok: true,
      value: {
        repositories: [repository(7, "Hebun-AI/one")],
        totalReportedByProvider: null,
        truncated: false,
      },
    });
    assert.match(
      lines(unknownTotal),
      /cannot tell you whether this page is all of them/i,
      "silence about a total must never read as completeness",
    );

    /* And a complete page may say so, because that is also the truth. */
    const complete = await run({
      ok: true,
      value: {
        repositories: [repository(7, "Hebun-AI/one")],
        totalReportedByProvider: 1,
        truncated: false,
      },
    });
    assert.match(lines(complete), /which this page covers/, "a complete page states its own completeness");
  }

  /* ── 8. THE RECORD CEILING IS ENFORCED HERE, NOT MERELY DECLARED ─────────── */
  {
    assert.equal(
      GITHUB_PROVIDER_READ_BUDGET.maxRecords,
      MAX_REPOSITORIES_PER_PAGE,
      "the command ceiling matches the released page bound",
    );
    assert.equal(GITHUB_PROVIDER_READ_BUDGET.maxProviders, 1);
    assert.equal(GITHUB_PROVIDER_READ_BUDGET.maxPages, 1);
    assert.equal(GITHUB_PROVIDER_READ_BUDGET.maxProviderCalls, 2);
    assert.equal(GITHUB_PROVIDER_READ_BUDGET.concurrency, 1);
    assert.equal(GITHUB_PROVIDER_READ_BUDGET.providerTimeoutMs, 10_000);
    assert.equal(GITHUB_PROVIDER_READ_BUDGET.totalTimeoutMs, 20_000);
    assert.ok(
      GITHUB_PROVIDER_READ_BUDGET.totalTimeoutMs <= 20_000,
      "the whole command is bounded at twenty seconds or less",
    );

    /*
     * A SEAM THAT OVER-DELIVERS IS STILL BOUNDED. The released reader bounds its own page; this
     * proves the COMMAND bounds it too, so the promise does not depend on a constant two features
     * away staying what it is today.
     */
    const overLarge = Array.from({ length: 120 }, (_, i) => repository(i + 1, `Hebun-AI/repo-${i + 1}`));
    const result = await run({
      ok: true,
      value: { repositories: overLarge, totalReportedByProvider: 120, truncated: true },
    });
    if (result.status !== "ok") throw new Error("unreachable");
    const rendered = result.result.lines.filter((line) => line.startsWith("[integrations/"));
    assert.equal(
      rendered.length,
      GITHUB_PROVIDER_READ_BUDGET.maxRecords,
      "no more rows than the budget allows may reach a surface",
    );
    assert.match(lines(result), /PARTIAL, NOT COMPLETE/, "and the truncation is still stated");
  }

  /* ── 9. THE TENANT REACHING THE PROVIDER SEAM IS THE SERVER-RESOLVED ONE ── */
  {
    let seen: TenantContext | null | undefined;
    let seenDeps: { readonly timeoutMs?: number } | undefined;
    await runHebyProviderReadCommand(
      { commandId: "repositories", args: [] },
      {
        resolveTenant: async () => TENANT,
        discover: (async (tenant: TenantContext | null, deps: { readonly timeoutMs?: number }) => {
          seen = tenant;
          seenDeps = deps;
          return { ok: true, value: { repositories: [], totalReportedByProvider: 0, truncated: false } };
        }) as never,
      },
    );
    assert.equal(seen, TENANT, "the seam receives the tenant the server resolved, unchanged");
    assert.equal(
      seenDeps?.timeoutMs,
      GITHUB_PROVIDER_READ_BUDGET.providerTimeoutMs,
      "and the per-call timeout ceiling is passed explicitly, never left to a default",
    );
  }

  console.log("int5b1-flow/authorization-and-failure: OK");
}

void main();
