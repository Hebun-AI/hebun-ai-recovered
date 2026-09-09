/*
 * TRH-23 — THE FIREWALL. What the Standing Observation Authority and its ephemeral principal CANNOT
 * reach, proved against real source rather than asserted in prose.
 *
 * Source is read with comments STRIPPED wherever a rule could otherwise be satisfied — or tripped —
 * by prose. Every module in this phase discusses the very things it forbids.
 *
 * The rules are grouped by the sentence each one defends:
 *
 *   1. APPEND-ONLY IS STRUCTURAL — no update, delete or upsert path exists anywhere in `src/`.
 *   2. ONE WRITER — exactly one module inserts an authorization, and it is Governance-anchored.
 *   3. THE PRINCIPAL IS EPHEMERAL — no table, no session, no membership, no user, no credential.
 *   4. THE PRINCIPAL REACHES NOTHING — proved by the real value-import closure.
 *   5. THE SEAMS THAT WERE NARROWED ARE ENUMERATED — and the credential OPENER was not one of them.
 *   6. NO SCHEDULER, NO INGRESS, NO COLLECTION.
 *   7. THE HUMAN FIREWALL IS UNMOVED.
 *   8. THE LEDGER MOVED BY EXACTLY ONE, ADDITIVELY.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const AUTHORITY = "src/features/standing-observation-authority";
const WRITER = `${AUTHORITY}/authorize-standing-observation.server.ts`;
const READER = `${AUTHORITY}/read-standing-observations.server.ts`;
const PRINCIPAL = `${AUTHORITY}/observation-principal.server.ts`;
const REVALIDATOR = `${AUTHORITY}/revalidate-standing-observation.server.ts`;
const CONTRACTS = `${AUTHORITY}/contracts.ts`;
const SCHEMA = "src/db/schema/standing-observation-authorization.ts";
const AUDIT = "src/features/governance-audit/standing-observation-audit.server.ts";
const TENANT_CONTEXT = "src/features/auth/tenant/tenant-context.ts";

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

const SRC = walk("src");

/**
 * The real VALUE-import closure of a module — `import type` is excluded, because a type import
 * cannot call anything, and `export … from` is followed, because a barrel is a path.
 */
