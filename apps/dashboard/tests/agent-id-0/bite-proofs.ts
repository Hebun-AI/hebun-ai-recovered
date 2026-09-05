/*
 * AGENT-ID-0 — BITE PROOFS.
 *
 * A guard nobody has watched fail is a guard nobody has evidence for. Each proof makes ONE targeted
 * change to real source, runs the suite that is supposed to object, and requires four things: the
 * anchor was UNIQUE, the mutation APPLIED, the suite FAILED FOR THE INTENDED REASON, and the file
 * came back byte-identical by sha256.
 *
 * Anchor uniqueness is not decoration. `String.replace` takes the FIRST match, so an anchor that
 * occurs twice mutates a line nobody meant to mutate and proves something nobody meant to prove.
 *
 * A proof whose child run is killed is VOID and reported as such — never counted as a bite. A
 * timeout is the absence of a verdict, not a verdict.
 *
 * Expected reasons are PRODUCT REASON CODES or EXPLICIT assertion messages. Never a bare English
 * word, and never a string that a message-less assertion would echo from its own source.
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

const AUTHORITY = "src/features/agent-identity/create-durable-agent-identity.server.ts";
const CONTRACTS = "src/features/agent-identity/contracts.ts";
const STORAGE_MANAGER = "src/features/persistence/storage-manager.ts";
const GOVERNANCE = "src/features/governance-decision/contracts.ts";
const PERMIT_MIGRATION = "src/db/migrations/20260816063156_r3a_action_authorization.sql";

const PG_SUITE = "tests/agent-id-0/identity-postgres.ts";
const FW_SUITE = "tests/agent-id-0/boundaries-and-firewall.ts";

const CHILD_TIMEOUT_MS = 240_000;

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
  /* A kill leaves `signal` set and `status` null. Neither is an assertion result. */
  const killed = result.signal !== null || result.status === null;
  return { ok: result.status === 0, void: killed, output };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  /* ── THE ONE-SHOT ────────────────────────────────────────────────────────── */
  {
    label: "M1 a tenant may possess many first identities",
    file: AUTHORITY,
    suite: PG_SUITE,
    find:
      '    if ((existing?.total ?? 0) > 0) {\n' +
      '      return { status: "refused" as const, reason: "agent-identity-already-exists" as const };\n' +
      "    }",
    replace: "    /* mutated: existence no longer refuses */",
    because: "agent-identity-already-exists",
  },
  {
    label: "M2 the count is trusted without serializing the ceremony",
    file: AUTHORITY,
    suite: PG_SUITE,
    find: "    await tx.execute(sql.raw(`lock table agents in ${AGENT_IDENTITY_LOCK_MODE} mode`));",
    replace: "    /* mutated: the answer is believed while it is still going stale */",
    because: "six simultaneous ceremonies produce exactly one identity",
  },
  {
    label: "M3 the one-shot stops being tenant-scoped",
    file: AUTHORITY,
    suite: PG_SUITE,
    find: "      .where(eq(agents.tenantId, tenant.tenantId));",
    replace: "      .where(sql`true`);",
    because: "the one-shot is tenant-scoped",
  },
  /* ── OWNERSHIP ───────────────────────────────────────────────────────────── */
  {
    label: "M4 ownership may name a human who does not exist",
    file: AUTHORITY,
    suite: PG_SUITE,
    find:
      "    if (owner.length === 0) {\n" +
      '      return { status: "refused" as const, reason: "human-owner-unresolved" as const };\n' +
      "    }",
    replace: "    /* mutated: any uuid is an owner */",
    because: "human-owner-unresolved",
  },
  {
    label: "M5 the agent is written without a human owner",
    file: AUTHORITY,
    suite: PG_SUITE,
    find: '        humanOwnerType: "human",\n        humanOwnerId: tenant.userId,\n',
    replace: "        /* mutated: the identity is ownerless */\n",
    because: "the six persisted facts are the tenant, the name, the human owner pair",
  },
  {
    label: "M6 the creator of the agent is not recorded",
    file: AUTHORITY,
    suite: PG_SUITE,
    find: '        createdByType: "human",\n',
    replace: "        /* mutated: nobody created this agent */\n",
    because: "the six persisted facts are the tenant, the name, the human owner pair",
  },
  /* ── THE NAME IS ACCEPTED AS GIVEN OR REFUSED ────────────────────────────── */
  {
    label: "M7 a name of any length is a name",
    file: CONTRACTS,
    suite: PG_SUITE,
    find: "  if (value.length === 0 || value.length > MAX_AGENT_NAME_LENGTH) return false;",
    replace: "  /* mutated: length is not a property of a name */",
    because: "a malformed name is refused rather than repaired",
  },
  {
    label: "M8 a padded name is accepted",
    file: CONTRACTS,
    suite: PG_SUITE,
    find: "  return value.trim() === value;",
    replace: "  return true;",
    because: "a malformed name is refused rather than repaired",
  },
  /* ── WHAT THE PHASE MUST NOT BECOME ──────────────────────────────────────── */
  {
    label: "M9 the caller may name the tenant",
    file: AUTHORITY,
    suite: FW_SUITE,
    find: "  input: { readonly name: unknown },",
    replace: "  input: { readonly name: unknown; readonly tenantId?: string },",
    because: "the only caller-supplied field is the name",
  },
  {
    label: "M10 the authority reaches the generic persistence substrate",
    file: AUTHORITY,
    suite: FW_SUITE,
    find: 'import { agents } from "@/db/schema/agent";',
    replace:
      'import { agents } from "@/db/schema/agent";\n' +
      'import { createPostgresAdapter } from "@/features/persistence/supabase-postgres-adapter";',
    because: "the passive substrate is not agent identity authority",
  },
  {
    label: "M11 a lifecycle status is invented for the new agent",
    file: AUTHORITY,
    suite: FW_SUITE,
    /* The anchor carries the un-`as const` owner line: the returned identity object repeats the
     * first two fields verbatim, and an anchor of those alone occurs twice. */
    find: '        name,\n        humanOwnerType: "human",\n',
    replace: '        name,\n        agentLifecycleStatus: "active",\n        humanOwnerType: "human",\n',
    because: "`agentLifecycleStatus` is not written",
  },
  {
    label: "M12 generic agent CRUD is silently made durable",
    file: STORAGE_MANAGER,
    suite: FW_SUITE,
    find: 'const ACTIVE_PROVIDER: StorageProvider = "memory";',
    replace: 'const ACTIVE_PROVIDER: StorageProvider = "postgres";',
    because: "generic agent CRUD is still memory-backed",
  },
  {
    label: "M13 an agent becomes a governance subject",
    file: GOVERNANCE,
    suite: FW_SUITE,
    find:
      'export const GOVERNANCE_SUBJECT_TYPES: readonly GovernanceSubjectType[] = [\n  "knowledge_node",\n  "work_artifact_revision",\n];',
    replace:
      "export const GOVERNANCE_SUBJECT_TYPES: readonly GovernanceSubjectType[] = [\n" +
      '  "knowledge_node",\n' +
      '  "agent" as GovernanceSubjectType,\n' +
      "];",
    because: "an agent is not a governance subject",
  },
  {
    label: "M14 a human-only authorization CHECK is weakened",
    file: PERMIT_MIGRATION,
    suite: FW_SUITE,
    find:
      '\tCONSTRAINT "action_permits_human_authorizer_chk" CHECK ("action_permits"."authorized_by_actor_type" = \'human\'),',
    replace: '\tCONSTRAINT "action_permits_any_authorizer_chk" CHECK (true),',
    because: "`action_permits_human_authorizer_chk` still exists",
  },
];

