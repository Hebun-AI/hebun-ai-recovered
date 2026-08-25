/*
 * INT-5B1 — EVIDENCE IDENTITY, PROVENANCE AND SECRET CONTAINMENT.
 *
 * ── WHAT IS AT STAKE ─────────────────────────────────────────────────────────
 *
 * A provider-derived line is the first thing Heby has ever shown an operator that came from OUTSIDE
 * Hebun. Three things must therefore be true of it, and none of them may rest on prose:
 *
 *   1. its identity is the PROVIDER'S immutable one, never a name that can be reassigned;
 *   2. it says, in its own provenance, that it is an observation and not organizational truth;
 *   3. nothing spendable — a token, a key, an Authorization header — can travel with it.
 *
 * No network, no key, no database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import {
  GITHUB_REPOSITORY_READ_PROVENANCE,
  githubRepositoryRecordRef,
  runHebyProviderReadCommand,
} from "../../src/features/heby-commands/provider-read-commands.server";
import {
  GITHUB_PROVIDER_KEY,
  GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
} from "../../src/features/provider-github/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const MODULE = "src/features/heby-commands/provider-read-commands.server.ts";
const ACTION = "src/app/(dashboard)/heby/actions.ts";

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

async function renderWith(repositories: readonly unknown[]): Promise<string[]> {
  const result = await runHebyProviderReadCommand(
    { commandId: "repositories", args: [] },
    {
      resolveTenant: async () => TENANT,
      discover: (async () => ({
        ok: true,
        value: { repositories, totalReportedByProvider: repositories.length, truncated: false },
      })) as never,
    },
  );
  assert.equal(result.status, "ok");
  if (result.status !== "ok") throw new Error("unreachable");
  return [...result.result.lines, result.result.provenance];
}

async function main(): Promise<void> {
  /* ── 1. THE IDENTITY IS JOINED FROM KEYS ALREADY OWNED ELSEWHERE ─────────── */
  {
    const ref = githubRepositoryRecordRef(1300480452);
    assert.equal(
      ref,
      `integrations/${GITHUB_PROVIDER_KEY}/${GITHUB_REPOSITORY_ACTIVITY_CAPABILITY}/repository/1300480452`,
    );
    /*
     * COMPOSED, NOT COPIED. Asserting against the released constants rather than a literal means a
     * provider key or capability key that changed would move this identity with it, instead of
     * leaving a hard-coded string behind that quietly stopped matching the catalog.
     */
    assert.ok(ref.includes(GITHUB_PROVIDER_KEY), "the provider key is the catalog's");
    assert.ok(ref.includes(GITHUB_REPOSITORY_ACTIVITY_CAPABILITY), "the capability key is the provider module's");
    assert.notEqual(GITHUB_PROVIDER_KEY, "", "the catalog key is not empty");

    /* Distinct repositories get distinct references. */
    assert.notEqual(githubRepositoryRecordRef(1), githubRepositoryRecordRef(2));

    /*
     * THE MODULE MINTS NO IDENTIFIER OF ITS OWN. No uuid, no hash, no counter — an identity Hebun
     * invented for a record it does not own would be a second, competing name for somebody else's
     * thing.
     */
    const code = codeOf(read(MODULE));
    for (const minted of ["randomUUID", "createHash", "crypto", "Date.now("]) {
      assert.ok(!code.includes(minted), `${MODULE} must not mint an identity with "${minted}"`);
    }
  }

  /* ── 2. THE IDENTITY IS NEVER THE NAME ───────────────────────────────────── */
  {
    const renamed = [
      { repositoryId: 42, fullName: "Hebun-AI/before-rename", isPrivate: true, isArchived: false, defaultBranch: "main", updatedAt: null },
    ];
    const first = await renderWith(renamed);
    const after = await renderWith([{ ...renamed[0]!, fullName: "Hebun-AI/after-rename" }]);

    const refLine = (all: string[]) => all.find((l) => l.startsWith("[integrations/"))!;
    const refOf = (l: string) => l.slice(1, l.indexOf("]"));
    assert.equal(
      refOf(refLine(first)),
      refOf(refLine(after)),
      "a rename must not change the record's identity — the number is the identity, the name is not",
    );
    assert.match(refLine(after), /Hebun-AI\/after-rename/, "the name is still shown, as display text");
    assert.ok(
      !refOf(refLine(after)).includes("after-rename"),
      "and the name is nowhere inside the identity",
    );
  }

  /* ── 3. THE PROVENANCE STATES WHAT THIS IS AND IS NOT ────────────────────── */
  {
    for (const clause of [
      /authoritative: false/,
      /Provider-derived observation/i,
      /not organizational truth/i,
      /nothing[\s\S]*was stored/i,
      /re-reads it/i,
    ]) {
      assert.match(GITHUB_REPOSITORY_READ_PROVENANCE, clause, "the provenance must state its own standing");
    }
    /* It never claims to be Knowledge, settled, endorsed, or reviewed. */
    for (const overclaim of [/\bauthoritative: true\b/, /\bKnowledge\b/, /\bsettled\b/i, /\bendorsed\b/i]) {
      assert.doesNotMatch(GITHUB_REPOSITORY_READ_PROVENANCE, overclaim, "the provenance must not overclaim");
    }
  }

  /* ── 4. THE RESULT CARRIES NO CONTENT, WHATEVER THE PROVIDER SENT ───────── */
  {
    /*
     * FIELD BY FIELD, NEVER THE PROVIDER'S OBJECT. The renderer builds each line from named fields,
     * so a payload carrying extra properties — including ones shaped like secrets — contributes
     * nothing. This is the behavioural half of the structural refusal in the released view.
     */
    const hostile = [
      {
        repositoryId: 99,
        fullName: "Hebun-AI/ordinary",
        isPrivate: false,
        isArchived: false,
        defaultBranch: "main",
        updatedAt: null,
        installationToken: "ghs_LEAKED_INSTALLATION_TOKEN",
        authorization: "Bearer ghs_LEAKED",
        privateKey: "-----BEGIN RSA PRIVATE KEY-----",
        patch: "@@ -1 +1 @@",
        diff: "diff --git a/x b/x",
        body: "pull request body text",
        cloneUrl: "https://x:y@github.com/Hebun-AI/ordinary.git",
      },
    ];
    const rendered = (await renderWith(hostile)).join("\n");
    for (const leak of [
      "ghs_LEAKED_INSTALLATION_TOKEN",
      "Bearer",
      "BEGIN RSA PRIVATE KEY",
      "@@ -1 +1 @@",
      "diff --git",
      "pull request body text",
      "x:y@github.com",
    ]) {
      assert.ok(!rendered.includes(leak), `a provider payload must not carry "${leak}" onto a surface`);
    }
    assert.match(rendered, /Hebun-AI\/ordinary/, "while the fields the view declares are still shown");
    assert.match(rendered, /no file, no source line, no commit content/i, "and the result says what it excludes");
  }

  /* ── 5. NO SECRET VOCABULARY ANYWHERE ON THE PROVIDER-READ BOUNDARY ──────── */
  {
    for (const file of [MODULE, ACTION]) {
      const src = read(file);
      for (const secret of [
        "ANTHROPIC_API_KEY",
        "GITHUB_APP_PRIVATE_KEY",
        "HEBUN_INTEGRATION_ENCRYPTION_KEYS",
        "GOOGLE_OAUTH_CLIENT_SECRET",
        "withDecryptedSecret",
        "decryptCredential",
        "mintInstallationAccessToken",
        "mintGitHubAppJwt",
        "installationToken",
        "process.env",
        "apiKey",
      ]) {
        assert.ok(!src.includes(secret), `${file} must not name "${secret}"`);
      }
      assert.doesNotMatch(src, /gh[psu]_[A-Za-z0-9]{10,}/, `${file} contains no GitHub-token-shaped literal`);
      assert.doesNotMatch(src, /sk-[a-z0-9-]{6,}/i, `${file} contains no key-shaped literal`);
    }
  }

  /* ── 6. THE CLIENT SUPPLIES NOTHING WITH AUTHORITY ───────────────────────── */
  {
    const action = read(ACTION);
    const body = action.slice(action.indexOf("export async function runHebyProviderReadCommandAction"));
    assert.match(
      body,
      /\{ commandId: input\.commandId, args: input\.args \}/,
      "the action forwards exactly the command id and its arguments, and nothing else",
    );
    assert.match(
      body,
      /resolveTenant: resolveTenantContext/,
      "and the tenant comes from the server session seam",
    );
    for (const smuggled of ["tenantId", "integrationId", "installationId", "providerKey", "accountId", "repositoryId"]) {
      assert.ok(
        !body.includes(smuggled),
        `the provider-read action must not accept "${smuggled}" from a client`,
      );
    }
  }

  console.log("int5b1-flow/evidence-and-security: OK");
}

void main();