function valueImportClosure(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    let body: string;
    try {
      body = codeOf(read(current));
    } catch {
      continue;
    }
    const specifiers = [
      ...body.matchAll(/(?:^|\n)\s*import\s+(?!type\s)([\s\S]*?)from\s+"([^"]+)"/g),
      ...body.matchAll(/(?:^|\n)\s*export\s+(?!type\s)([\s\S]*?)from\s+"([^"]+)"/g),
    ];
    for (const match of specifiers) {
      const clause = match[1] ?? "";
      const spec = match[2]!;
      /* `import { type X }` alone still imports no value. */
      if (/^\s*\{\s*(type\s+[^,}]+\s*,?\s*)+\}\s*$/.test(clause)) continue;
      const resolved = resolve(current, spec);
      if (resolved) queue.push(resolved);
    }
  }
  seen.delete(entry);
  return seen;
}

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? `src/${spec.slice(2)}`
    : spec.startsWith(".")
      ? path.posix.normalize(`${path.posix.dirname(from)}/${spec}`)
      : null;
  if (!base) return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    try {
      readFileSync(path.join(ROOT, candidate), "utf8");
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

function main(): void {
  /* ═══════════════════════════════════════════════════════════════════════════
   * 1. APPEND-ONLY IS STRUCTURAL, NOT A POLICY SOMEBODY REMEMBERS.
   *
   * The Director's requirement was that `UPDATE … SET capability_key = <broader>` must not be an
   * ordinary lifecycle operation. This is the stronger version: it is not an operation at all.
   * ═══════════════════════════════════════════════════════════════════════ */
  /*
   * THE CENSUS GREW BY ONE AT TRH-24, AND THE NEW ENTRY IS A TABLE DEFINITION, NOT A WRITER.
   *
   * `db/schema/provider-observation.ts` names this table because a machine-sourced observation
   * carries a COMPOSITE foreign key to it — `(standing_authorization_id, tenant_id)` — which is what
   * stops an observation being filed under another tenant's authorization. A schema-to-schema
   * reference performs no query and can insert nothing; the mutation bans below still apply to every
   * non-definition entry, so this stays exact rather than being loosened.
   */
  const OBSERVATION_TABLE = "src/db/schema/provider-observation.ts";
  const touchesTable = SRC.filter((f) => /standingObservationAuthorizations/.test(codeOf(read(f))));
  assert.deepEqual(
    touchesTable.sort(),
    [SCHEMA, OBSERVATION_TABLE, WRITER, READER, PRINCIPAL].sort(),
    "exactly five modules name the authorization table: its definition, the observation table's " +
      "composite key, its one writer, its reader, and the minter that reads one row",
  );

  for (const f of touchesTable) {
    if (f === SCHEMA || f === OBSERVATION_TABLE) continue;
    const code = codeOf(read(f));
    for (const forbidden of [".update(", ".delete(", "onConflictDoUpdate", "onConflictDoNothing"]) {
      assert.ok(
        !code.includes(forbidden),
        `${f} contains no \`${forbidden}\` — a standing authorization is never edited, only superseded`,
      );
    }
  }

  /* The predecessor is not stamped either: the schema carries no column through which it could be. */
  const schemaCode = codeOf(read(SCHEMA));
  for (const forbidden of [
    "revokedAt",
    "supersededAt",
    "expiresAt",
    "isCurrent",
    "consumedAt",
    "lastRunAt",
    "nextRunAt",
    "cron",
    "timezone",
    "principalId",
    "serviceAccountId",
  ]) {
    assert.ok(
      !schemaCode.includes(forbidden),
      `the table carries no \`${forbidden}\` — that fact belongs to a phase that does not exist`,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 2. ONE WRITER, AND IT IS GOVERNANCE-ANCHORED.
   * ═══════════════════════════════════════════════════════════════════════ */
  const inserters = SRC.filter((f) =>
    /\.insert\(standingObservationAuthorizations\)/.test(codeOf(read(f))),
  );
  assert.deepEqual(inserters, [WRITER], "exactly one module inserts an authorization revision");

  const writerCode = codeOf(read(WRITER));
  assert.ok(
    /resolveGovernanceAuthority\(/.test(writerCode),
    "the writer resolves Governance authority through the ONE released resolver",
  );
  assert.ok(
    /writeGovernanceDecisionWithin\(/.test(writerCode),
    "and writes the decision that authorizes the revision",
  );
  assert.ok(
    /db\.transaction\(/.test(writerCode),
    "in one transaction — decision, revision and audit commit together or not at all",
  );
  assert.ok(
    !/tenantId:\s*input/.test(writerCode) && !/input\.tenantId/.test(writerCode),
    "no caller-supplied tenant reaches the row — the tenant is the authorized context's, always",
  );
  /*
   * STATED POSITIVELY ON PURPOSE. A negative lookahead here reads well and proves nothing: `\s*`
   * backtracks to zero width and the lookahead then succeeds against the space, so the rule passes
   * on source that says exactly what it forbids. Enumerating every occurrence cannot do that.
   */
  const authorizerStamps = writerCode.match(/authorizedByActorType:\s*[^,\n]+/g) ?? [];
  assert.ok(authorizerStamps.length > 0, "the writer stamps an authorizer at all");
  for (const stamp of authorizerStamps) {
    assert.equal(
      stamp.replace(/\s+/g, " "),
      'authorizedByActorType: "human"',
      "the authorizer is the literal `human` and is never taken from input",
    );
  }

  /*
   * THE ROLE BANDS ARE NOT CONSULTED. Governance authority is the bootstrap decision, never a role,
   * a permission row or a membership scope — the same rule AMA-1 and I1 keep.
   */
  for (const forbidden of ["roles.", "rolePermissions", "permissionSummary", "roleType"]) {
    assert.ok(
      !writerCode.includes(forbidden),
      `the writer consults no \`${forbidden}\` — authority is the bootstrap decision, nothing else`,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 3. THE PRINCIPAL IS EPHEMERAL, AND THE BRAND IS UNREACHABLE.
   * ═══════════════════════════════════════════════════════════════════════ */
  const principalCode = codeOf(read(PRINCIPAL));
  assert.ok(
    /const OBSERVATION_PRINCIPAL_BRAND: unique symbol = Symbol\(/.test(principalCode),
    "the brand is a RUNTIME symbol, so a type cast cannot forge a principal",
  );
  assert.ok(
    !/export\s+(declare\s+)?const OBSERVATION_PRINCIPAL_BRAND/.test(principalCode),
    "and it is never exported, so no other module can write the key into a literal",
  );

  const minters = SRC.filter((f) =>
    /export async function mintObservationPrincipal\b/.test(read(f)),
  );
  assert.deepEqual(minters, [PRINCIPAL], "exactly one module mints an observation principal");

  /* NO PERSISTENCE OF THE PRINCIPAL, ANYWHERE. */
  for (const f of SRC) {
    const code = codeOf(read(f));
    assert.ok(
      !/observation_principals|observationPrincipals|service_accounts|serviceAccounts/.test(code),
      `${f} introduces no durable machine-principal storage`,
    );
  }
  for (const forbidden of [".insert(", ".update(", ".delete(", "auditLog", "users", "memberships"]) {
    assert.ok(
      !principalCode.includes(forbidden),
      `the minter contains no \`${forbidden}\` — minting writes nothing and creates no identity`,
    );
  }

  /*
   * THE PRINCIPAL HAS NO TENANT PARAMETER. This is the whole tenant trust chain in one assertion: a
   * caller that could name a tenant could choose one.
   */
  assert.ok(
    /export async function mintObservationPrincipal\(\s*authorizationId: string,/.test(read(PRINCIPAL)),
    "the minter's only scope argument is the authorization's own id — the tenant comes from the row",
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * 4. THE PRINCIPAL REACHES NOTHING, PROVED BY THE REAL IMPORT CLOSURE.
   *
   * A sentence saying "it cannot call Governance" is worth nothing. This walks what the minter and
   * the pre-transport revalidator actually pull in, following barrels, and requires that none of the
   * authority-bearing writers is among them.
   * ═══════════════════════════════════════════════════════════════════════ */
  const FORBIDDEN_REACH: readonly (readonly [string, RegExp])[] = [
    ["a Governance decision writer", /governance-decision\/(decision-authority|bootstrap-authority|authority-delegation)/],
    ["a permit or action-authorization writer", /action-authorization\/(record-action-request|issue-action-permit|authorize)/],
    ["the action execution runtime", /action-execution(-live)?\//],
    ["a Knowledge admission or write seam", /knowledge\/(knowledge-write-authority|admission)/],
    ["a Work writer", /work-artifacts\/write-|organizational-work\/(record|write)/],
    ["an agent mandate writer", /agent-mandate\/establish-/],
    ["a credential writer or opener", /credential-repository\.server/],
    ["provider transport", /provider-youtube\/(youtube-transport|youtube-api-key-call|read-channel-observation)/],
    ["the provider observation writer", /provider-observation-history\/(write-|record-)/],
    ["the human session runtime", /auth-runtime\//],
  ];

  for (const entry of [PRINCIPAL, REVALIDATOR, CONTRACTS]) {
    const closure = [...valueImportClosure(entry)];
    for (const [label, pattern] of FORBIDDEN_REACH) {
      /*
       * ONE DELIBERATE EXCEPTION, AND IT IS NARROWER THAN IT LOOKS. The revalidator imports
       * `credential-repository.server` for `listCredentialMetadata` ALONE — kinds, liveness and
       * timestamps, never ciphertext. The named-import check below is what makes that exception a
       * measurement rather than a hole.
       */
      if (entry === REVALIDATOR && label === "a credential writer or opener") continue;
      const reached = closure.filter((f) => pattern.test(f));
      assert.deepEqual(
        reached,
        [],
        `${entry} cannot reach ${label} — found ${reached.join(", ")}`,
      );
    }
  }

  /*
   * THE CREDENTIAL EXCEPTION, MEASURED. The revalidator may name exactly one symbol from the
   * credential authority, and `withDecryptedSecret` is not it.
   */
  const revalidatorCode = codeOf(read(REVALIDATOR));
  const credentialImport = revalidatorCode.match(
    /import\s*\{([^}]*)\}\s*from\s*"@\/features\/integration-credentials\/credential-repository\.server"/,
  );
  assert.ok(credentialImport, "the revalidator's credential import is a named import");
  assert.deepEqual(
    credentialImport![1]!.split(",").map((s) => s.trim()).filter(Boolean),
    ["listCredentialMetadata"],
    "and it names ONLY the metadata reader — no secret is opened on this path",
  );
  for (const forbidden of [
    "withDecryptedSecret",
    "storeCredential",
    "replaceCredential",
    "revokeCredential",
    "destroyCredential",
  ]) {
    assert.ok(
      !revalidatorCode.includes(forbidden),
      `the revalidator never names \`${forbidden}\``,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 5. THE SEAMS THIS PHASE NARROWED ARE ENUMERATED — AND THE OPENER IS NOT ONE.
   *
   * An exact census. Narrowing a fourth seam without saying so fails here, which is the point: the
   * blast radius of "a machine may now ask this" must never grow quietly.
   * ═══════════════════════════════════════════════════════════════════════ */
  const NARROWED: readonly (readonly [string, string])[] = [
    ["src/features/integration-authority/capability-availability.server.ts", "getCapabilityAvailability"],
    ["src/features/integration-authority/integration-read.server.ts", "listConnections"],
    ["src/features/integration-credentials/credential-repository.server.ts", "listCredentialMetadata"],
  ];
  for (const [file, fn] of NARROWED) {
    const code = read(file);
    const signature = new RegExp(
      `${fn}\\(\\s*\\n?\\s*tenant: Pick<TenantContext, "tenantId"> \\| null,`,
    );
    assert.ok(signature.test(code), `${fn} accepts a bare tenant scope, deliberately`);
  }

  /*
   * THE CREDENTIAL OPENER STILL REQUIRES A HUMAN. This is the single most important line in this
   * file: if `withDecryptedSecret` were ever narrowed, an observation principal could decrypt a
   * tenant's provider secret, and every other rule here would still pass.
   */
  const credentialCode = read("src/features/integration-credentials/credential-repository.server.ts");
  assert.ok(
    /export async function withDecryptedSecret<T>\(\s*\n?\s*tenant: TenantContext \| null,/.test(
      credentialCode,
    ),
    "`withDecryptedSecret` still takes the BRANDED HUMAN context — a machine cannot open a secret",
  );
  for (const writer of [
    "storeCredential",
    "replaceCredential",
    "replaceCredentialFromProviderRefresh",
    "revokeCredential",
    "destroyCredential",
  ]) {
    const narrowed = new RegExp(`${writer}\\(\\s*\\n?\\s*tenant: Pick<TenantContext`);
    assert.ok(!narrowed.test(credentialCode), `${writer} was NOT narrowed — it attributes a human`);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 6. NO SCHEDULER, NO INGRESS, NO COLLECTION.
   * ═══════════════════════════════════════════════════════════════════════ */
  const routes = walk("src/app").filter((f) => /\/route\.tsx?$/.test(f));
  assert.deepEqual(
    routes.sort(),
    [
      "src/app/api/integrations/github/setup/route.ts",
      "src/app/api/integrations/github/start/route.ts",
      "src/app/api/integrations/google/callback/route.ts",
      "src/app/api/integrations/google/start/route.ts",
      /* The Instagram OAuth ceremony — the third provider pair, added by this phase. */
      "src/app/api/integrations/instagram/callback/route.ts",
      "src/app/api/integrations/instagram/start/route.ts",
      "src/app/api/observation/scan/route.ts",
    ],
    /*
     * THE CENSUS GREW BY ONE, AND THE ONE IS NAMED (TRH-25). Four OAuth browser-redirect handlers,
     * plus the machine ingress the automatic trigger knocks on. It is enumerated here rather than
     * pattern-matched so a SECOND machine route cannot appear without this line failing.
     *
     * TRH-23's property is untouched and still exactly true OF TRH-23: that phase added no ingress,
     * and the principal it minted stayed unreachable from every surface. What changed is a later
     * phase, which had to add a door and had to come here to say so.
     */
    "one machine ingress beside the four OAuth handlers, and no other route",
  );

  const phaseFiles = [WRITER, READER, PRINCIPAL, REVALIDATOR, CONTRACTS, SCHEMA, AUDIT];
  for (const f of phaseFiles) {
    const code = codeOf(read(f));
    for (const forbidden of [
      "setInterval",
      "setTimeout",
      "node-cron",
      "node:worker_threads",
      "BullMQ",
      "Queue(",
      "fetch(",
    ]) {
      assert.ok(!code.includes(forbidden), `${f} contains no \`${forbidden}\` — nothing here runs or calls out`);
    }
  }

  /*
   * THE SCHEDULE, PINNED BY VALUE (TRH-25). Until the trigger phase this asserted that
   * `vercel.json` DID NOT EXIST — a cheap way to say "nothing runs on its own", and it worked: it
   * failed on the run that introduced the schedule. It cannot express the property now that a
   * schedule is a deliberate decision, so it is replaced by a NARROWER one: exactly ONE cron
   * exists, it points at the machine ingress, and it runs hourly. A second entry, a different
   * path, or a different cadence fails here.
   *
   * `src/app/api/cron` still must not exist: the ingress lives at its own named path, and a second
   * conventional cron directory would be a second door.
   */
  {
    let cronDir = true;
    try {
      readFileSync(path.join(ROOT, "src/app/api/cron"), "utf8");
    } catch {
      cronDir = false;
    }
    assert.equal(cronDir, false, "src/app/api/cron does not exist — there is one ingress, not two");

    const vercelConfig = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8")) as {
      readonly crons?: readonly { readonly path: string; readonly schedule: string }[];
    };
    assert.deepEqual(
      vercelConfig.crons,
      [{ path: "/api/observation/scan", schedule: "0 * * * *" }],
      "exactly one schedule exists: hourly, aimed at the machine ingress, and nothing else",
    );
    assert.deepEqual(
      Object.keys(vercelConfig).sort(),
      ["$schema", "crons"],
      "and the deployment config carries NOTHING but that schedule",
    );
  }

  /* THE MINTER IS UNREACHABLE FROM THE PRODUCT SURFACE. */
  const surface = walk("src/app").concat(walk("src/components"));
  for (const f of surface) {
    const code = codeOf(read(f));
    assert.ok(
      !/mintObservationPrincipal|standing-observation-authority/.test(code),
      `${f} does not reach the standing observation authority — this phase adds NO product surface`,
    );
  }

  /* AUDIT SAYS, ON EVERY ROW, THAT NOTHING WAS COLLECTED. */
  const auditCode = codeOf(read(AUDIT));
  assert.ok(
    /readonly collected: false;/.test(auditCode),
    "the audit metadata type admits only `collected: false`",
  );
  assert.ok(
    !/collected:\s*true/.test(codeOf(read(WRITER))),
    "and no writer can set it otherwise",
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * 7. THE HUMAN FIREWALL IS UNMOVED.
   * ═══════════════════════════════════════════════════════════════════════ */
  const contextCode = codeOf(read(TENANT_CONTEXT));
  assert.ok(
    /declare const humanTenantContextBrand: unique symbol;/.test(contextCode) &&
      !/export\s+(declare\s+)?const humanTenantContextBrand/.test(contextCode),
    "PRINCIPAL-FW-1's nominal marker is unchanged and still unexported",
  );
  assert.ok(
    !/actorType/.test(contextCode),
    "`TenantContext` still gained no actorType — it was NOT widened into a human/machine union",
  );
  assert.ok(
    !/ObservationPrincipal/.test(contextCode),
    "and it knows nothing about the machine principal — the two types are unrelated by design",
  );

  const mintSites = SRC.filter((f) => /export function asHumanTenantContext\b/.test(read(f)));
  assert.deepEqual(mintSites, [TENANT_CONTEXT], "the human context still has exactly one mint site");
  const humanMinters = SRC.filter((f) => /\basHumanTenantContext\s*\(/.test(codeOf(read(f))));
  assert.deepEqual(
    humanMinters.sort(),
    [TENANT_CONTEXT, "src/features/auth-runtime/session-service.server.ts"].sort(),
    "and the human session runtime is still its only caller — this phase mints no human context",
  );
  assert.ok(
    !codeOf(read(PRINCIPAL)).includes("asHumanTenantContext") &&
      !codeOf(read(REVALIDATOR)).includes("asHumanTenantContext"),
    "the machine principal cannot construct a human tenant context",
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * 8. THE LEDGER MOVED BY EXACTLY ONE, ADDITIVELY.
   * ═══════════════════════════════════════════════════════════════════════ */
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  assert.equal(migrations.length, 52, "50 -> 51: TRH-23 authored exactly one migration"); /* TRH-24 51 -> 52 (`provider_observations` gains machine provenance: the human actor pair becomes nullable, `standing_authorization_id` and `invocation_id` arrive, and a CHECK admits exactly one provenance mode — schema EVOLUTION, not purely additive DDL). */
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: readonly { readonly tag: string }[];
  };
  assert.equal(journal.entries.length, 52, "and the journal agrees with the files"); /* TRH-24 51 -> 52 (`provider_observations` gains machine provenance: the human actor pair becomes nullable, `standing_authorization_id` and `invocation_id` arrive, and a CHECK admits exactly one provenance mode — schema EVOLUTION, not purely additive DDL). */

  const mine = migrations.filter((f) => /trh23/.test(f));
  assert.equal(mine.length, 1, "one migration file carries this phase's name");
  const sql = read(`src/db/migrations/${mine[0]}`);
  /*
   * `ON UPDATE no action` IS PART OF EVERY FOREIGN KEY DRIZZLE EMITS, so a substring search for
   * "UPDATE " reports a data migration in a file that contains none. The rule anchors on the
   * STATEMENT instead — which is what "no backfill" actually means.
   */
  for (const destructive of [
    /\bDROP\s+TABLE\b/i,
    /\bDROP\s+COLUMN\b/i,
    /\bDROP\s+CONSTRAINT\b/i,
    /\bALTER\s+COLUMN\b/i,
    /(?:^|;|\n)\s*UPDATE\s+"/i,
    /\bDELETE\s+FROM\b/i,
    /\bTRUNCATE\b/i,
    /\bINSERT\s+INTO\b/i,
  ]) {
    assert.ok(
      !destructive.test(sql),
      `the migration contains no \`${destructive.source}\` — additive only, no backfill, no data`,
    );
  }
  assert.ok(sql.includes('CREATE TABLE "standing_observation_authorizations"'), "it creates the table");
  assert.ok(
    sql.includes(`ALTER TYPE "public"."governance_domain" ADD VALUE 'standing-observation'`),
    "and adds the one governance domain value, which is the only change to an existing type",
  );

  console.log(
    "trh23-standing-observation/authority-firewall: append-only proved structurally, one writer, " +
      "one minter, three narrowed read seams, credential opener still human-only, ledger 51",
  );
}

main();
