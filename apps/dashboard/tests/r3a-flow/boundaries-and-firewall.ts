/*
 * R3A — structural boundaries around Durable Authorization to Act.
 *
 * These prove claims about what does NOT exist: no execution, no provider call, no browser, no
 * shell, no device, no agent dispatch, no secret, no second Governance resolver, and no change to
 * the Heby action registry's substrate flags. Runtime behaviour lives in `authorization-postgres.ts`
 * and `single-spend-concurrency.ts`.
 *
 * THE EXECUTION FIREWALL IS THE POINT. R3A's success condition is AUTHORIZED BUT NOT EXECUTED, and
 * a phase that authorizes consequential acts is exactly the phase where "just wire it up while
 * you're here" would be most tempting and most damaging. So the absence is asserted, not trusted.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  ACTION_APPROVAL_DECISION_TYPE,
  ACTION_AUTHORIZATION_DOMAIN,
  ACTION_PERMIT_NON_EFFECTS,
  ACTION_PERMIT_SUBJECT_TYPE,
  ACTION_REJECTION_DECISION_TYPE,
  ACTION_REQUEST_SUBJECT_TYPE,
  ACTION_REVOCATION_DECISION_TYPE,
  AUTHORIZABLE_SIDE_EFFECTS,
  EXECUTION_SUBSTRATE_GAP,
  PERMIT_DEFAULT_TTL_SECONDS,
  PERMIT_MAX_TTL_SECONDS,
  PERMIT_MIN_TTL_SECONDS,
} from "../../src/features/action-authorization/contracts";
import {
  digestCanonicalAction,
  digestsMatch,
  serializeCanonicalAction,
  asCanonicalPayload,
} from "../../src/features/action-authorization/canonical-payload";
import { listActionTools } from "../../src/features/heby-actions/action-registry";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/** Source with comments stripped: assertions are about CODE, not about what prose discusses. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function collect(dir: string, ext = /\.tsx?$/): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return collect(rel, ext);
    return ext.test(e.name) ? [rel] : [];
  });
}

const R3A_FILES = [
  ...collect("src/features/action-authorization"),
  "src/features/governance-audit/action-authorization-audit.server.ts",
];

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE EXECUTION FIREWALL — R3A authorizes and does not act.
 * ═════════════════════════════════════════════════════════════════════════ */

