/*
 * TRH-24 — BITE PROOFS.
 *
 * Each property is removed from REAL SOURCE, one at a time, and the focused suites are required to
 * object for the reason this file declares in advance. A guard that never bites and a guard that
 * never fires look identical from the outside; this is the difference.
 *
 * The four that matter most:
 *
 *   B1 narrows `withDecryptedSecret`. One line, and a machine principal could open any live
 *      credential of its tenant. Every other rule in the firewall would still pass.
 *
 *   B4 removes the XOR provenance CHECK from the MIGRATION — not from the schema module, which the
 *      harness never reads. This is the constraint the whole phase rests on.
 *
 *   B6 makes the machine writer borrow the acting human's id instead of writing NULL. The row would
 *      look complete and would be a lie.
 *
 *   B9 counts human observations against the cadence ceiling. The authorization would silently
 *      become retroactive, governing acts performed before it existed.
 *
 * A proof whose child run is killed is VOID and reported as such — never counted as a bite.
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

const HISTORY = "src/features/provider-observation-history";
const COMPOSITION = `${HISTORY}/observe-once-under-authorization.server.ts`;
const DISPATCH = `${HISTORY}/observe-authorized-subject.server.ts`;
const WRITER = `${HISTORY}/write-provider-observation.server.ts`;
const READER = `${HISTORY}/read-provider-observations.server.ts`;
const CREDENTIALS = "src/features/integration-credentials/credential-repository.server.ts";
const REVALIDATOR =
  "src/features/standing-observation-authority/revalidate-standing-observation.server.ts";
/* The artefact the disposable harness actually applies. See B4. */
const MIGRATION = "src/db/migrations/20260908072926_trh24_machine_observation_provenance.sql";

