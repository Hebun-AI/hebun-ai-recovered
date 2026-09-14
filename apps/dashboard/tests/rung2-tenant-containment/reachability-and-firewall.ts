/*
 * RUNG 2 PREREQUISITE — TENANT CONTAINMENT (pure + structural, no database).
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Machine execution is reachable for a tenant only when that tenant's Governance enrolled it AND
 *    the deployment operator armed the root control — the two authorities stay separate, a tenant
 *    withdrawal never reads as an operator stop, and no automatic trigger was introduced."
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { resolveMachineExecutionReachability } from "../../src/features/tenant-machine-execution-authority/resolve-machine-execution-reachability.server";
import {
  TENANT_MACHINE_EXECUTION_AUTHORIZED_OUTCOME,
  TENANT_MACHINE_EXECUTION_DOMAIN,
  TENANT_MACHINE_EXECUTION_SUBJECT_TYPE,
  TENANT_MACHINE_EXECUTION_WITHDRAWN_OUTCOME,
} from "../../src/features/tenant-machine-execution-authority/contracts";
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "../../src/features/governed-machine-execution/contracts";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const RESOLVER = "src/features/tenant-machine-execution-authority/resolve-machine-execution-reachability.server.ts";
const WRITER = "src/features/tenant-machine-execution-authority/authorize-tenant-machine-execution.server.ts";
const READER = "src/features/tenant-machine-execution-authority/read-tenant-machine-execution.server.ts";
const EXECUTOR = "src/features/governed-machine-execution/execute-record-work-as-machine.server.ts";
const ROOT_CONTROL_SCHEMA = "src/db/schema/provider-connectivity-control.ts";

const TENANT = "9947c78e-2080-4331-81c6-456cb4be7a96";
const OTHER_TENANT = "f625b683-3be5-40eb-93a4-53fc56ab38c9";
const CAP = RECORD_WORK_ACTION_KIND;

const active = {
  authorizationId: "11111111-1111-4111-8111-111111111111",
  tenantId: TENANT,
  capabilityKey: CAP,
  authorizationRevision: 1,
  state: "active" as const,
  authorizedByActorId: "d5b496df-588c-49c5-9cc2-17672b82dd10",
  governanceDecisionId: "22222222-2222-4222-8222-222222222222",
  governanceSessionId: "33333333-3333-4333-8333-333333333333",
  authorizedAt: new Date().toISOString(),
};

const reachWith = (
  tenantRead: unknown,
  rootEnabled: boolean,
  tenantId = TENANT,
  capability: string = CAP,
) =>
  resolveMachineExecutionReachability(tenantId, capability, {
    readTenant: async () => tenantRead as never,
    rootEnabled: async () => rootEnabled,
  });

async function main(): Promise<void> {
  /* ── 1. THE FULL REACHABILITY MATRIX ──────────────────────────────────────── */
  {
    /* The ONLY true. */
    assert.equal(
      (await reachWith({ status: "read", effective: active }, true)).status,
      "reachable",
      "tenant enrolled AND root armed is the one combination that permits anything",
    );

    const cases: ReadonlyArray<readonly [string, unknown, boolean, string]> = [
      ["tenant active + root DISABLED", { status: "read", effective: active }, false, "root-control-disabled"],
      ["tenant ABSENT + root enabled", { status: "absent" }, true, "tenant-not-authorized"],
      ["tenant ABSENT + root disabled", { status: "absent" }, false, "tenant-not-authorized"],
      [
        "tenant WITHDRAWN + root enabled",
        { status: "read", effective: { ...active, state: "withdrawn", authorizationRevision: 2 } },
        true,
        "tenant-authorization-withdrawn",
      ],
      [
        "tenant WITHDRAWN + root disabled",
        { status: "read", effective: { ...active, state: "withdrawn", authorizationRevision: 2 } },
        false,
        "tenant-authorization-withdrawn",
      ],
      ["persistence UNAVAILABLE + root enabled", { status: "unavailable" }, true, "persistence-unavailable"],
      ["persistence UNAVAILABLE + root disabled", { status: "unavailable" }, false, "persistence-unavailable"],
    ];

    for (const [label, tenantRead, rootEnabled, expected] of cases) {
      const verdict = await reachWith(tenantRead, rootEnabled);
      assert.equal(verdict.status, "refused", `${label} must refuse`);
      assert.equal(
        verdict.status === "refused" && verdict.reason,
        expected,
        `${label} refuses as ${expected}`,
      );
    }
  }

  /* ── 2. A WITHDRAWAL IS NEVER DISGUISED AS AN OPERATOR STOP ───────────────── */
  {
    /*
     * TRH-25's rule, applied: "the more specific one must win — a disabled switch must never be able
     * to disguise a withdrawal." Both cases below have the root switch OFF; the tenant's own fact is
     * still what the caller is told.
     */
    const withdrawn = await reachWith(
      { status: "read", effective: { ...active, state: "withdrawn", authorizationRevision: 2 } },
      false,
    );
    const never = await reachWith({ status: "absent" }, false);
    assert.equal(withdrawn.status === "refused" && withdrawn.reason, "tenant-authorization-withdrawn");
    assert.equal(never.status === "refused" && never.reason, "tenant-not-authorized");
    assert.notEqual(
      withdrawn.status === "refused" && withdrawn.reason,
      never.status === "refused" && never.reason,
      "'they took it back' and 'nobody ever agreed' stay different facts",
    );
  }

  /* ── 3. NO CAPABILITY OUTSIDE THE FROZEN SET IS EVER REACHABLE ────────────── */
  {
    for (const capability of [
      "",
      "   ",
      "send-external-communication",
      "place-human",
      "record_work",
      "RECORD-WORK",
      "record-work-v2",
      "anything-a-later-phase-adds",
    ]) {
      const verdict = await reachWith({ status: "read", effective: active }, true, TENANT, capability);
      assert.equal(
        verdict.status === "refused" && verdict.reason,
        "unsupported-machine-capability",
        `"${capability}" is refused before any permission is consulted`,
      );
    }
    /* And the refusal comes FIRST — an unsupported capability never consults either authority. */
    let consulted = false;
    await resolveMachineExecutionReachability(TENANT, "send-external-communication", {
      readTenant: async () => {
        consulted = true;
        return { status: "read", effective: active } as never;
      },
      rootEnabled: async () => {
        consulted = true;
        return true;
      },
    });
    assert.equal(consulted, false, "neither authority is read for a capability no machine may run");

    assert.deepEqual([...MACHINE_EXECUTABLE_ACTION_KINDS], [RECORD_WORK_ACTION_KIND], "still one member");
    assert.ok(Object.isFrozen(MACHINE_EXECUTABLE_ACTION_KINDS));
  }

  /* ── 4. ONE TENANT'S GRANT CANNOT SATISFY ANOTHER ─────────────────────────── */
  {
    /*
     * The reader is asked for the tenant the caller forwarded. A grant belonging to a DIFFERENT
     * tenant must never satisfy this one, and the resolver proves it by passing the id through
     * unchanged — so a reader that ignored it would be the only way to cross tenants.
     */
    let askedFor: string | null = null;
    await resolveMachineExecutionReachability(OTHER_TENANT, CAP, {
      readTenant: async (tenantId: string) => {
        askedFor = tenantId;
        return { status: "absent" } as never;
      },
      rootEnabled: async () => true,
    });
    assert.equal(askedFor, OTHER_TENANT, "the tenant asked about is the tenant the caller forwarded");
  }

  /* ── 5. THE RESOLVER OWNS NO STATE AND WRITES NOTHING ─────────────────────── */
  {
    const code = codeOf(read(RESOLVER)).toLowerCase();
    for (const forbidden of [
      "insert into",
      "update ",
      "delete from",
      ".insert(",
      ".update(",
      ".delete(",
      "transaction(",
      "provider_connectivity_controls",
      "tenant_machine_execution_authorizations",
      "setproviderconnectivity",
      "cache",
      "fetch(",
    ]) {
      assert.ok(!code.includes(forbidden), `the composition must not reach ${forbidden.trim()}`);
    }
    /* It calls the two RELEASED readers and adds no third source of truth. */
    assert.match(code, /resolvemachineinternalexecutionenabled/i);
    assert.match(code, /readeffectivetenantmachineexecution/i);
  }

  /* ── 6. THE ROOT CONTROL STAYS ROOT-SCOPED ────────────────────────────────── */
  {
    const schema = read(ROOT_CONTROL_SCHEMA);
    assert.match(schema, /\.\.\.rootColumns/, "the root control still spreads rootColumns");
    assert.ok(
      !/tenantColumns|tenantId:\s*uuid\("tenant_id"\)/.test(schema),
      "and gained NO tenant dimension — its identity is unchanged",
    );
    assert.match(
      schema,
      /uniqueIndex\("provider_connectivity_controls_provider_key_uq"\)\.on\(t\.providerKey\)/,
      "its unique identity is still provider_key ALONE",
    );
  }

  /* ── 7. NO SECOND SWITCH, NO TRIGGER, NO CRON ─────────────────────────────── */
  {
    /* The deployment configures exactly one cron, and it is TRH-25's observation scan. */
    const vercel = JSON.parse(read("vercel.json")) as { crons?: { path: string }[] };
    assert.deepEqual(
      (vercel.crons ?? []).map((c) => c.path),
      ["/api/observation/scan"],
      "this phase adds no cron — the only one is TRH-25's observation scan",
    );

    /* No execution ingress route exists. */
    assert.ok(
      !existsSync(path.join(ROOT, "src/app/api/execution")),
      "no /api/execution ingress was introduced",
    );

    /* The middleware admits exactly one machine ingress, unchanged. */
    const middleware = codeOf(read("src/middleware.ts"));
    assert.match(
      middleware,
      /MACHINE_INGRESS_PATHS = \["\/api\/observation\/scan"\]/,
      "the machine ingress allowlist is unchanged",
    );

    /* The new authority contains no scanner, timer or schedule of any kind. */
    const dir = "src/features/tenant-machine-execution-authority";
    for (const file of readdirSync(path.join(ROOT, dir))) {
      const code = codeOf(read(path.join(dir, file))).toLowerCase();
      for (const forbidden of ["setinterval", "settimeout", "cron", "schedule", "scan", "queue", "worker"]) {
        assert.ok(!code.includes(forbidden), `${file} must not contain ${forbidden}`);
      }
    }
  }

  /* ── 8. THE WRITER REQUIRES GOVERNANCE, AND A HUMAN ───────────────────────── */
  {
    const code = codeOf(read(WRITER));
    assert.match(code, /resolveGovernanceAuthority/, "the ONE released resolver decides who may write");
    assert.match(code, /authority\.bootstrapDecisionId/, "no Governance authority at all is refused");
    assert.match(code, /authority\.authorized/, "and the wrong human is refused too");
    assert.match(code, /authorizedByActorType: "human"/, "the row names a human");
    assert.match(code, /writeGovernanceDecisionWithin/, "a Governance decision authorizes the row");
    assert.match(code, /recordGovernanceEventWithin/, "and an audit event records it");

    /* The tenant comes from the authenticated context, never from the input. */
    assert.match(code, /tenantId: authenticated\.tenantId/, "the tenant is the authenticated one");
    assert.ok(
      !/input\.tenantId|input\?\.tenantId/.test(code),
      "there is no input field through which a caller could name a tenant",
    );

    /* No possession shortcut may reach this authority. */
    const lower = code.toLowerCase();
    for (const forbidden of [
      "possession",
      "hebun_production_ceremony",
      "setproviderconnectivity",
      "ceremony-preflight",
      "process.env",
    ]) {
      assert.ok(!lower.includes(forbidden), `the writer must not reach ${forbidden}`);
    }

    /* It authorizes no act and executes nothing. */
    for (const forbidden of ["action_permits", "consumeactionpermit", "executerecordwork", "work_items"]) {
      assert.ok(!lower.includes(forbidden), `enrolment must not touch ${forbidden}`);
    }
  }

  /* ── 9. THE MACHINE READ SEAM REFUSES A TenantContext SHAPE ───────────────── */
  {
    const code = codeOf(read(READER));
    assert.ok(
      !/TenantContext/.test(code),
      "the runtime reader takes a bare tenant id — it cannot manufacture a human session",
    );
    const lower = code.toLowerCase();
    for (const forbidden of ["insert into", ".insert(", ".update(", ".delete(", "transaction("]) {
      assert.ok(!lower.includes(forbidden), `the reader must not ${forbidden}`);
    }
    /* Unavailable is never collapsed into absent. */
    assert.match(code, /status: "unavailable"/);
    assert.match(code, /status: "absent"/);
  }

  /* ── 10. THE EXECUTOR REVALIDATES, AND NOTHING WAS REMOVED ────────────────── */
  {
    const code = codeOf(read(EXECUTOR));

    /* RUNG 1's prerequisites all still stand. */
    assert.match(code, /machine-execution-disarmed/, "the early arming read is still there");
    assert.match(code, /MACHINE_EXECUTABLE_ACTION_KINDS\.has\(principal\.actionKind\)/);
    assert.match(code, /minted\.status !== "minted"/, "the principal mint still gates");

    /* And the tenant boundary is checked BEFORE the spend, using the permit's OWN tenant. */
    assert.match(
      code,
      /resolveMachineExecutionReachability\)\(\s*principal\.tenantId,\s*principal\.actionKind,/,
      "reachability is resolved from the PRINCIPAL's tenant — never from an argument",
    );
    const reach = code.indexOf("resolveMachineExecutionReachability");
    const consume = code.indexOf("consume(");
    assert.ok(reach > -1 && consume > reach, "and it is resolved BEFORE the permit is spent");

    /* There is no way for a caller to assert reachability. */
    assert.ok(
      !/enabled\s*[:=]\s*true|reachable\s*[:=]\s*true/.test(code),
      "no caller-supplied 'already checked' flag exists",
    );
  }

  /* ── 11. THE LEDGER VOCABULARY IS ITS OWN ─────────────────────────────────── */
  {
    assert.equal(TENANT_MACHINE_EXECUTION_DOMAIN, "machine-execution");
    assert.equal(TENANT_MACHINE_EXECUTION_SUBJECT_TYPE, "tenant_machine_execution_authorization");
    assert.notEqual(TENANT_MACHINE_EXECUTION_AUTHORIZED_OUTCOME, TENANT_MACHINE_EXECUTION_WITHDRAWN_OUTCOME);

    /* The decision authority matches on SUBJECT before either generic branch. */
    const authority = codeOf(read("src/features/governance-decision/decision-authority.server.ts"));
    const subjectAt = authority.indexOf("TENANT_MACHINE_EXECUTION_SUBJECT_TYPE");
    assert.ok(subjectAt > -1, "the subject is matched explicitly");
    assert.match(
      authority,
      /input\.subjectType === TENANT_MACHINE_EXECUTION_SUBJECT_TYPE\s*\?\s*TENANT_MACHINE_EXECUTION_DOMAIN/,
      "enrolment is filed in its own domain, never membership-authorization",
    );
  }

  console.log("rung2 tenant containment: reachability and firewall checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
