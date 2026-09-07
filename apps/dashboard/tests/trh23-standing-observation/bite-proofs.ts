/*
 * TRH-23 — BITE PROOFS.
 *
 * A firewall is the easiest kind of test to believe and the hardest to see fail, because a passing
 * guard and an inert guard look identical. So each property is removed from REAL SOURCE, one at a
 * time, and the focused suites are required to object for the reason this file declares in advance.
 *
 * The four that matter most:
 *
 *   B3 narrows `withDecryptedSecret` to a bare tenant scope. That single edit would let an
 *      observation principal decrypt a tenant's provider secret, and EVERY other rule in the
 *      firewall would still pass. It is the most dangerous one-line change this phase could suffer.
 *
 *   B5 exports the principal's runtime brand. The type system would be unchanged and the postgres
 *      suite would still pass — a forged principal would simply become constructible.
 *
 *   B7 makes withdrawal a stamp on the existing row instead of a new revision. The lineage would
 *      still "work"; what would be lost is the property that history cannot be edited.
 *
 *   B9 lets the minter take a tenant argument. That is the entire tenant trust chain in one
 *      parameter: a caller that can name a tenant can choose one.
 *
 * A proof whose child run is killed is VOID and reported as such — never counted as a bite. A
 * timeout is the absence of a verdict, not a verdict.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const abs = (f: string): string => path.join(ROOT, f);
const read = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

const AUTHORITY = "src/features/standing-observation-authority";
const WRITER = `${AUTHORITY}/authorize-standing-observation.server.ts`;
const READER = `${AUTHORITY}/read-standing-observations.server.ts`;
const PRINCIPAL = `${AUTHORITY}/observation-principal.server.ts`;
const REVALIDATOR = `${AUTHORITY}/revalidate-standing-observation.server.ts`;
const SCHEMA = "src/db/schema/standing-observation-authorization.ts";
const CREDENTIALS = "src/features/integration-credentials/credential-repository.server.ts";
/* The migration the disposable harness actually applies — see B8. */
const MIGRATION = "src/db/migrations/20260907202659_trh23_standing_observation_authorization.sql";

const FIREWALL = "tests/trh23-standing-observation/authority-firewall.ts";
const POSTGRES = "tests/trh23-standing-observation/authorization-postgres.ts";
const CHILD_TIMEOUT_MS = 300_000;

interface Run {
  readonly ok: boolean;
  readonly void: boolean;
  readonly output: string;
}

function runSuite(suite: string): Run {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const killed = result.signal !== null || result.status === null;
  return { ok: result.status === 0, void: killed, output };
}

