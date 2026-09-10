/*
 * TRH-24 — THE FIREWALL. What a machine-sourced observation CANNOT reach, proved against real
 * source rather than asserted in prose.
 *
 * Source is read with comments STRIPPED wherever a rule could otherwise be satisfied — or tripped —
 * by prose. Every module in this phase discusses the very things it forbids.
 *
 *   1. THE CREDENTIAL BOUNDARY — the narrow opener is narrower, and censused to one caller.
 *   2. THE MACHINE PATH REACHES NOTHING, proved by the real value-import closure.
 *   3. NO SCHEDULER, NO INGRESS, NO SURFACE, NO RETRY.
 *   4. NO MACHINE IDENTITY OF ANY KIND.
 *   5. THE HUMAN PATHS ARE UNCHANGED.
 *   6. THE LEDGER MOVED BY EXACTLY ONE, AND IT IS EVOLUTION, STATED.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const HISTORY = "src/features/provider-observation-history";
const COMPOSITION = `${HISTORY}/observe-once-under-authorization.server.ts`;
const DISPATCH = `${HISTORY}/observe-authorized-subject.server.ts`;
const WRITER = `${HISTORY}/write-provider-observation.server.ts`;
const READER = `${HISTORY}/read-provider-observations.server.ts`;
const SCHEMA = "src/db/schema/provider-observation.ts";
const CREDENTIALS = "src/features/integration-credentials/credential-repository.server.ts";
const YOUTUBE_CALL = "src/features/provider-youtube/youtube-api-key-call.server.ts";
const REVALIDATOR =
  "src/features/standing-observation-authority/revalidate-standing-observation.server.ts";
const CEREMONY = "scripts/trh24-observe-once.ts";

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

const SRC = walk("src");

/** The real VALUE-import closure — `import type` excluded, `export … from` followed. */
function valueImportClosure(entry: string): string[] {
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
    for (const match of [
      ...body.matchAll(/(?:^|\n)\s*import\s+(?!type\s)([\s\S]*?)from\s+"([^"]+)"/g),
      ...body.matchAll(/(?:^|\n)\s*export\s+(?!type\s)([\s\S]*?)from\s+"([^"]+)"/g),
    ]) {
      const clause = match[1] ?? "";
      if (/^\s*\{\s*(type\s+[^,}]+\s*,?\s*)+\}\s*$/.test(clause)) continue;
      const resolved = resolve(current, match[2]!);
      if (resolved) queue.push(resolved);
    }
  }
  seen.delete(entry);
  return [...seen];
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
   * 1. THE CREDENTIAL BOUNDARY.
   *
   * The single most dangerous thing this phase could have done is widen the released opener. It did
   * not; it added a narrower sibling, and both halves of that sentence are checked here.
   * ═══════════════════════════════════════════════════════════════════════ */
  const credentialCode = read(CREDENTIALS);

  assert.ok(
    /export async function withDecryptedSecret<T>\(\s*\n?\s*tenant: TenantContext \| null,/.test(
      credentialCode,
    ),
    "`withDecryptedSecret` STILL takes the branded HUMAN context — TRH-24 did not widen it",
  );

  const narrow = credentialCode.match(
    /export async function withConnectionScopedSecret<T>\(([\s\S]*?)\): Promise<ScopedSecretResult<T>>/,
  );
  assert.ok(narrow, "the narrow connection-scoped opener exists");
  const narrowParams = narrow![1]!;
  assert.ok(
    /tenant: Pick<TenantContext, "tenantId"> \| null,/.test(narrowParams),
    "it takes a bare tenant scope",
  );
  assert.ok(
    /integrationId: string,/.test(narrowParams) && /kind: IntegrationCredentialKind,/.test(narrowParams),
    "and a connection plus a KIND",
  );
  assert.ok(
    !/credentialId/.test(narrowParams),
    "and NO credential id — the caller cannot name a credential, which is the whole difference",
  );

  /*
   * ITS CALLERS ARE CENSUSED. A second caller is how this becomes a generic credential-enumeration
   * upgrade by accident, so an UNNAMED caller fails here rather than being discovered later.
   *
   * THE CENSUS GREW BY ONE PROVIDER, NOT BY ONE CATEGORY. Instagram's read seam spends the same
   * narrow opener with a different credential KIND (`oauth_access` rather than `api_key`), which is
   * the seam working as designed: the opener still takes a connection and a kind and still has no
   * credential parameter. Each entry is enumerated by path, so a THIRD caller — or a caller that is
   * not a provider read seam — still fails this line.
   */
  const openerCallers = SRC.filter(
    (f) => f !== CREDENTIALS && /\bwithConnectionScopedSecret\s*\(/.test(codeOf(read(f))),
  );
  assert.deepEqual(
    openerCallers,
    [
      "src/features/provider-instagram/instagram-access-token-call.server.ts",
      YOUTUBE_CALL,
    ].sort(),
    "exactly two modules spend a connection-scoped secret, and both are provider read seams",
  );

  /* Neither the composition nor the ceremony can resolve, name or hold a credential. */
  for (const f of [COMPOSITION, CEREMONY]) {
    const code = codeOf(read(f));
    for (const forbidden of ["withDecryptedSecret", "withConnectionScopedSecret", "credentialId", "plaintext", "listCredentialMetadata"]) {
      assert.ok(!code.includes(forbidden), `${f} names no \`${forbidden}\``);
    }
  }

  /*
   * THE KEY EXISTS ONLY AS THE CALLBACK'S PARAMETER, AND IS PASSED STRAIGHT THROUGH.
   *
   * A blanket ban on the identifier `apiKey` would have been the crude version of this rule — and a
   * false one, because naming the callback parameter is exactly HOW the confinement works. What must
   * not happen is the key being stored, returned, logged or read; so the rule pins the one shape it
   * may appear in and forbids every other mention.
   */
  /*
   * RE-AIMED AT THE DISPATCH, AND THE COMPOSITION'S BAR WENT UP (Instagram phase).
   *
   * When YouTube was the only provider, the composition itself opened the key and this rule pinned
   * the two mentions that confinement requires. A second provider moved the read behind a dispatch,
   * so the composition now names NO credential at all — a stricter state than the one this rule was
   * written to protect, and it is asserted as such rather than quietly dropped.
   *
   * The confinement rule itself is unchanged; it now applies where the key actually is.
   */
  const dispatchSource = codeOf(read(DISPATCH));
  assert.equal(
    (codeOf(read(COMPOSITION)).match(/apiKey|accessToken/g) ?? []).length,
    0,
    "the composition names NO credential — the read moved behind the dispatch",
  );
  assert.equal(
    (dispatchSource.match(/apiKey/g) ?? []).length,
    2,
    "`apiKey` appears exactly twice in the dispatch: bound, then passed",
  );
  /*
   * TWICE PER INSTAGRAM BRANCH — bound by the credential seam, then passed to the read — and there
   * are now two branches (account, media). The point of the pin is unchanged: the token is never
   * stored, never returned, never logged and never widened; it only ever travels from the seam that
   * opened it into the one call that spends it.
   */
  assert.equal(
    (dispatchSource.match(/accessToken/g) ?? []).length,
    4,
    "`accessToken` appears twice per Instagram branch: bound, then passed",
  );
  for (const forbidden of ["withDecryptedSecret", "credentialId", "plaintext", "listCredentialMetadata"]) {
    assert.ok(!dispatchSource.includes(forbidden), `the dispatch names no \`${forbidden}\``);
  }
  /* Each credential is the callback's parameter, handed straight to its released read. */
  assert.ok(
    /\(apiKey\)\s*=>\s*observeChannelById\(apiKey,/.test(dispatchSource),
    "the YouTube key is the callback parameter handed directly to the released read",
  );
  assert.ok(
    /\(accessToken\)\s*=>\s*observeAccountById\(accessToken,/.test(dispatchSource),
    "the Instagram token is the callback parameter handed directly to the released read",
  );
  for (const f of [COMPOSITION, CEREMONY]) {
    assert.ok(!/console\.[a-z]+\([^)]*apiKey/.test(codeOf(read(f))), `${f} never logs a key`);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 2. THE MACHINE PATH REACHES NOTHING IT MUST NOT.
   * ═══════════════════════════════════════════════════════════════════════ */
  const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
    ["a Governance decision writer", /governance-decision\/(decision-authority|bootstrap-authority|authority-delegation)/],
    ["the standing authorization WRITER", /standing-observation-authority\/authorize-/],
    ["a permit or action-authorization writer", /action-authorization\/(record-action-request|issue-|authorize)/],
    ["the action execution runtime", /action-execution(-live)?\//],
    ["a Knowledge admission or write seam", /knowledge\/(knowledge-write-authority|admission)/],
    ["a Work writer", /work-artifacts\/write-|organizational-work\/(record|write)/],
    ["an agent mandate writer", /agent-mandate\/establish-/],
    ["the human session runtime", /auth-runtime\//],
    /*
     * NOT "any governance-audit module". The credential authority audits its OWN access, and is
     * reached legitimately through the provider read seam — banning the whole directory would have
     * been a rule that fails for a correct reason and teaches nothing.
     *
     * What must stay unreachable are the audit writers that record AUTHORITY: a machine observation
     * may not append a Governance decision event or a standing-observation event, because either
     * would let a read leave a trace claiming something was authorized.
     */
    ["the Governance decision audit writer", /governance-audit\/governance-decision-audit/],
    ["the standing observation audit writer", /governance-audit\/standing-observation-audit/],
    ["the agent mandate audit writer", /governance-audit\/agent-mandate-audit/],
    ["the action authorization audit writer", /governance-audit\/action-authorization-audit/],
    ["the action execution audit writer", /governance-audit\/action-execution-audit/],
    ["the knowledge mutation audit writer", /governance-audit\/knowledge-mutation-audit/],
  ];
  const closure = valueImportClosure(COMPOSITION);
  for (const [label, pattern] of FORBIDDEN) {
    const reached = closure.filter((f) => pattern.test(f));
    assert.deepEqual(reached, [], `the observation composition cannot reach ${label} — ${reached.join(", ")}`);
  }

  /*
   * AND IT CANNOT MINT A HUMAN. The composition, the writer and the ceremony never name the human
   * context's minter, so a machine observation cannot manufacture the principal that would let it
   * reach everything above.
   */
  for (const f of [COMPOSITION, WRITER, CEREMONY, REVALIDATOR]) {
    assert.ok(
      !codeOf(read(f)).includes("asHumanTenantContext"),
      `${f} cannot construct a human tenant context`,
    );
  }

  /*
   * THE WRITER CANNOT CAUSE A READ. Persistence and transport stay different seams.
   *
   * STATED AS AN EXACT CENSUS RATHER THAN A DIRECTORY BAN. The writer does reach ONE file under
   * `provider-youtube` — its `contracts.ts`, a pure vocabulary module of frozen constants, pulled in
   * because the standing-observation allow-list binds the released capability key rather than
   * re-spelling it. Banning the directory would have failed for a correct reason and taught nothing;
   * naming the one permitted module makes a second one fail instead.
   */
  const writerClosure = valueImportClosure(WRITER);
  assert.deepEqual(
    writerClosure.filter((f) => f.startsWith("src/features/provider-youtube/")),
    ["src/features/provider-youtube/contracts.ts"],
    "the writer reaches the provider's VOCABULARY and nothing that can call it",
  );
  for (const pattern of [/youtube-transport/, /youtube-api-key-call/, /read-channel-observation/, /credential-repository/]) {
    assert.deepEqual(
      writerClosure.filter((f) => pattern.test(f)),
      [],
      `the observation writer cannot reach ${pattern.source} — recording is not observing`,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 3. NO SCHEDULER, NO INGRESS, NO SURFACE, NO RETRY.
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
      /*
       * TRH-25's machine ingress. TRH-24's own property is unchanged and still true OF TRH-24: it
       * added no ingress, and its composition was reachable only from an operator terminal. The
       * door came later, and is named here so a SECOND one cannot appear unnamed.
       */
      "src/app/api/observation/scan/route.ts",
    ],
    "one machine ingress beside the four OAuth browser-redirect handlers, and no other route",
  );

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

  for (const f of [COMPOSITION, WRITER, REVALIDATOR, CEREMONY]) {
    const code = codeOf(read(f));
    for (const forbidden of ["setInterval", "setTimeout", "node-cron", "worker_threads", "Queue(", "while ("]) {
      assert.ok(!code.includes(forbidden), `${f} contains no \`${forbidden}\` — nothing loops or waits`);
    }
  }

  /*
   * ONE ATTEMPT PER PROCESS. The composition calls the transport exactly once and never calls
   * itself, so "retry" is something an operator does by running the ceremony again — and is then
   * refused by the cadence ceiling.
   */
  const compositionCode = codeOf(read(COMPOSITION));
  /*
   * ONE CALL SITE — counted as call sites, not as mentions. The import statement names the function
   * too, and a raw occurrence count would have made "1" mean "imported but never called".
   */
  assert.equal(
    (dispatchSource.match(/await withAuthorizedYouTubeApiKey\(/g) ?? []).length,
    1,
    "the dispatch spends the YouTube key at exactly one call site",
  );
  /*
   * ONE CALL SITE PER INSTAGRAM CAPABILITY — two, since the media read was added as its own
   * capability rather than by widening the account read. The invariant this pin protects is not
   * "one", it is "one per released branch, and none anywhere else": the credential is opened by the
   * connection-scoped seam inside a capability guard, and there is no path that opens it outside
   * one.
   */
  assert.equal(
    (dispatchSource.match(/await withAuthorizedInstagramToken\(/g) ?? []).length,
    2,
    "and the Instagram token at exactly one call site per capability branch",
  );
  assert.equal(
    (compositionCode.match(/withAuthorized\w+\(/g) ?? []).length,
    0,
    "the composition spends no credential itself — it delegates the read whole",
  );
  assert.ok(
    !/observeOnceUnderAuthorization\s*\(/.test(
      compositionCode.replace(/export async function observeOnceUnderAuthorization\s*\(/, ""),
    ),
    "and never calls itself",
  );

  /* NO PRODUCT SURFACE. This phase adds an operator ceremony and nothing a browser can reach. */
  for (const f of walk("src/app").concat(walk("src/components"))) {
    assert.ok(
      !/observeOnceUnderAuthorization|recordAuthorizedProviderObservation|withConnectionScopedSecret/.test(
        codeOf(read(f)),
      ),
      `${f} does not reach the machine observation path`,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 4. NO MACHINE IDENTITY OF ANY KIND.
   * ═══════════════════════════════════════════════════════════════════════ */
  for (const f of SRC) {
    assert.ok(
      !/service_accounts|serviceAccounts|machine_users|machineUsers|observation_principals/.test(
        codeOf(read(f)),
      ),
      `${f} introduces no durable machine identity storage`,
    );
  }
  const schemaCode = codeOf(read(SCHEMA));
  for (const forbidden of ["serviceAccountId", "machineUserId", "principalId", "nextRunAt", "scheduleId", "lastRunAt"]) {
    assert.ok(!schemaCode.includes(forbidden), `the observation table carries no \`${forbidden}\``);
  }

  /*
   * THE MACHINE ROW HAS NO ACTOR, AND THE WRITER SAYS SO LITERALLY.
   *
   * Stated positively by enumeration: a negative lookahead beside `\\s*` backtracks to zero width
   * and passes on the very source it claims to forbid.
   */
  const writerCode = codeOf(read(WRITER));
  const machineWriter = writerCode.slice(writerCode.indexOf("recordAuthorizedProviderObservation"));

  /*
   * RE-AIMED, NOT WEAKENED (TRH-25 prerequisite). The machine insert became one atomic
   * `insert ... select ... where not exists` statement so the cadence window is claimed by the
   * write itself, which moved the actor columns out of a drizzle object literal and into the
   * statement's own column list. The PROPERTY under test is unchanged and the bar is not lowered:
   * the two actor columns must still be written, must still be written as NULL, and no actor-type
   * literal may appear anywhere in this writer.
   *
   * The old assertion matched `observedByActorType: null`. It could not see the new form, and a
   * guard that cannot see the truth it guards is worse than no guard, because it reads as proof.
   */
  const columnList = machineWriter.slice(
    machineWriter.indexOf("insert into provider_observations"),
    machineWriter.indexOf("where not exists"),
  );
  assert.ok(columnList.length > 0, "the machine writer inserts through one statement");
  for (const column of ["observed_by_actor_type", "observed_by_actor_id"]) {
    assert.ok(columnList.includes(column), `the machine writer names ${column} explicitly`);
  }

  /*
   * AND THE VALUES OPPOSITE THEM ARE THE TWO BARE NULLS. Proved positionally rather than by a
   * lookahead: the select list is read, and the entries at the actor columns' own offsets must be
   * exactly `null`.
   */
  const columns = columnList
    .slice(columnList.indexOf("(") + 1, columnList.lastIndexOf(")"))
    .split(",")
    .map((c) => c.trim());
  const selectList = columnList.slice(columnList.indexOf("select", columnList.lastIndexOf(")")));
  const values = selectList
    .replace(/^select/, "")
    .split(",")
    .map((v) => v.trim());
  assert.equal(
    values.length,
    columns.length,
    "every inserted column has exactly one value — no positional drift",
  );
  for (const column of ["observed_by_actor_type", "observed_by_actor_id"]) {
    assert.equal(
      values[columns.indexOf(column)],
      "null",
      "a machine observation records NO human actor — never a borrowed id, never a service literal",
    );
  }

  for (const literal of ['"human"', '"service"', '"system"', '"agent"', "'human'", "'service'"]) {
    assert.ok(
      !machineWriter.includes(literal),
      `the machine writer never names the actor type ${literal}`,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 5. THE HUMAN PATHS ARE UNCHANGED.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.ok(
    /export async function recordProviderObservation\(\s*\n?\s*tenant: TenantContext \| null,/.test(
      read(WRITER),
    ),
    "the released human observation writer still takes the branded human context",
  );
  assert.ok(
    /export async function readPublicChannelObservation\(\s*\n?\s*tenant: TenantContext \| null,/.test(
      read("src/features/provider-youtube/read-channel-observation.server.ts"),
    ),
    "and the released human read path is untouched",
  );
  const mintSites = SRC.filter((f) => /export function asHumanTenantContext\b/.test(read(f)));
  assert.deepEqual(mintSites, ["src/features/auth/tenant/tenant-context.ts"], "one human mint site");

  /* THE PROVIDER STAYS READ-ONLY, AND THE TRANSPORT STAYS TABLE-FREE. */
  for (const f of walk("src/features/provider-youtube")) {
    const code = codeOf(read(f));
    assert.ok(!/\.insert\(|\.update\(|\.delete\(|@\/db\/schema/.test(code), `${f} touches no table`);
    assert.ok(!/method:\s*"(POST|PUT|PATCH|DELETE)"/.test(code), `${f} makes no non-GET request`);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 6. THE LEDGER MOVED BY EXACTLY ONE, AND IT IS EVOLUTION, STATED.
   * ═══════════════════════════════════════════════════════════════════════ */
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  assert.equal(migrations.length, 52, "51 -> 52: TRH-24 authored exactly one migration");
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: readonly { readonly tag: string }[];
  };
  assert.equal(journal.entries.length, 52, "and the journal agrees with the files");

  const mine = migrations.filter((f) => /trh24/.test(f));
  assert.equal(mine.length, 1, "one migration file carries this phase's name");
  const sql = read(`src/db/migrations/${mine[0]}`);

  /*
   * THIS MIGRATION IS ALLOWED TO DROP NOT NULL, AND IS NOT ALLOWED TO DO ANYTHING ELSE DESTRUCTIVE.
   * Saying so here is what keeps "schema evolution" from becoming a licence.
   */
  assert.equal(
    (sql.match(/ALTER COLUMN "[a-z_]+" DROP NOT NULL/g) ?? []).length,
    2,
    "exactly two NOT NULL constraints are dropped — the human actor pair, together",
  );
  for (const destructive of [
    /\bDROP\s+TABLE\b/i,
    /\bDROP\s+COLUMN\b/i,
    /\bDROP\s+CONSTRAINT\b/i,
    /\bSET\s+NOT\s+NULL\b/i,
    /(?:^|;|\n)\s*UPDATE\s+"/i,
    /\bDELETE\s+FROM\b/i,
    /\bTRUNCATE\b/i,
    /\bINSERT\s+INTO\b/i,
  ]) {
    assert.ok(!destructive.test(sql), `the migration contains no \`${destructive.source}\` — no backfill, no data`);
  }

  /*
   * THE FOREIGN KEY COMES AFTER THE INDEX IT NEEDS. PostgreSQL refuses the other order, and the
   * generator emitted the other order — so this is pinned rather than left to be rediscovered.
   */
  assert.ok(
    sql.indexOf("standing_observation_authorizations_id_tenant_uq") <
      sql.indexOf("provider_observations_tenant_authorization_fk"),
    "the unique index precedes the composite foreign key that references it",
  );

  console.log(
    "trh24-machine-observation/authority-firewall: credential opener narrowed not widened, one " +
      "caller, no machine identity, no scheduler, human paths intact, ledger 52",
  );
}

main();
