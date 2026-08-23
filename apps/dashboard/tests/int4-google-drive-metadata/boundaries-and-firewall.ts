/*
 * INT-4 BOUNDARIES — what the Drive capability may touch, and what it may never become.
 *
 * INT-4 is Hebun's first provider DATA read. The risk is not that it fails; it is that it quietly
 * becomes something else — a content download, a write, a second Knowledge authority, a scheduler,
 * or a place a token is logged. Each of those is asserted against the real source below.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOnly = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const importsOf = (src: string): string[] => [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);

function collect(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((entry) => {
    const rel = `${dir}/${entry}`;
    return statSync(path.join(ROOT, rel)).isDirectory()
      ? collect(rel)
      : rel.endsWith(".ts") || rel.endsWith(".tsx")
        ? [rel]
        : [];
  });
}

const GOOGLE = "src/features/provider-google";
const SEAM = `${GOOGLE}/read-drive-metadata.server.ts`;
const RUNNER = `${GOOGLE}/google-authorized-call.server.ts`;
const TRANSPORT = `${GOOGLE}/google-transport.server.ts`;

function main(): void {
  /* ── 1. STILL EXACTLY ONE GOOGLE NETWORK SEAM ───────────────────────────── */
  {
    /*
     * The GLOBAL `fetch` identifier — not `deps.fetchImpl`, not `doFetch`. The first version of
     * this check used `\bfetch\(`, which matches neither `doFetch(` nor `?? fetch` and therefore
     * found NOTHING while looking like a passing firewall. A guard that cannot fail is not a guard.
     */
    const withFetch = collect("src").filter((f) => /(?<![\w.])fetch\b/.test(codeOnly(read(f))));
    assert.deepEqual(
      withFetch,
      [TRANSPORT],
      "INT-4 adds a Drive call and must NOT add a second place Hebun talks to Google",
    );
  }

  /* ── 2. NO CONTENT READ EXISTS, ANYWHERE ────────────────────────────────── */
  {
    /*
     * Three independent reasons INT-4 reads no file content: no download endpoint constant, no
     * `alt=media`, and a granted scope that could not perform one. The first two are asserted here;
     * the third is Google's and is asserted by the scope pin below.
     */
    for (const file of collect(GOOGLE)) {
      const code = codeOnly(read(file));
      for (const forbidden of ["alt=media", "webContentLink", "exportLinks", "downloadUrl", "/export"]) {
        assert.ok(!code.includes(forbidden), `${file} must not reach file content (${forbidden})`);
      }
    }
    assert.ok(
      !/drive\/v3\/files\/[^"']*\?alt/.test(read(`${GOOGLE}/contracts.ts`)),
      "no content endpoint constant exists to be written against",
    );
  }

  /* ── 3. NO WRITE, NO MUTATION, NO SHARING ───────────────────────────────── */
  {
    const transport = codeOnly(read(TRANSPORT));
    /* Every Drive call is a GET. A POST/PATCH/DELETE to Drive would be a mutation. */
    const driveCalls = [...transport.matchAll(/url\.toString\(\)[\s\S]{0,200}?method:\s*"(\w+)"/g)];
    for (const [, method] of driveCalls) {
      assert.equal(method, "GET", "every Drive call is a GET");
    }
    for (const file of collect(GOOGLE)) {
      const code = codeOnly(read(file));
      for (const forbidden of ["files.create", "files.update", "files.delete", "permissions.create", "drive.permissions"]) {
        assert.ok(!code.includes(forbidden), `${file} must not name a Drive mutation (${forbidden})`);
      }
    }
  }

  /* ── 4. THE DRIVE SEAM WRITES NO LIFECYCLE AND NO KNOWLEDGE ─────────────── */
  {
    const seam = read(SEAM);
    for (const target of importsOf(seam)) {
      assert.ok(
        !/knowledge/i.test(target),
        `the Drive seam must not reach Knowledge — INT-4 is a live read, not an ingestion (${target})`,
      );
      assert.ok(
        !/governance|action-execution|action-authorization/.test(target),
        `the Drive seam mints no permit and executes nothing (${target})`,
      );
    }
    const code = codeOnly(seam);
    /*
     * A DRIVE OUTAGE MAY NOT END A GRANT. The seam holds no lifecycle writer, so it cannot — this
     * asserts the mechanism rather than trusting the comment that says so.
     */
    for (const writer of [
      "recordVerificationFailureWithin",
      "recordVerifiedConnectionWithin",
      "disconnectConnection",
      "createConnection",
    ]) {
      assert.ok(!code.includes(writer), `the Drive seam must not write the connection lifecycle (${writer})`);
    }
  }

  /* ── 5. NO INGESTION, NO PERSISTENCE, NO SCHEDULER ──────────────────────── */
  {
    /*
     * INT-4 is Knowledge decision A — LIVE READ ONLY. `IngestionProvenance` identifies a source by
     * the SHA-256 of its normalized TEXT and types it as one of `plain-text | markdown | pdf`.
     * Drive metadata has no text to digest and is not a file format, so persisting it would mean
     * inventing an external-source identity model — a second authority. This asserts nobody did.
     */
    const provenance = read("src/features/knowledge/create-contracts.ts");
    assert.ok(
      /KNOWLEDGE_SOURCE_TYPES = \["plain-text", "markdown", "pdf"\]/.test(provenance),
      "the source-type vocabulary is unchanged — INT-4 added no provider source type",
    );
    assert.ok(
      !/drive|google/i.test(codeOnly(provenance)),
      "Knowledge provenance names no provider — INT-4 created no ingestion path",
    );
    /* No schema change, and specifically no external-source identity or sync column. */
    /*
     * COMMENTS STRIPPED, and not as a convenience. `integration.ts` DENIES a sync model in prose —
     * "NO sync cursor, last_sync_at or watermark" — so a raw word ban fails on the very sentence
     * that proves the point. This repository has now been bitten by that three times; check the
     * declarations, never the vocabulary.
     */
    const schema = collect("src/db/schema").map((f) => codeOnly(read(f))).join("\n");
    for (const invented of ["external_source", "provider_file", "drive_file", "sync_cursor", "last_sync"]) {
      assert.ok(!schema.includes(invented), `INT-4 invents no schema (${invented})`);
    }
    /* And no background job: a read a human asked for, never one Hebun runs on its own. */
    for (const file of collect(GOOGLE)) {
      const code = codeOnly(read(file));
      for (const forbidden of ["setInterval", "setTimeout(poll", "cron", "scheduler", "enqueue"]) {
        assert.ok(!code.includes(forbidden), `${file} starts no background work (${forbidden})`);
      }
    }
  }

  /* ── 6. NOTHING ON THE TOKEN PATH LOGS ──────────────────────────────────── */
  {
    for (const file of [SEAM, RUNNER, TRANSPORT]) {
      const code = codeOnly(read(file));
      for (const forbidden of ["console.", "logger.", "process.stdout", "process.stderr"]) {
        assert.ok(!code.includes(forbidden), `${file} must never log (${forbidden})`);
      }
    }
  }

  /* ── 7. THE PLAINTEXT TOKEN NEVER ESCAPES ITS SCOPE ─────────────────────── */
  {
    const runner = codeOnly(read(RUNNER));
    /* The token reaches the caller only as the argument of a callback inside `withDecryptedSecret`. */
    assert.ok(runner.includes("withDecryptedSecret"), "the credential is spent through INT-2's boundary");
    /* No return type mentions a token, so no caller can be handed one. */
    assert.ok(
      !/return\s+(accessToken|token|plaintext)\b/.test(runner),
      "the runner never returns a token",
    );
    /*
     * In the Drive seam the token may exist in exactly two places: the callback parameter, and the
     * argument position that hands it straight to the transport. Anything else — an assignment, a
     * return, an object property, a template string — is an escape from the scoped-secret lifetime.
     */
    const seam = codeOnly(read(SEAM));
    const mentions = [...seam.matchAll(/accessToken/g)].length;
    assert.equal(mentions, 2, "the token is named twice: received, and immediately spent");
    assert.ok(/async \(accessToken\) =>/.test(seam), "once as the callback parameter");
    assert.ok(/listDriveFiles\(accessToken,/.test(seam), "once as the argument it is passed to");
    for (const escape of [
      /=\s*accessToken/,
      /return\s+accessToken/,
      /accessToken\s*[,}]\s*$/m,
      /\$\{accessToken/,
      /accessToken\s*:/,
    ]) {
      assert.ok(!escape.test(seam), `the token must not escape its scope (${escape})`);
    }
  }

  /* ── 8. NO TENANT IS EVER ACCEPTED FROM OUTSIDE ─────────────────────────── */
  {
    const seam = read(SEAM);
    /*
     * The seam takes a resolved `TenantContext` and NO integration id — it discovers the source
     * from the tenant's own availability view. There is no parameter through which one tenant
     * could name another tenant's connection.
     */
    assert.ok(
      !/integrationId\s*[:?]\s*string/.test(seam.slice(seam.indexOf("export async function readDriveMetadata"))),
      "readDriveMetadata accepts no integration id — the source is discovered, not supplied",
    );
    for (const forbidden of ["searchParams.get(\"tenant", "req.tenant", "body.tenantId", "hostedDomain"]) {
      assert.ok(!seam.includes(forbidden), `tenant identity is never taken from input (${forbidden})`);
    }
  }

  /* ── 9. THE AUTHORIZATION ROUTE TAKES A CAPABILITY, NEVER A SCOPE ───────── */
  {
    const start = read("src/app/api/integrations/google/start/route.ts");
    const code = codeOnly(start);
    assert.ok(code.includes("extraScopesForCapability"), "scopes are resolved through the frozen map");
    assert.ok(
      !/searchParams\.get\(\s*"scope/.test(code),
      "the route must never take a scope from the request",
    );
    const reads = [...code.matchAll(/searchParams\.get\(\s*"([^"]+)"/g)].map((m) => m[1]!);
    assert.deepEqual(reads, ["capability"], "exactly one request parameter is honoured");
    /* Incremental authorization stays off, so the request always names everything it needs. */
    assert.ok(/include_granted_scopes/.test(start) && /"false"/.test(start));
  }

  /* ── 10. THE UI CANNOT INFER A CAPABILITY ───────────────────────────────── */
  {
    const model = read("src/features/platform-integrations/model.ts");
    for (const target of importsOf(model)) {
      assert.ok(!/integration-credentials/.test(target), `the surface model sees no credential (${target})`);
      assert.ok(!/\.server(\b|"|\/)/.test(target), `the surface model performs no I/O (${target})`);
    }
    /*
     * The capability list is built from the AVAILABILITY view, never from the catalog definition.
     * Reading `capabilityScopes` here would tell every connected tenant they have Drive access
     * because the provider defines Drive access.
     */
    assert.ok(
      !codeOnly(model).includes("capabilityScopes"),
      "the surface never derives a capability from the provider definition",
    );
  }

  /* ── 11. THE REFRESH WRITE INTENT IS REACHABLE FROM EXACTLY ONE FILE ────── */
  {
    /*
     * ── WHY THIS IS A FUNCTION AND NOT A FLAG, ASSERTED ────────────────────
     *
     * `replaceCredentialFromProviderRefresh` preserves the connection lifecycle, which is right for
     * a provider-derived token and wrong for anything a human supplied. A `preserveConnectionState`
     * boolean would be reachable from every existing caller and this census would be impossible to
     * write. A distinct export can be enumerated — so it is.
     */
    const REFRESH_INTENT = "replaceCredentialFromProviderRefresh";
    const callers = collect("src")
      .filter((f) => f !== "src/features/integration-credentials/credential-repository.server.ts")
      .filter((f) => codeOnly(read(f)).includes(REFRESH_INTENT));
    assert.deepEqual(
      callers,
      [RUNNER],
      "only the Google authorized-call runner may write a credential without demoting the connection",
    );

    /*
     * AND THE ORDINARY RULE IS STILL THE DEFAULT. Every other credential write in the repository
     * goes through `replaceCredential` or `storeCredential`, both of which still demote.
     */
    const credentials = read("src/features/integration-credentials/credential-repository.server.ts");
    const code = codeOnly(credentials);
    assert.ok(
      code.includes("attachCredentialToConnectionWithin"),
      "the demoting writer is still used for supplied secrets",
    );
    assert.ok(
      code.includes("holdConnectionForProviderRefreshWithin"),
      "and the preserving hold is used for provider-derived ones",
    );

    /* NO LOOSE FLAG anywhere: the intent may not be re-expressible as an argument. */
    for (const flag of ["preserveConnectionState", "skipDemotion", "keepConnected", "isRefresh"]) {
      assert.ok(!code.includes(flag), `the intent must not become a boolean (${flag})`);
    }
  }

  /* ── 12. THE PRESERVING HOLD CANNOT WRITE A LIFECYCLE ───────────────────── */
  {
    /*
     * The strongest form of "it preserves the connection state" is a function with no way to change
     * it. This reads the real function body and asserts it contains no update statement at all —
     * not that it updates carefully.
     */
    const repository = read("src/features/integration-authority/integration-repository.server.ts");
    const at = repository.indexOf("export async function holdConnectionForProviderRefreshWithin");
    assert.ok(at > 0, "the hold exists");
    const body = codeOnly(repository.slice(at, repository.indexOf("\n}", at)));
    for (const writer of ["tx.update(", ".set({", "connectionState:", "health:", "lastVerifiedAt:"]) {
      assert.ok(!body.includes(writer), `the hold must not write the connection (${writer})`);
    }
    /* It still LOCKS — the concurrency guarantee the demoting path had is not given up. */
    assert.ok(body.includes('.for("update")'), "it still locks the row under the tenant predicate");
    /* And it still refuses the two states a refresh cannot legitimately act on. */
    assert.ok(body.includes("isTerminalConnectionState"), "terminal stays terminal");
    assert.ok(body.includes('from === "draft"'), "a refresh cannot precede its own credential");
  }

  console.log("int4-google-drive-metadata/boundaries-and-firewall: all assertions passed");
}

main();