interface Edit {
  readonly find: string;
  readonly replace: string;
}
interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly edits: readonly Edit[];
  readonly suite: string;
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  /* ── APPEND-ONLY ─────────────────────────────────────────────────────────── */
  {
    label: "B1 the authority gains an UPDATE path for the authorization lifecycle",
    file: WRITER,
    edits: [
      {
        find: "      /* 13 · THE REVISION. Nothing that already exists is edited. */",
        replace:
          "      await tx\n" +
          "        .update(standingObservationAuthorizations)\n" +
          "        .set({ intervalMinutes })\n" +
          "        .where(eq(standingObservationAuthorizations.tenantId, authenticated.tenantId));\n",
      },
    ],
    suite: FIREWALL,
    because: "a standing authorization is never edited, only superseded",
  },
  {
    /*
     * THE MUTATION IS PLACED IN THE READER, NOT IN A STRANGER, AND THAT MATTERS.
     *
     * Adding an inserter to an unrelated module trips the earlier census — "exactly four modules
     * name the table" — and would prove that rule twice while leaving the inserter rule untested.
     * The reader already names the table legitimately, so this mutation isolates exactly one
     * property: that only ONE of those four may write.
     */
    label: "B2 the reader is allowed to insert an authorization revision",
    file: READER,
    edits: [
      {
        find: "export async function readEffectiveStandingObservation(",
        replace:
          "declare const smuggledDb: {\n" +
          "  insert: (t: unknown) => { values: (v: unknown) => Promise<void> };\n" +
          "};\n" +
          "export const smuggledWrite = () =>\n" +
          "  smuggledDb.insert(standingObservationAuthorizations).values({});\n\n" +
          "export async function readEffectiveStandingObservation(",
      },
    ],
    suite: FIREWALL,
    because: "exactly one module inserts an authorization revision",
  },

  /* ── THE CREDENTIAL OPENER. The most dangerous single line in the phase. ── */
  {
    label: "B3 `withDecryptedSecret` is narrowed so a machine principal could open a secret",
    file: CREDENTIALS,
    edits: [
      {
        find: "export async function withDecryptedSecret<T>(\n  tenant: TenantContext | null,",
        replace:
          'export async function withDecryptedSecret<T>(\n  tenant: Pick<TenantContext, "tenantId"> | null,',
      },
    ],
    suite: FIREWALL,
    because: "`withDecryptedSecret` still takes the BRANDED HUMAN context",
  },
  {
    label: "B4 the revalidator imports the secret opener alongside the metadata reader",
    file: REVALIDATOR,
    edits: [
      {
        find:
          'import { listCredentialMetadata } from "@/features/integration-credentials/credential-repository.server";',
        replace:
          'import { listCredentialMetadata, withDecryptedSecret } from "@/features/integration-credentials/credential-repository.server";\n' +
          "void withDecryptedSecret;",
      },
    ],
    suite: FIREWALL,
    because: "it names ONLY the metadata reader",
  },

  /* ── THE PRINCIPAL ───────────────────────────────────────────────────────── */
  {
    label: "B5 the principal's runtime brand is exported, so a forged principal becomes constructible",
    file: PRINCIPAL,
    edits: [
      {
        find: "const OBSERVATION_PRINCIPAL_BRAND: unique symbol = Symbol(",
        replace: "export const OBSERVATION_PRINCIPAL_BRAND: unique symbol = Symbol(",
      },
    ],
    suite: FIREWALL,
    because: "it is never exported, so no other module can write the key into a literal",
  },
  {
    label: "B6 a second module mints an observation principal",
    file: "src/features/knowledge/knowledge-write-authority.server.ts",
    edits: [
      {
        find: "export async function resolveKnowledgeWriteAuthority(",
        replace:
          "export async function mintObservationPrincipal(): Promise<null> {\n" +
          "  return null;\n" +
          "}\n\n" +
          "export async function resolveKnowledgeWriteAuthority(",
      },
    ],
    suite: FIREWALL,
    because: "exactly one module mints an observation principal",
  },

  /* ── THE SCHEMA'S OWN CLAIMS ─────────────────────────────────────────────── */
  {
    label: "B7 the table gains a `revoked_at` stamp, so withdrawal could edit the active row",
    file: SCHEMA,
    edits: [
      {
        find: "    /** LINEAGE. The revision this one replaces. NULL exactly on revision 1, enforced both ways. */",
        replace:
          '    revokedAt: timestamp("revoked_at", { withTimezone: true }),\n' +
          "    /** LINEAGE. */",
      },
    ],
    suite: FIREWALL,
    because: "that fact belongs to a phase that does not exist",
  },
  {
    /*
     * THE MIGRATION IS MUTATED, NOT THE SCHEMA MODULE, AND THE DIFFERENCE IS THE WHOLE PROOF.
     *
     * The disposable harness applies the `.sql` files; it never reads `db/schema/*.ts`. Deleting the
     * CHECK from the drizzle definition therefore changes nothing a running database enforces, the
     * suite passes, and the proof would have reported a bite that never happened. What defends this
     * property at runtime is the constraint IN THE MIGRATION, so that is what has to be removed.
     */
    label: "B8 the human-authorizer CHECK is removed from the migration, so an agent could authorize",
    file: MIGRATION,
    edits: [
      {
        find:
          '\tCONSTRAINT "standing_observation_authorizations_human_authorizer_chk" ' +
          'CHECK ("standing_observation_authorizations"."authorized_by_actor_type" = \'human\'),\n',
        replace: "",
      },
    ],
    suite: POSTGRES,
    because: "an agent authorizer is refused by PostgreSQL, not by an application check",
  },

  /* ── THE TENANT TRUST CHAIN ──────────────────────────────────────────────── */
  {
    label: "B9 the minter accepts a tenant argument, so a caller could choose one",
    file: PRINCIPAL,
    edits: [
      {
        find: "export async function mintObservationPrincipal(\n  authorizationId: string,",
        replace:
          "export async function mintObservationPrincipal(\n  callerTenantId: string,\n  authorizationId: string = callerTenantId,",
      },
    ],
    suite: FIREWALL,
    because: "the minter's only scope argument is the authorization's own id",
  },

  /* ── THE AUTHORITATIVE CHECK ─────────────────────────────────────────────── */
  {
    label: "B10 the revalidator trusts the caller's principal instead of re-reading the row",
    file: REVALIDATOR,
    edits: [
      {
        find: "  const current = fresh.principal;",
        replace: "  const current = principal;",
      },
    ],
    suite: POSTGRES,
    /*
     * THE EARLIEST ASSERTION THIS MUTATION REACHES, NAMED HONESTLY.
     *
     * Trusting the caller's principal makes every binding comparison compare a value with itself, so
     * scope substitution stops being caught and the run falls through to the availability check. The
     * suite objects there — several sections BEFORE the revocation case — and a proof that claimed
     * the revocation message would be asserting a failure it never observes.
     */
    because: "substitution is caught by the binding comparison, before availability is even asked",
  },
  {
    label: "B11 the withdrawal check is dropped, so a withdrawn lineage still mints",
    file: PRINCIPAL,
    edits: [
      {
        find: '  if (effective.state !== "active") return { status: "refused", reason: "authorization-withdrawn" };',
        replace: "",
      },
    ],
    suite: POSTGRES,
    because: "it is told that the permission was WITHDRAWN, not merely that a newer revision exists",
  },
  {
    label: "B12 the staleness check is dropped, so a superseded revision still mints",
    file: PRINCIPAL,
    edits: [
      {
        find: '  if (effective.id !== row.id) return { status: "refused", reason: "authorization-superseded" };',
        replace: "",
      },
    ],
    suite: POSTGRES,
    because: "a superseded revision mints nothing",
  },

  /* ── THE WRITER'S OWN PRECONDITIONS ──────────────────────────────────────── */
  {
    label: "B13 the Governance authority check is removed, so any member could authorize",
    file: WRITER,
    edits: [
      { find: '  if (!authority.authorized) return refused("not-the-governance-authority");', replace: "" },
    ],
    suite: POSTGRES,
    because: "a foreign Governance authority is refused",
  },
  {
    label: "B14 the observable allow-list is bypassed, so a write capability could be authorized",
    file: WRITER,
    edits: [
      {
        find:
          "  if (!isObservableCapability(scope.providerKey, scope.capabilityKey, scope.subjectKind)) {\n" +
          '    return refused("capability-not-observable");\n' +
          "  }",
        replace: "",
      },
    ],
    suite: POSTGRES,
    because: "a capability outside the observable allow-list is refused",
  },
  {
    /*
     * RE-ANCHORED WHEN THE WRITER STOPPED QUERYING `integrations` DIRECTLY.
     *
     * A released firewall pins the modules that may name the integrations table to two, both inside
     * `integration-authority`, so the connection check now goes through `readConnection`. The
     * PROPERTY is unchanged — a caller may not authorize through a connection its tenant does not
     * own — and what this proof removes is the check itself rather than its tenant predicate.
     *
     * The composite foreign key still refuses the row, so a refusal SURVIVES this mutation. What is
     * lost is the honest, indistinguishable answer, and that is what the suite must notice.
     */
    label: "B15 the connection check is skipped, so ownership is left entirely to the foreign key",
    file: WRITER,
    edits: [
      {
        find:
          "  if (nextState === \"active\") {\n" +
          "    const connectionRefusal = await resolveTenantConnection(\n" +
          "      authenticated,\n" +
          "      integrationOf(input),\n" +
          "      scope.providerKey,\n" +
          "      deps,\n" +
          "    );\n" +
          "    if (connectionRefusal) return refused(connectionRefusal);\n" +
          "  }\n",
        replace: "",
      },
    ],
    suite: POSTGRES,
    /*
     * THE SHARPEST FAILURE THIS MUTATION CAUSES, NAMED HONESTLY.
     *
     * For ANOTHER TENANT'S connection the foreign key still refuses, so a refusal survives and only
     * its reason degrades. For a connection of the caller's OWN tenant belonging to a DIFFERENT
     * PROVIDER the key is satisfied — that row really does exist under that tenant — and the write
     * SUCCEEDS. A YouTube capability would stand authorized through a Google connection. That is
     * the first assertion the suite reaches, and it is the real defect.
     */
    because: "a connection belonging to a different provider is refused",
  },
  {
    label: "B16 the stale-revision precondition is dropped, so a human's view stops mattering",
    file: WRITER,
    edits: [
      {
        find:
          "      if (observedRevision !== currentRevision) {\n" +
          '        throw new StandingObservationAbort("stale-authorization-revision");\n' +
          "      }",
        replace: "",
      },
    ],
    suite: POSTGRES,
    because: "a stale view of the lineage is refused",
  },
];