const FORBIDDEN_EXECUTION_TOKENS: readonly [RegExp, string][] = [
  [/\bfetch\s*\(/, "an outbound HTTP call"],
  [/\baxios\b/, "an HTTP client"],
  [/node:child_process|child_process/, "a shell"],
  [/\bexecFile|\bspawn\(|\bexecSync/, "process execution"],
  [/node:fs\b|from "fs"/, "filesystem access"],
  [/puppeteer|playwright|webdriver/, "a browser driver"],
  [/nodemailer|sendgrid|smtp/i, "an email transport"],
  [/anthropic|openai|claude-http|model-transport/i, "a model provider"],
  [/device-runtime|computer-use|computerUse/i, "device or Computer Use runtime"],
  [/execution-engine|execution-dispatcher|live-dispatch|command-dispatcher/, "an execution dispatcher"],
  [/agent-runtime|dispatchAgent|agentSession/, "agent dispatch"],
];

for (const file of R3A_FILES) {
  const code = codeOf(read(file));
  for (const [pattern, what] of FORBIDDEN_EXECUTION_TOKENS) {
    assert.ok(
      !pattern.test(code),
      `${file} must not reach ${what} — R3A authorizes, it does not execute`,
    );
  }
}

/* The one crypto import R3A makes is a digest and a UUID. Nothing else from node. */
{
  const imports = R3A_FILES.flatMap((f) =>
    [...codeOf(read(f)).matchAll(/from\s+"(node:[^"]+)"/g)].map((m) => m[1]!),
  );
  const allowed = new Set(["node:crypto"]);
  for (const mod of imports) {
    assert.ok(allowed.has(mod), `R3A may not import ${mod}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE HEBY ACTION REGISTRY IS UNCHANGED — no substrate was quietly connected.
 * ═════════════════════════════════════════════════════════════════════════ */

for (const tool of listActionTools()) {
  if (tool.sideEffect === "READ_ONLY" || tool.sideEffect === "PREPARATION_ONLY") continue;
  assert.equal(
    tool.substrateConnected,
    false,
    `${tool.toolId} must remain substrate-disconnected — R3A authorizes, R3B connects`,
  );
}

/*
 * R3A must not be ABLE to flip the flag.
 *
 * The rule is import-shaped rather than mention-shaped: `contracts.ts` names `substrateConnected`
 * inside `EXECUTION_SUBSTRATE_GAP.observation`, which is the honest statement of what is missing
 * and exactly the thing this phase is required to say out loud. Forbidding the word would punish
 * the disclosure. What actually matters is that no R3A module imports the registry it would have
 * to mutate, and that no writer names the flag at all.
 */
for (const file of R3A_FILES) {
  assert.ok(
    !codeOf(read(file)).includes("heby-actions/action-registry"),
    `${file} must not import the action registry it would have to mutate`,
  );
  if (file.endsWith(".server.ts")) {
    assert.ok(
      !codeOf(read(file)).includes("substrateConnected"),
      `${file} is a writer and must not touch substrateConnected`,
    );
  }
}

/* Computer Use stays out of the authorizable set, in code and in the database. */
assert.ok(
  !AUTHORIZABLE_SIDE_EFFECTS.includes("DEVICE_ACTION"),
  "a device action must never be authorizable through R3A",
);
assert.ok(
  !AUTHORIZABLE_SIDE_EFFECTS.includes("READ_ONLY"),
  "reading must never require a permit",
);
assert.ok(
  read("src/db/schema/action-authorization.ts").includes(
    "heby_action_requests_no_device_action_chk",
  ),
  "the device-action refusal must also be a database fact",
);

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. NO SECOND GOVERNANCE AUTHORITY.
 * ═════════════════════════════════════════════════════════════════════════ */

{
  const writers = R3A_FILES.filter((f) => f.endsWith(".server.ts")).filter((f) =>
    /approveActionRequest|rejectActionRequest|revokeActionPermit/.test(read(f)),
  );
  assert.ok(writers.length > 0, "the decision writers must exist");
  for (const file of writers) {
    const code = codeOf(read(file));
    assert.ok(
      code.includes("resolveGovernanceAuthority"),
      `${file} must ask the ONE Governance resolver`,
    );
    /* No role-band, permission, or membership-scope shortcut may stand in for authority. */
    for (const shortcut of ["roleType", "role_permissions", "authorityScope", "permissions"]) {
      assert.ok(
        !code.includes(shortcut),
        `${file} must not re-invent authority from ${shortcut}`,
      );
    }
    /* A Director Twin prediction is never an input to a decision. */
    assert.ok(
      !/twin|predict/i.test(code),
      `${file} must not consult a prediction — twin prediction is not approval`,
    );
  }
}

/* The permit table cannot exist without a decision: both columns are NOT NULL. */
{
  const schema = read("src/db/schema/action-authorization.ts");
  assert.match(
    schema,
    /governanceDecisionId:[\s\S]{0,200}?\.notNull\(\)/,
    "a permit must structurally require a Governance decision",
  );
  assert.ok(
    schema.includes("action_permits_human_authorizer_chk"),
    "human supremacy must be a database CHECK",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. NO SECRETS, EVER.
 * ═════════════════════════════════════════════════════════════════════════ */

for (const file of R3A_FILES) {
  const code = codeOf(read(file));
  for (const token of ["password", "apiKey", "accessToken", "bearer", "credential", "secret"]) {
    assert.ok(
      !new RegExp(`\\b${token}\\b`, "i").test(code),
      `${file} must not name ${token} — a permit carries no credential`,
    );
  }
}

/* A payload is scalars only, so a nested credential cannot be smuggled through it. */
assert.equal(asCanonicalPayload({ a: { nested: true } }), null, "objects are not payload values");
assert.equal(asCanonicalPayload({ a: [1, 2] }), null, "arrays are not payload values");
assert.equal(asCanonicalPayload([1, 2]), null, "a payload is not an array");
assert.equal(asCanonicalPayload({ a: Number.NaN }), null, "NaN has no stable serialization");
assert.deepEqual(asCanonicalPayload({ b: 1, a: "x", c: false }), { b: 1, a: "x", c: false });

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE DIGEST BINDS WHAT WAS APPROVED.
 * ═════════════════════════════════════════════════════════════════════════ */

const base = {
  actionKind: "send-external-communication",
  toolId: "heby.operations.send-communication",
  targetKind: "record" as string | null,
  targetRef: "contact-1" as string | null,
  payload: { channel: "email", subject: "Hello", urgent: false } as Record<
    string,
    string | number | boolean
  >,
};

/* Deterministic, and independent of key insertion order. */
assert.equal(
  digestCanonicalAction(base),
  digestCanonicalAction({
    ...base,
    payload: { urgent: false, subject: "Hello", channel: "email" },
  }),
  "key order must not change the digest",
);
assert.match(digestCanonicalAction(base), /^[0-9a-f]{64}$/);

/* Every field that matters changes it. */
const variants: readonly [string, typeof base][] = [
  ["a changed argument", { ...base, payload: { ...base.payload, subject: "Goodbye" } }],
  ["a changed target", { ...base, targetRef: "contact-2" }],
  ["a dropped target", { ...base, targetKind: null, targetRef: null }],
  ["a changed tool", { ...base, toolId: "heby.decisions.grant-permission" }],
  ["a changed kind", { ...base, actionKind: "grant-permission" }],
  ["an added argument", { ...base, payload: { ...base.payload, cc: "boss@acme.test" } }],
];
for (const [what, variant] of variants) {
  assert.notEqual(
    digestCanonicalAction(variant),
    digestCanonicalAction(base),
    `${what} must produce a different digest`,
  );
}

/* Types are part of the value: "1" and 1 are not the same approval. */
assert.notEqual(
  digestCanonicalAction({ ...base, payload: { n: 1 } }),
  digestCanonicalAction({ ...base, payload: { n: "1" } }),
  "a string must not collide with a number",
);
assert.notEqual(
  digestCanonicalAction({ ...base, payload: { b: true } }),
  digestCanonicalAction({ ...base, payload: { b: "true" } }),
  "a boolean must not collide with its string form",
);

/*
 * THE CONCATENATION ATTACK. Two different payloads must not serialize to one string by shuffling
 * where the separators fall — the classic canonicalization bug.
 */
assert.notEqual(
  serializeCanonicalAction({ ...base, payload: { a: "1", b: "2" } }),
  serializeCanonicalAction({ ...base, payload: { "a\"s:1\"b": "2" } }),
  "separators must not be forgeable from inside a key",
);

/* Non-finite numbers are refused rather than silently serialized. */
assert.throws(
  () => digestCanonicalAction({ ...base, payload: { n: Number.POSITIVE_INFINITY } }),
  /finite/,
  "an unrepresentable number must not become an approval",
);

/* Digest comparison is total and length-checked. */
assert.equal(digestsMatch("a".repeat(64), "a".repeat(64)), true);
assert.equal(digestsMatch("a".repeat(64), "b".repeat(64)), false);
assert.equal(digestsMatch("abc", "abc"), false, "a non-digest never matches");
assert.equal(digestsMatch(null, undefined), false);

/* R3A must NOT reuse Heby's FNV identity as the binding. */
for (const file of R3A_FILES) {
  assert.ok(!/fnv/i.test(codeOf(read(file))), `${file} must not bind an approval to a 32-bit hash`);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. VOCABULARY AND BOUNDS.
 * ═════════════════════════════════════════════════════════════════════════ */

assert.equal(ACTION_AUTHORIZATION_DOMAIN, "action-authorization");
assert.equal(ACTION_APPROVAL_DECISION_TYPE, "approve");
assert.equal(ACTION_REJECTION_DECISION_TYPE, "reject");
assert.equal(ACTION_REVOCATION_DECISION_TYPE, "revoke");
assert.notEqual(
  ACTION_REQUEST_SUBJECT_TYPE,
  ACTION_PERMIT_SUBJECT_TYPE,
  "approving an action and revoking its permit must be distinguishable in the ledger",
);

assert.equal(PERMIT_MAX_TTL_SECONDS, 86_400, "the permit ceiling is one day");
assert.ok(PERMIT_DEFAULT_TTL_SECONDS <= PERMIT_MAX_TTL_SECONDS);
assert.ok(PERMIT_MIN_TTL_SECONDS > 0 && PERMIT_MIN_TTL_SECONDS < PERMIT_DEFAULT_TTL_SECONDS);
/*
 * The ceiling must be a database fact, not only a TypeScript constant. Asserted against the
 * GENERATED SQL rather than the drizzle template, because the template writes the bound through
 * `sql` interpolation and the literal only becomes real in the migration.
 */
{
  const migration = readdirSync(path.join(ROOT, "src/db/migrations")).find((f) =>
    f.includes("r3a_action_authorization"),
  );
  assert.ok(migration, "the R3A migration must exist");
  const sql = read(path.join("src/db/migrations", migration!));
  assert.ok(
    sql.includes(`<= ${PERMIT_MAX_TTL_SECONDS}`),
    "the TTL ceiling must be enforced by PostgreSQL, not only by the server",
  );
}

/*
 * There is no stored `expired` state — expiry is derived, because nothing sweeps.
 *
 * Asserted against the GENERATED SQL rather than the drizzle source: the migration is what
 * PostgreSQL actually accepts, and a test that parsed the TypeScript would pass even if the two
 * had drifted apart.
 */
{
  const migration = readdirSync(path.join(ROOT, "src/db/migrations")).find((f) =>
    f.includes("r3a_action_authorization"),
  );
  const sql = read(path.join("src/db/migrations", migration!));
  const permitEnum =
    /CREATE TYPE "public"\."action_permit_status" AS ENUM\([^)]*\)/.exec(sql)?.[0] ?? "";
  assert.ok(permitEnum.includes("'active'"), "the permit enum must exist in the migration");
  assert.ok(
    !permitEnum.includes("expired"),
    "a stored `expired` state would be a status with no writer",
  );
  assert.ok(!permitEnum.includes("pending"), "a pending permit would collapse approval and permit");

  const requestEnum =
    /CREATE TYPE "public"\."heby_action_request_status" AS ENUM\([^)]*\)/.exec(sql)?.[0] ?? "";
  assert.ok(requestEnum.includes("'pending'"), "a request must be able to be pending");
  assert.ok(requestEnum.includes("'approved'") && requestEnum.includes("'rejected'"));
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE HONEST GAP IS STATED, NOT HIDDEN.
 * ═════════════════════════════════════════════════════════════════════════ */

assert.equal(EXECUTION_SUBSTRATE_GAP.authorizationPresent, true);
assert.equal(EXECUTION_SUBSTRATE_GAP.executionPresent, false);
assert.match(EXECUTION_SUBSTRATE_GAP.owner, /R3B/);
for (const claim of ["does not execute the action", "does not enable Computer Use"]) {
  assert.ok(
    ACTION_PERMIT_NON_EFFECTS.includes(claim),
    `the non-effects must state: ${claim}`,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. MIGRATION SCOPE — additive, and only the two authorized tables.
 * ═════════════════════════════════════════════════════════════════════════ */

{
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) =>
    f.endsWith(".sql"),
  );
  const mine = migrations.filter((f) => f.includes("r3a_action_authorization"));
  assert.equal(mine.length, 1, "R3A adds exactly one migration");
  const sql = read(path.join("src/db/migrations", mine[0]!));

  for (const forbidden of [
    "DROP TABLE",
    "DROP COLUMN",
    "CREATE EXTENSION",
    "pgvector",
    "pg_trgm",
    "unaccent",
    "tsvector",
    "USING gin",
    "USING gist",
  ]) {
    assert.ok(!sql.includes(forbidden), `the R3A migration must not contain ${forbidden}`);
  }

  const created = [...sql.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1]!);
  assert.deepEqual(
    created.sort(),
    ["action_permits", "heby_action_requests"],
    "R3A creates exactly two tables",
  );

  /* No existing table is altered except to add the new tables' own constraints. */
  const altered = new Set(
    [...sql.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1]!),
  );
  assert.deepEqual(
    [...altered].sort(),
    ["action_permits", "heby_action_requests"],
    "R3A must not alter an existing table",
  );

  /* The composite FK must come AFTER the unique index it depends on. */
  const idx = sql.indexOf('CREATE UNIQUE INDEX "heby_action_requests_tenant_id_uq"');
  const fk = sql.indexOf('"action_permits_tenant_request_fk"');
  assert.ok(idx > -1 && fk > -1, "both statements must exist");
  assert.ok(idx < fk, "the unique index must precede the foreign key that requires it");
}

console.log("PASS r3a boundaries and firewall");
