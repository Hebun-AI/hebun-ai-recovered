/*
 * PRE-MIGRATION NARROWING — the three corrections the architecture review required.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A human is never told Heby will not perform an act Heby may perform; a retired agent's
 *    already-authorized permit is refused before the spend; and the standing tenant authorization
 *    belongs to the organization rather than to the human who happened to sign it."
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prepareAction } from "../../src/features/heby-actions/action-preparer";
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "../../src/features/governed-machine-execution/contracts";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const EXECUTOR = "src/features/governed-machine-execution/execute-record-work-as-machine.server.ts";
const AGENT_READER = "src/features/agent-identity/read-durable-agent-identity.server.ts";
const PREPARER = "src/features/heby-actions/action-preparer.ts";

function main(): void {
  /* ── 1. THE FALSE CLAUSE IS GONE FROM EVERY PRODUCT SURFACE ─────────────── */
  {
    /*
     * The exact sentence RUNG 1 falsified. Searched as a SUBSTRING across the surfaces that state
     * it, because the defect was one clause inside a longer sentence rather than a whole string.
     */
    for (const file of [
      PREPARER,
      "src/features/heby-action-inlet/contracts.ts",
      "src/features/heby-runtime/tool-gate.ts",
      "src/components/director-intent/director-intent.tsx",
      "src/components/layout/heby/heby-composer.tsx",
    ]) {
      const source = read(file);
      /* Strip block comments: the preparer's own explanation QUOTES the old sentence on purpose. */
      const live = source.replace(/\/\*[\s\S]*?\*\//g, " ");
      for (const falsehood of [
        "never authorizes or executes",
        "it never executes",
        "a human must still perform it",
        "Heby prepares it; it does not execute",
      ]) {
        assert.ok(
          !live.includes(falsehood),
          `${file} still claims "${falsehood}" — RUNG 1 made that false`,
        );
      }
    }
  }

  /* ── 2. THE HALF THAT WAS ALWAYS TRUE IS STILL SAID ─────────────────────── */
  {
    /* Heby never authorizes. That invariant is not weakened by correcting the other clause. */
    for (const file of [
      PREPARER,
      "src/components/director-intent/director-intent.tsx",
      "src/components/layout/heby/heby-composer.tsx",
    ]) {
      assert.match(
        read(file).replace(/\/\*[\s\S]*?\*\//g, " "),
        /never authorizes/,
        `${file} must still say Heby never authorizes`,
      );
    }
  }

  /* ── 3. THE DISCLOSURE IS ACTION-AWARE, AND NOT A NEW BLANKET ───────────── */
  {
    const machineKind = [...MACHINE_EXECUTABLE_ACTION_KINDS][0]!;
    assert.equal(machineKind, RECORD_WORK_ACTION_KIND, "the frozen set is still one member");

    /*
     * THE PREPARER RESTATES THE KIND IN ITS OWN VOCABULARY — deliberately, so Heby's preparation
     * path never imports the execution authority. THIS is where that drift risk is paid for.
     */
    const live = read(PREPARER).replace(/\/\*[\s\S]*?\*\//g, " ");
    assert.match(
      live,
      new RegExp(`MACHINE_PERFORMABLE_ACTION_KIND = "${machineKind}"`),
      "the preparer's machine-performable kind agrees with the released frozen set",
    );

    /* The released request shape, minimal and valid — the consequence text is what is under test. */
    const prepared = prepareAction({
      actionKind: RECORD_WORK_ACTION_KIND,
      requestingWorkspace: "command",
      proposedArguments: {},
    } as never);
    const consequences = prepared.consequences.join(" ");
    assert.match(consequences, /Hebun may perform it for you/, "the human is told a machine may perform it");
    assert.match(consequences, /Heby never authorizes it/, "and that Heby never authorizes it");
    assert.ok(
      !/schedul|automatic|trigger/i.test(consequences),
      "and is promised NO automation — nothing triggers an execution today",
    );
  }

  /* ── 4. A NON-MACHINE ACT STILL SAYS A PERSON MUST PERFORM IT ───────────── */
  {
    const live = read(PREPARER).replace(/\/\*[\s\S]*?\*\//g, " ");
    assert.match(
      live,
      /a person must perform it/,
      "every other consequential act still tells the human a person performs it",
    );
  }

  /* ── 5. AGENT LIVENESS IS READ FROM THE AGENT AUTHORITY, BEFORE THE SPEND ─ */
  {
    const code = read(EXECUTOR).replace(/\/\*[\s\S]*?\*\//g, " ");

    assert.match(
      code,
      /readDurableAgentRuntimeLiveness\)\(\s*principal\.tenantId,\s*principal\.agentId,/,
      "liveness is resolved from the PRINCIPAL's own ids — never from an argument",
    );
    assert.match(code, /agent-not-in-service/, "and a non-live agent is refused by name");

    /* BEFORE THE SPEND, and AFTER the tenant boundary. */
    const liveness = code.indexOf("agentLiveness");
    const reach = code.indexOf("resolveMachineExecutionReachability");
    const spend = code.indexOf("consume(");
    assert.ok(reach > -1 && liveness > reach, "tenant reachability is resolved first");
    assert.ok(spend > liveness, "and liveness is the LAST read before the permit is spent");

    /* THE EXECUTOR IS NOT AGENT LIFECYCLE AUTHORITY. */
    for (const f of [
      "retireDurableAgentIdentity",
      "createDurableAgentIdentity",
      ".update(agents",
      ".insert(agents",
    ]) {
      assert.ok(!code.includes(f), `the executor must not reach ${f}`);
    }
    /* NO SECOND AGENT REGISTRY. */
    assert.ok(
      !code.includes("from \"@/db/schema/agent\""),
      "it reads the agent authority's seam, never the agents table directly",
    );
  }

  /* ── 6. THE LIVENESS READER FAILS CLOSED AND CANNOT BE WIDENED ──────────── */
  {
    const code = read(AGENT_READER).replace(/\/\*[\s\S]*?\*\//g, " ");
    assert.match(code, /return "unavailable"/, "an unreadable control plane is `unavailable`");
    assert.match(code, /return "unknown-agent"/, "and a foreign or absent id is `unknown-agent`");
    assert.ok(
      !/readDurableAgentRuntimeLiveness[\s\S]{0,900}TenantContext/.test(code),
      "the runtime reader takes bare ids — it cannot manufacture a human session",
    );
    /* Same predicate as the product reader, not a second definition. */
    assert.equal(
      (code.match(/lifecycle !== RETIRED_AGENT_LIFECYCLE_STATUS|agentLifecycleStatus/g) ?? []).length >= 2,
      true,
      "the runtime predicate is the released one, applied twice rather than redefined",
    );
    /* It reads; it never writes. */
    for (const forbidden of [".insert(", ".update(", ".delete(", "transaction("]) {
      assert.ok(!code.includes(forbidden), `the reader must not ${forbidden}`);
    }
  }

  /* ── 7. GOVERNANCE SUCCESSION IS STATED, NOT ACCIDENTAL ─────────────────── */
  {
    /*
     * The decision: a tenant machine-execution authorization is the ORGANIZATION'S standing
     * decision, not a capability belonging to the human who signed it. Losing Governance authority
     * therefore does not silently revoke it; only the subsystem that owns the lifecycle may.
     *
     * This is asserted as a CONTRACT rather than by simulating a Governance transition, because a
     * fabricated succession would prove the fixture rather than the rule — and because the rule is
     * exactly that NOTHING in the authorization path reads the authorizer's CURRENT authority.
     */
    const reader = read(
      "src/features/tenant-machine-execution-authority/read-tenant-machine-execution.server.ts",
    ).replace(/\/\*[\s\S]*?\*\//g, " ");
    assert.ok(
      !/resolveGovernanceAuthority|bootstrapDecisionId|authority\.authorized/.test(reader),
      "the standing state is read WITHOUT consulting the authorizer's current authority — which is what makes it the organization's decision and not the person's",
    );

    const composition = read(
      "src/features/tenant-machine-execution-authority/resolve-machine-execution-reachability.server.ts",
    ).replace(/\/\*[\s\S]*?\*\//g, " ");
    assert.ok(
      !/resolveGovernanceAuthority/.test(composition),
      "and reachability does not re-derive it either",
    );

    /* Only the owning writer may end it, and it needs Governance at the time of the change. */
    const writer = read(
      "src/features/tenant-machine-execution-authority/authorize-tenant-machine-execution.server.ts",
    ).replace(/\/\*[\s\S]*?\*\//g, " ");
    assert.match(writer, /resolveGovernanceAuthority/, "changing it requires Governance NOW");
    assert.match(writer, /authorizedByActorType: "human"/, "and records the human who changed it");
    assert.ok(
      !/\.update\(tenantMachineExecutionAuthorizations/.test(writer),
      "history is never edited — a withdrawal is a new revision",
    );
  }

  console.log("pre-migration narrowing: truth and liveness checks passed");
}

main();