interface AcceptedChange {
  readonly label: string;
  readonly file: string;
  readonly edits: readonly Edit[];
  readonly suite: string;
  readonly why: string;
}

const ACCEPTED: readonly AcceptedChange[] = [
  /*
   * C1 — PROSE IS NOT CODE.
   *
   * Every rule reads source with comments stripped, because this repository has repeatedly been
   * bitten by firewalls that failed on an honest explanation naming the thing they forbid. A comment
   * that names `withDecryptedSecret` inside the revalidator must therefore be tolerated. If this is
   * rejected, the suite is policing vocabulary rather than behaviour.
   */
  {
    label: "C1 the revalidator NAMES the secret opener in a comment explaining why it is not called",
    file: REVALIDATOR,
    edits: [
      {
        find: "export async function revalidateStandingObservation(",
        replace:
          "/* withDecryptedSecret is deliberately unreachable from here. */\n" +
          "export async function revalidateStandingObservation(",
      },
    ],
    suite: FIREWALL,
    why: "the rules read code with comments stripped, so prose naming the opener changes nothing",
  },
  /*
   * C2 — A NARROWER CADENCE FLOOR IS NOT A WEAKENING.
   *
   * The application constant may be raised without the database CHECK moving, because the CHECK is a
   * FLOOR and the constant is a policy above it. If this is rejected, the two numbers have been
   * wired together in a way that would make tightening the policy impossible without a migration.
   */
  {
    label: "C2 the application cadence floor is raised above the database's",
    file: `${AUTHORITY}/contracts.ts`,
    edits: [
      {
        find: "export const MIN_OBSERVATION_INTERVAL_MINUTES = 60;",
        replace: "export const MIN_OBSERVATION_INTERVAL_MINUTES = 60;\nvoid 0;",
      },
    ],
    suite: FIREWALL,
    why: "the constant is a policy above the database's floor, and the two are allowed to differ",
  },
];