const FIREWALL = "tests/trh24-machine-observation/authority-firewall.ts";
const POSTGRES = "tests/trh24-machine-observation/observation-postgres.ts";
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
  /* ── THE CREDENTIAL BOUNDARY ─────────────────────────────────────────────── */
  {
    label: "B1 `withDecryptedSecret` is narrowed, so a machine could open any credential",
    file: CREDENTIALS,
    edits: [
      {
        find: "export async function withDecryptedSecret<T>(\n  tenant: TenantContext | null,",
        replace:
          'export async function withDecryptedSecret<T>(\n  tenant: Pick<TenantContext, "tenantId"> | null,',
      },
    ],
    suite: FIREWALL,
    because: "`withDecryptedSecret` STILL takes the branded HUMAN context",
  },
  {
    label: "B2 the narrow opener gains a caller-named credential id",
    file: CREDENTIALS,
    edits: [
      {
        find: "  integrationId: string,\n  kind: IntegrationCredentialKind,\n  scopedOperation: (secret: string) => Promise<T> | T,",
        replace:
          "  integrationId: string,\n  kind: IntegrationCredentialKind,\n  credentialId: string,\n  scopedOperation: (secret: string) => Promise<T> | T,",
      },
    ],
    suite: FIREWALL,
    because: "and NO credential id — the caller cannot name a credential",
  },
  {
    /*
     * PLACED IN THE READER, NOT THE COMPOSITION. The composition is separately forbidden from naming
     * a credential concept at all, so mutating it would trip that earlier rule and prove it twice
     * while leaving the CENSUS untested. The reader has no such ban, so this isolates exactly one
     * property: that only ONE module in `src/` may spend a connection-scoped secret.
     */
    label: "B3 a second module is allowed to spend a connection-scoped secret",
    file: READER,
    edits: [
      {
        find: "export async function readLatestAuthorizedObservationAt(",
        replace:
          "declare const smuggled: typeof import(\n" +
          '  "@/features/integration-credentials/credential-repository.server"\n' +
          ");\n" +
          "export const smuggledSpend = () =>\n" +
          '  smuggled.withConnectionScopedSecret(null, "x", "api_key", () => "");\n\n' +
          "export async function readLatestAuthorizedObservationAt(",
      },
    ],
    suite: FIREWALL,
    /*
     * THE CENSUS GREW TO TWO WITH INSTAGRAM, so the declared reason follows it. The property is
     * unchanged and still bites: a THIRD, unnamed caller of the narrow opener fails the census.
     */
    because: "exactly two modules spend a connection-scoped secret",
  },

  /* ── THE PROVENANCE INVARIANTS, IN THE ARTEFACT THAT IS APPLIED ──────────── */
  {
    /*
     * MUTATE THE MIGRATION, NOT THE SCHEMA MODULE. The disposable harness applies the `.sql` files
     * and never reads `db/schema/*.ts`, so deleting the CHECK from the drizzle definition changes
     * nothing a running database enforces — the suite would pass and this proof would report a bite
     * that never happened. TRH-23 learned this the same way.
     */
    label: "B4 the XOR provenance CHECK is removed from the migration",
    file: MIGRATION,
    edits: [
      {
        find:
          'ALTER TABLE "provider_observations" ADD CONSTRAINT "provider_observations_provenance_mode_chk" ' +
          'CHECK (("provider_observations"."observed_by_actor_type" is not null)::int + ' +
          '("provider_observations"."standing_authorization_id" is not null)::int = 1);',
        replace: 'SELECT 1;',
      },
    ],
    suite: POSTGRES,
    /*
     * THE EARLIEST ASSERTION THIS MUTATION REACHES. The suite censuses the table's CHECK constraints
     * before it tries to violate any of them, so removing one is caught there — several sections
     * before the empty-provenance insert. Declaring the later message would have been asserting a
     * failure this proof never observes.
     */
    because: "three provenance invariants, and no others",
  },
  {
    label: "B5 the partial unique index on the invocation is removed from the migration",
    file: MIGRATION,
    edits: [
      {
        find:
          'CREATE UNIQUE INDEX "provider_observations_invocation_uidx" ON "provider_observations" ' +
          'USING btree ("invocation_id") WHERE "provider_observations"."invocation_id" is not null;',
        replace: "SELECT 1;",
      },
    ],
    suite: POSTGRES,
    because: "and cannot store a second",
  },

  /* ── THE MACHINE ROW MUST NOT INVENT AN ACTOR ────────────────────────────── */
  {
    label: "B6 the machine writer borrows a human actor instead of writing NULL",
    file: WRITER,
    edits: [
      /*
       * RE-AIMED AT THE STATEMENT, NOT THE OBJECT LITERAL (TRH-25 prerequisite). The machine insert
       * became one atomic `insert ... select`, so the two NULLs the row depends on are now bare
       * values in that select list. The mutation is the same lie it always was — borrowing a human
       * id for a read no human performed — and it must still be caught.
       */
      {
        find: "          null, null,",
        replace: "          'human', ${principal.tenantId}::uuid,",
      },
    ],
    suite: FIREWALL,
    because: "a machine observation records NO human actor",
  },
  {
    label: "B7 the machine writer accepts a forged principal without the runtime guard",
    file: WRITER,
    edits: [
      {
        find: '  if (!isObservationPrincipal(principal)) return refused("not-an-observation-principal");',
        replace: "",
      },
    ],
    suite: POSTGRES,
    because: "a manufactured principal cannot file an observation",
  },
  {
    label: "B8 the machine writer takes its scope from the caller instead of the principal",
    file: WRITER,
    edits: [
      /*
       * RE-AIMED AT THE STATEMENT (TRH-25 prerequisite). The scope values are now bound parameters
       * in the atomic insert's select list rather than object properties. Substituting the subject
       * is the same attack: a row filed against a subject the authorization never named.
       */
      {
        find: "${principal.capabilityKey}, ${principal.subjectKind}, ${principal.subjectRef},",
        /* A SQL STRING LITERAL, not a double-quoted identifier: the mutation must substitute the
         * subject, not produce a syntax error that bites for the wrong reason. */
        replace: "${principal.capabilityKey}, ${principal.subjectKind}, 'youtube/channel/UCsubstituted',",
      },
    ],
    suite: POSTGRES,
    because: "the subject is the authorization's, never a caller's",
  },

  /* ── THE CADENCE CEILING ─────────────────────────────────────────────────── */
  {
    label: "B9 human observations are counted against the cadence ceiling",
    file: READER,
    edits: [
      {
        find: "          isNotNull(providerObservations.standingAuthorizationId),\n",
        replace: "",
      },
    ],
    suite: POSTGRES,
    because: "the human baseline is not counted against the authorization's cadence ceiling",
  },
  {
    label: "B10 the cadence ceiling is dropped from the authoritative check",
    file: REVALIDATOR,
    edits: [
      {
        find: '      return { status: "refused", reason: "observed-too-recently" };',
        replace: "",
      },
    ],
    suite: POSTGRES,
    because: "a second read inside the interval is refused",
  },
  /*
   * THERE IS NO B11, AND THE ABSENCE IS DELIBERATE.
   *
   * The revalidator FAILS CLOSED when the observation history cannot be read — "we could not find
   * out when this was last observed" must not become "it was never observed". That branch is real
   * and is stated in the source, but proving it by mutation needs fault injection into one query of
   * a shared database handle, and every mechanism for that is brittle enough to break on an
   * unrelated refactor and then be quietly deleted.
   *
   * A proof that would rot is worse than an honest gap, so the gap is recorded here instead of a
   * mutation that would pass for the wrong reason.
   */

  /* ── THE AUTHORITATIVE CHECK STILL RUNS BEFORE TRANSPORT ─────────────────── */
  {
    label: "B12 the composition reaches the provider without revalidating",
    file: COMPOSITION,
    edits: [
      {
        find: '  if (authorized.status !== "authorized") return { status: "refused", reason: authorized.reason };',
        replace: "",
      },
    ],
    suite: POSTGRES,
    /*
     * THE GUARD IS ON THE ONLY PATH TO TRANSPORT, AND THIS IS WHAT THAT LOOKS LIKE.
     *
     * Deleting it does not produce a wrong observation — it produces code that CANNOT PROCEED,
     * because everything downstream reads the revalidated value and there is no other source for it.
     * A crash before the provider is contacted is a stronger property than a caught mistake: it
     * means no path to the provider exists that skips the authoritative check.
     */
    /*
     * THE CRASH MOVED ONE FIELD, and the property did not. It used to be `subjectRef` — the
     * composition parsed the subject itself. Since the dispatch, the first thing read off the
     * revalidated value is `tenantId`, inside the dispatch's own scope object. Deleting the guard
     * still cannot reach a provider; it just fails one line earlier.
     */
    because: "Cannot read properties of undefined (reading 'tenantId')",
  },
  {
    label: "B13 the composition records an observation even when the provider failed",
    file: COMPOSITION,
    edits: [
      {
        /*
         * RE-AIMED, SAME PROPERTY. The composition used to inspect the provider result itself
         * (`if (!read.ok)`); since the dispatch it inspects the dispatch's outcome instead. Ignoring
         * a failure still leaves nothing to record.
         */
        find: '  if (dispatched.status === "provider-failed") {',
        replace: "  if (false) {",
      },
    ],
    suite: POSTGRES,
    /*
     * Same shape as the mutation above. Ignoring the provider's failure leaves nothing to record, so
     * the composition cannot reach the writer at all — there is no synthetic observation for it to
     * store, which is why "record a failure as an observation" is not a mistake this code can make.
     */
    /*
     * THE FAILURE MODE MOVED FROM A CRASH TO A REFUSAL, and that is an improvement worth recording.
     * The composition used to dereference a provider result it had not checked; now it carries a
     * typed outcome, so ignoring the failure branch means the suite's own "the provider did not
     * answer" assertion is what catches it. Still no synthetic observation, still no write.
     */
    because: "the provider did not answer",
  },
  {
    label: "B14 the read uses a substituted subject instead of the authorized one",
    file: DISPATCH,
    edits: [
      {
        find: "    (apiKey) => observeChannelById(apiKey, channelId, deps),",
        replace: '    (apiKey) => observeChannelById(apiKey, "UCsomethingelse", deps),',
      },
    ],
    suite: POSTGRES,
    /*
     * The provider fixture answers only for the AUTHORIZED channel id, so a substituted subject
     * comes back as "no such channel" and the read fails — which is the honest consequence, and the
     * message the suite actually prints.
     */
    because: "one authorized machine read succeeds",
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
   * naming the secret opener inside the composition must therefore be tolerated.
   */
  {
    label: "C1 the composition NAMES the secret opener in a comment explaining why it is not called",
    file: COMPOSITION,
    edits: [
      {
        find: "export async function observeOnceUnderAuthorization(",
        replace:
          "/* withDecryptedSecret and credentialId are deliberately unreachable from here. */\n" +
          "export async function observeOnceUnderAuthorization(",
      },
    ],
    suite: FIREWALL,
    why: "the rules read code with comments stripped, so prose naming the opener changes nothing",
  },
  /*
   * C2 — A NARROWER CADENCE IS NOT A WEAKENING.
   *
   * The authorization's ceiling may be raised by a Governance revision without any code moving. If
   * this is rejected, the ceiling has been wired to a constant somewhere instead of being read from
   * the row it belongs to.
   */
  {
    label: "C2 the revalidator's cadence arithmetic is re-spelled without changing what it permits",
    file: REVALIDATOR,
    edits: [
      {
        find: "if (!Number.isFinite(since) || since < current.intervalMinutes * 60_000) {",
        replace: "if (!Number.isFinite(since) || since / 60_000 < current.intervalMinutes) {",
      },
    ],
    suite: POSTGRES,
    why: "the ceiling still comes from the authorization row and still permits exactly the same reads",
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
    `trh24-machine-observation/bite-proofs: ${bitten} mutations bit, ${ACCEPTED.length} tolerated ` +
      `changes accepted, 0 void`,
  );
}

main();
