/*
 * D1.1 — the provisioning tool is operator tooling, not a product capability.
 *
 * THE INVARIANT. A tool that writes credentials must be unreachable from anything
 * a browser can talk to. If `src/` could import it, "provision a credential" would
 * be one route handler away from being an authentication bypass — which is exactly
 * what D1 removed. It lives under `scripts/` and nothing in the application tree
 * may reach it.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/*
 * Strip comments before asserting on content (repo convention, see g1-flow).
 * These modules DOCUMENT what they must never touch, so a prose mention of
 * `user_session_contexts` is the tool promising not to use it — the opposite of a
 * violation. Only real code is policed.
 */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

function collect(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return collect(rel);
    return e.isFile() && /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

const CLI = "scripts/auth-dev-credential.ts";
const CORE = "scripts/lib/provision-dev-credential.ts";

function main(): void {
  /* ── Nothing in the application tree may import the provisioning tool ─────── */
  {
    const offenders = collect("src").filter((file) => {
      const src = readFileSync(path.join(ROOT, file), "utf8");
      return /scripts\/(lib\/)?(auth-dev-credential|provision-dev-credential)|provision-dev-credential/.test(
        src,
      );
    });
    assert.deepEqual(
      offenders,
      [],
      "no product module may import development credential provisioning",
    );

    // And more broadly: `src/` must not reach into `scripts/` at all.
    for (const file of collect("src")) {
      const src = readFileSync(path.join(ROOT, file), "utf8");
      assert.doesNotMatch(
        src,
        /from\s+["'][^"']*\/scripts\//,
        `${file}: the application tree must not import operator tooling`,
      );
    }
  }

  /* ── The tool writes credentials and nothing else ─────────────────────────── */
  {
    const both = `${codeOf(read(CORE))}\n${codeOf(read(CLI))}`;

    for (const forbidden of [
      "user_session_contexts",
      "issueLocalSession",
      "setSessionCookie",
      "generateSessionReference",
      "insert into memberships",
      "insert into roles",
      "insert into users",
      "update memberships",
      "update roles",
    ]) {
      assert.ok(
        !both.includes(forbidden),
        `provisioning must never touch ${forbidden} — it provisions, it does not authenticate or authorize`,
      );
    }

    // It only ever writes the credential table.
    const insertTargets = [...both.matchAll(/insert\s+into\s+(\w+)/gi)].map((m) =>
      m[1]!.toLowerCase(),
    );
    assert.deepEqual(
      [...new Set(insertTargets)],
      ["auth_credentials"],
      "auth_credentials is the only table provisioning inserts into",
    );
  }

  /* ── Hashing is the production one, not a local reimplementation ──────────── */
  {
    const core = codeOf(read(CORE));
    assert.match(
      core,
      /from\s+"\.\.\/\.\.\/src\/features\/auth-runtime\/password-hash\.server"/,
      "provisioning uses the production hasher the login path verifies with",
    );
    assert.doesNotMatch(
      core,
      /scryptSync|createHash|randomBytes/,
      "provisioning does not reimplement any hashing of its own",
    );
  }

  /* ── No durable password configuration may exist ──────────────────────────── */
  {
    const cli = codeOf(read(CLI));
    // Ban READING a password from the environment. A length constant named
    // MIN_DEV_PASSWORD_LENGTH is not a password source, so the check targets the
    // env access itself rather than any identifier containing the word.
    assert.doesNotMatch(
      cli,
      /process\.env\.[A-Za-z_]*PASSWORD|process\.env\[["'][^"']*PASSWORD/i,
      "a password must never come from the environment — that is how it gets committed",
    );
    assert.doesNotMatch(
      cli,
      /process\.argv\[3\]/,
      "a password must never come from argv — that is how it reaches shell history",
    );
    assert.match(cli, /isTTY/, "the password is read interactively");
    assert.match(cli, /_writeToOutput/, "…and its echo is suppressed");

    // No password may be written anywhere.
    for (const file of [CLI, CORE]) {
      const src = codeOf(read(file));
      assert.doesNotMatch(
        src,
        /writeFileSync|appendFileSync|console\.log\([^)]*password/i,
        `${file}: the password is never persisted or printed`,
      );
    }
    // Nor may a fixture password be baked into the tool.
    assert.doesNotMatch(
      `${codeOf(read(CLI))}\n${codeOf(read(CORE))}`,
      /password\s*=\s*["'][^"']{6,}["']/,
      "no password literal is embedded in the tool",
    );
  }

  /* ── Development-only, and it says so structurally ────────────────────────── */
  {
    const cli = codeOf(read(CLI));
    assert.match(
      cli,
      /NODE_ENV === "production"/,
      "the tool refuses to run in production",
    );
    assert.match(codeOf(read(CORE)), /non-local database/, "…and refuses a remote database");
  }

  /* ── It is not collected as a test and not reachable as a route ───────────── */
  {
    // The test runner walks `tests/`; the tool lives under `scripts/`, so it can
    // never be executed as part of the suite.
    assert.ok(!CLI.startsWith("tests/"), "the CLI is not inside the test tree");
    const appFiles = collect("src/app");
    for (const file of appFiles) {
      const src = codeOf(readFileSync(path.join(ROOT, file), "utf8"));
      assert.doesNotMatch(
        src,
        /provisionDevCredential|auth-dev-credential/,
        `${file}: no route or action may expose provisioning`,
      );
    }
  }

  console.log("D1.1 provisioning boundary: passed");
}

main();