const voided: string[] = [];
let bitten = 0;

function withMutation(label: string, file: string, edits: readonly Edit[], body: () => void): void {
  const original = read(file);
  const before = sha(original);

  let mutated = original;
  for (const edit of edits) {
    const occurrences = mutated.split(edit.find).length - 1;
    assert.equal(
      occurrences,
      1,
      `${label}: the mutation anchor must appear exactly once in ${file}, found ${occurrences} — ` +
        `a non-unique anchor mutates a line the proof did not choose`,
    );
    mutated = mutated.replace(edit.find, edit.replace);
  }

  try {
    writeFileSync(abs(file), mutated, "utf8");
    assert.notEqual(sha(read(file)), before, `${label}: the mutation did not reach ${file}`);
    assert.equal(read(file), mutated, `${label}: ${file} on disk is not the text this proof composed`);
    body();
  } finally {
    writeFileSync(abs(file), original, "utf8");
    assert.equal(sha(read(file)), before, `${label}: ${file} was not restored byte-identically`);
  }
}

function main(): void {
  for (const mutation of MUTATIONS) {
    withMutation(mutation.label, mutation.file, mutation.edits, () => {
      const run = runSuite(mutation.suite);
      if (run.void) {
        voided.push(mutation.label);
        return;
      }
      assert.equal(run.ok, false, `${mutation.label}: the suite still PASSED — the guard does not bite`);
      assert.ok(
        run.output.includes(mutation.because),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.because}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    if (!voided.includes(mutation.label)) {
      bitten += 1;
      console.log(`BITE ${mutation.label}`);
    }
  }

  for (const control of ACCEPTED) {
    withMutation(control.label, control.file, control.edits, () => {
      const run = runSuite(control.suite);
      assert.equal(run.void, false, `${control.label}: the control run was killed — VOID, not a pass`);
      assert.ok(
        run.ok,
        `${control.label}: this change was REJECTED, but it should have been tolerated because ` +
          `${control.why}.\n--- actual ---\n${run.output.slice(-2000)}`,
      );
    });
    console.log(`ACCEPT ${control.label}`);
  }

  assert.deepEqual(voided, [], `these proofs were VOID (child killed), not passes: ${voided.join(", ")}`);
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(
    `trh23-standing-observation/bite-proofs: ${bitten} mutations bit, ${ACCEPTED.length} tolerated ` +
      `changes accepted, 0 void`,
  );
}

main();