/** Behaviour-preserving. The suite must ACCEPT it, or the assertions test spelling, not rules. */
const ACCEPTED = {
  label: "A1 the empty-name test is written as a length comparison — identical behaviour",
  file: CONTRACTS,
  suite: PG_SUITE,
  find: "  if (value.length === 0 || value.length > MAX_AGENT_NAME_LENGTH) return false;",
  replace: "  if (value.length < 1 || value.length > MAX_AGENT_NAME_LENGTH) return false;",
} as const;

let bitten = 0;
const voided: string[] = [];

function withMutation(
  label: string,
  file: string,
  find: string,
  replace: string,
  body: () => void,
): void {
  const original = read(file);
  const before = sha(original);

  /* THE ANCHOR MUST BE UNIQUE. `replace` takes the first match; two matches is a different proof. */
  const occurrences = original.split(find).length - 1;
  assert.equal(
    occurrences,
    1,
    `${label}: the mutation anchor must appear exactly once in ${file}, found ${occurrences} — ` +
      `a non-unique anchor mutates a line the proof did not choose`,
  );

  try {
    writeFileSync(abs(file), original.replace(find, replace), "utf8");
    assert.notEqual(
      sha(read(file)),
      before,
      `${label}: the mutation did not reach ${file} — the proof would be vacuous`,
    );
    body();
  } finally {
    writeFileSync(abs(file), original, "utf8");
    assert.equal(
      sha(read(file)),
      before,
      `${label}: ${file} was not restored byte-identically`,
    );
  }
}

function main(): void {
  for (const mutation of MUTATIONS) {
    withMutation(mutation.label, mutation.file, mutation.find, mutation.replace, () => {
      const run = runSuite(mutation.suite);
      if (run.void) {
        voided.push(mutation.label);
        return;
      }
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the suite still PASSED — the guard it targets does not bite`,
      );
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

  withMutation(ACCEPTED.label, ACCEPTED.file, ACCEPTED.find, ACCEPTED.replace, () => {
    const run = runSuite(ACCEPTED.suite);
    assert.equal(run.void, false, `${ACCEPTED.label}: the control run was killed — VOID, not a pass`);
    assert.ok(
      run.ok,
      `${ACCEPTED.label}: a behaviour-preserving change was REJECTED — the suite tests the ` +
        `spelling rather than the rule.\n--- actual ---\n${run.output.slice(-2000)}`,
    );
  });
  console.log(`ACCEPT ${ACCEPTED.label}`);

  assert.deepEqual(voided, [], `these proofs were VOID (child killed), not passes: ${voided.join(", ")}`);
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(
    `agent-id-0/bite-proofs: ${bitten} mutations bit, 1 correct change accepted, 0 void`,
  );
}

main();
