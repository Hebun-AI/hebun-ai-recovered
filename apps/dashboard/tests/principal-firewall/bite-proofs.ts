/*
 * PRINCIPAL-FW-1 — BITE PROOFS.
 *
 * A firewall made of types is the easiest kind to believe and the hardest to see fail, because
 * nothing about it executes. So each property is removed from real source, one at a time, and the
 * focused suite is required to object for the reason this file declares in advance.
 *
 * Two of these mutations are the ones that matter:
 *
 *   B2 forges a `TenantContext` from an object literal in an ordinary feature module. That is the
 *      exact move the brand exists to prevent, and it must not be quietly tolerated because the
 *      forging module happens to import the type legitimately for other reasons.
 *
 *   B5 has the PRE-TENANT path mint an authority projection. Nothing in the authorized path would
 *      look wrong; the lie would live in the branch that is supposed to represent an authenticated
 *      human who has been granted nothing.
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

const CONTRACT = "src/features/auth/tenant/tenant-context.ts";
const PRODUCER = "src/features/auth-runtime/session-service.server.ts";
const ORDINARY = "src/features/knowledge/knowledge-write-authority.server.ts";

const SUITE = "tests/principal-firewall/human-tenant-context.ts";
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
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  /* ── THE BRAND ITSELF ────────────────────────────────────────────────────── */
  {
    label: "B1 the nominal marker is removed and TenantContext becomes forgeable by shape",
    file: CONTRACT,
    edits: [{ find: "  readonly [humanTenantContextBrand]: true;\n", replace: "" }],
    because: "`TenantContext` carries the marker, so an object with the right fields is still not one",
  },
  {
    label: "B1b the marker is exported, so any module can supply it",
    file: CONTRACT,
    edits: [
      {
        find: "declare const humanTenantContextBrand: unique symbol;",
        replace: "export declare const humanTenantContextBrand: unique symbol;",
      },
    ],
    because: "the nominal marker is NOT exported",
  },

  /* ── FORGERY FROM AN ORDINARY MODULE ─────────────────────────────────────── */
  {
    label: "B2 an ordinary feature module manufactures a TenantContext from a literal",
    file: ORDINARY,
    edits: [
      {
        find: "export async function resolveKnowledgeWriteAuthority(",
        replace:
          "const forged = {\n" +
          "  tenantId: \"t\",\n" +
          "} as TenantContext;\n" +
          "void forged;\n\n" +
          "export async function resolveKnowledgeWriteAuthority(",
      },
    ],
    because: "no module manufactures a `TenantContext` from a literal or launders one through `unknown`",
  },

  /* ── A SECOND MINT CALLER ────────────────────────────────────────────────── */
  {
    label: "B3 a second production module mints an authority projection",
    file: ORDINARY,
    edits: [
      {
        find: "export async function resolveKnowledgeWriteAuthority(",
        replace:
          "declare const secondMintFields: never;\n" +
          "export const secondMint = () => asHumanTenantContext(secondMintFields);\n\n" +
          "export async function resolveKnowledgeWriteAuthority(",
      },
    ],
    because: "exactly one production module mints an authority projection",
  },

  /* ── THE AUTHORIZATION THAT EARNS THE PROJECTION ─────────────────────────── */
  {
    label: "B4 an authenticated human with no role is handed an authority projection",
    file: PRODUCER,
    edits: [
      {
        find: "  if (!membership.roleId) {",
        replace: "  if (false) {",
      },
    ],
    because: "the producer still requires an authorizing role",
  },

  /* ── THE PRE-TENANT PATH ─────────────────────────────────────────────────── */
  {
    label: "B5 the pre-tenant path mints an authority projection for an unauthorized human",
    file: PRODUCER,
    edits: [
      {
        find: "  const expiresAt = new Date(now.getTime() + PRE_TENANT_SESSION_TTL_SECONDS * 1000);",
        replace:
          "  const expiresAt = new Date(now.getTime() + PRE_TENANT_SESSION_TTL_SECONDS * 1000);\n" +
          "  const leaked = asHumanTenantContext({} as TenantContextFields);\n" +
          "  void leaked;",
      },
    ],
    because: "the pre-tenant path mints no authority projection — authenticated is not authorized",
  },
];

interface AcceptedChange {
  readonly label: string;
  readonly file: string;
  readonly edits: readonly Edit[];
  readonly why: string;
}

const ACCEPTED: readonly AcceptedChange[] = [
  /*
   * C1 — PROSE IS NOT CODE.
   *
   * Every rule here reads source with comments stripped, because this repository has repeatedly
   * been bitten by firewalls that failed on an honest explanation naming the thing it forbids. A
   * comment mentioning the marker in another module must therefore be tolerated. If this is
   * rejected, the suite is policing vocabulary rather than behaviour.
   */
  {
    label: "C1 another module NAMES the nominal marker in a comment",
    file: ORDINARY,
    edits: [
      {
        find: "export async function resolveKnowledgeWriteAuthority(",
        replace:
          "/* humanTenantContextBrand is deliberately unreachable from here. */\n" +
          "export async function resolveKnowledgeWriteAuthority(",
      },
    ],
    why: "the rules read code with comments stripped, so prose naming the marker changes nothing",
  },
  /*
   * C2 — THE RULE READS THE WHOLE TYPE, NOT ITS FIRST IDENTIFIER.
   *
   * An earlier attempt at this control replaced `Pick<TenantContext, "tenantId">` with a bare
   * `{ readonly tenantId: string }` and was REJECTED — correctly. That module also reads
   * `tenant.userId` at another function, so it attributes a human, and stripping `TenantContext`
   * out of its parameter really would remove the principal. The control was wrong, not the rule.
   *
   * This is the honest version: wrap the same type. It still derives from `TenantContext`, still
   * grants exactly as much, and must therefore be tolerated. If it is rejected, the rule is pinning
   * type SPELLING rather than whether the parameter derives from the branded authority.
   */
  {
    label: "C2 an audit writer's tenant parameter is re-spelled without changing what it grants",
    file: "src/features/governance-audit/knowledge-mutation-audit.server.ts",
    edits: [
      {
        find: '  tenant: Pick<TenantContext, "tenantId"> | null,',
        replace: '  tenant: Readonly<Pick<TenantContext, "tenantId">> | null,',
      },
    ],
    why: "the parameter still derives from `TenantContext` and grants exactly the same thing",
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
      const run = runSuite(SUITE);
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
      const run = runSuite(SUITE);
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
    `principal-firewall/bite-proofs: ${bitten} mutations bit, ${ACCEPTED.length} tolerated changes accepted, 0 void`,
  );
}

main();
