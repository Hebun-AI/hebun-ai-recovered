/*
 * SEC-4 — BITE-PROOFS.
 *
 * Every guarantee this slice introduces is mutated in the SHIPPED SOURCE, and the suite defending
 * it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the find-string is present (so the mutation APPLIES — one that
 * cannot be applied looks exactly like one that failed to bite), it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 *
 * A child that exceeds its timeout is reported VOID rather than counted as bitten.
 *
 * ── WHAT IS BEING PROVED, AND WHY EACH ONE IS HERE ───────────────────────────
 *
 * The released Security Center guard scans one directory for tokens. Each mutation below is a way a
 * careless future change could give this surface authority WITHOUT tripping that guard — through a
 * component, through the route, transitively, or hidden behind a barrel re-export. If the new gate
 * did not exist, most of these would ship green.
 *
 * The last four prove the gate's own machinery is alive: a graph walker whose resolution has
 * silently broken reports a clean graph for a surface it never inspected, and that is worse than no
 * test at all.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const GATE = "tests/sec4-security-boundary/firewall.ts";

const FEATURE_STATE = "src/features/security-center/security-state.ts";
const FEATURE_SIGNALS = "src/features/security-center/signals.ts";
const FEATURE_INDEX = "src/features/security-center/index.ts";
const FEATURE_CONTRACTS = "src/features/security-center/contracts.ts";
const SOURCE_MAP = "src/features/security-center/source-map.ts";
const COMPONENT = "src/components/security-center/security-sources.tsx";
const ROUTE = "src/app/(dashboard)/director/governance/security/page.tsx";

const CHILD_TIMEOUT_MS = 5 * 60 * 1000;

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface SuiteRun {
  readonly ok: boolean;
  readonly output: string;
  readonly timedOut: boolean;
}

function runSuite(suite: string): SuiteRun {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    timedOut: result.signal === "SIGTERM" && result.status === null,
  };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const AGENT_WRITER = 'import { createDurableAgentIdentity } from "@/features/agent-identity/create-durable-agent-identity.server";';

const MUTATIONS: readonly Mutation[] = [
  /* ── AUTHORITY ARRIVES BY THE FOUR ROUTES THE RELEASED GUARD CANNOT SEE ──── */
  {
    /* The one case the released token guard DOES cover — proved here so the new gate subsumes it. */
    label: "S1 a lifecycle writer imported into a Security feature file",
    file: FEATURE_STATE,
    suite: GATE,
    find: 'import { describeDeviceRuntimeBoundary } from "@/features/device-runtime";',
    replace: `import { describeDeviceRuntimeBoundary } from "@/features/device-runtime";\n${AGENT_WRITER}`,
    expect: "the agent identity writer",
  },
  {
    /*
     * UI != AUTHORITY. A component was outside every released Security guard.
     *
     * The find-string was repaired in E2-2, strictly after that component's import line gained the
     * three state helpers the connected-source branch needs. The harness reported it correctly —
     * "the mutation would prove nothing" rather than a pass — which is the whole reason a missing
     * find-string must never be treated as success. The guarantee and the expectation are unchanged.
     */
    label: "S2 a lifecycle writer imported through a COMPONENT",
    file: COMPONENT,
    suite: GATE,
    find: 'import { SecurityRegion, stateLabel, stateTone, toneClass } from "./security-region";',
    replace:
      'import { SecurityRegion, stateLabel, stateTone, toneClass } from "./security-region";\n' +
      `${AGENT_WRITER}`,
    expect: "the agent identity writer",
  },
  {
    /* The route was outside every released Security guard too. */
    label: "S3 a lifecycle writer imported through the ROUTE",
    file: ROUTE,
    suite: GATE,
    find: 'import { getSecurityCenterModel } from "@/features/security-center";',
    replace:
      'import { getSecurityCenterModel } from "@/features/security-center";\n' +
      'import { retireDurableAgentIdentity } from "@/features/agent-identity/retire-durable-agent-identity.server";',
    expect: "the agent retirement writer",
  },
  {
    /*
     * THE REALISTIC MISTAKE. Nobody imports a writer on purpose. They import a READ from a barrel —
     * and `agent-identity/index.ts` re-exports `createDurableAgentIdentity` beside it, so the writer
     * is in the runtime graph and no token in this file says so.
     */
    label: "S4 a writer reached TRANSITIVELY by importing a reader from its barrel",
    file: FEATURE_STATE,
    suite: GATE,
    find: 'import { describeDeviceRuntimeBoundary } from "@/features/device-runtime";',
    replace:
      'import { describeDeviceRuntimeBoundary } from "@/features/device-runtime";\n' +
      'import { readDurableAgentIdentityState } from "@/features/agent-identity";',
    expect: "the agent identity writer",
  },
  {
    /*
     * HIDDEN BEHIND A RE-EXPORT. L4's first walker followed `import` but not `export … from` and was
     * blind to exactly this. If the walker regresses that way, this mutation survives.
     */
    label: "S5 a writer hidden behind an `export … from` re-export",
    file: FEATURE_INDEX,
    suite: GATE,
    find: 'export * from "./workspace-model";',
    replace: 'export * from "./workspace-model";\nexport * from "@/features/agent-identity";',
    expect: "the agent identity writer",
  },

  /* ── THE OTHER AUTHORITY CLASSES ─────────────────────────────────────────── */
  {
    label: "S6 a direct database mutation inside the Security Center",
    file: FEATURE_SIGNALS,
    suite: GATE,
    find: "const SIGNALS: readonly SecuritySignal[] = Object.freeze([]);",
    replace:
      "const SIGNALS: readonly SecuritySignal[] = Object.freeze([]);\n\n" +
      "export async function recordSignal(db: { insert: (t: unknown) => { values: (v: unknown) => Promise<void> } }, table: unknown): Promise<void> {\n" +
      "  await db.insert(table).values({ recorded: true });\n" +
      "}",
    expect: "performs no durable write",
  },
  {
    label: "S7 execution authority imported into the Security Center",
    file: FEATURE_STATE,
    suite: GATE,
    find: 'import { describeDeviceRuntimeBoundary } from "@/features/device-runtime";',
    replace:
      'import { describeDeviceRuntimeBoundary } from "@/features/device-runtime";\n' +
      'import { resolveExternalSendEnabled } from "@/features/action-execution/execution-control.server";',
    expect: "the execution authority",
  },
  {
    label: "S8 credential decryption imported into the Security Center",
    file: FEATURE_STATE,
    suite: GATE,
    find: 'import { describeDeviceRuntimeBoundary } from "@/features/device-runtime";',
    replace:
      'import { describeDeviceRuntimeBoundary } from "@/features/device-runtime";\n' +
      'import { withDecryptedSecret } from "@/features/integration-credentials/credential-repository.server";',
    expect: "credential storage and decryption",
  },

  /* ── THE GATE'S OWN MACHINERY IS ALIVE ───────────────────────────────────── */
  {
    /*
     * If alias resolution silently stops working, the walk returns a small clean graph and every
     * prohibition above passes vacuously. This proves the walker notices.
     */
    label: "S9 alias resolution breaks — the walker must refuse to conclude anything",
    file: FEATURE_STATE,
    suite: GATE,
    find: 'from "@/features/device-runtime";',
    replace: 'from "@/features/device-runtime-does-not-exist";',
    expect: "value import of the device boundary IS a value edge",
  },
  {
    /*
     * The inverse trap: counting erased edges manufactures false authority. If the type-erasure
     * logic regresses, `contracts.ts`'s `import type` becomes an edge and the census is fiction.
     */
    label: "S10 a type-only import becomes a value import — erasure detection must notice",
    file: FEATURE_CONTRACTS,
    suite: GATE,
    find: "import type {\n  HebyAuthorityMode,",
    replace: "import {\n  HebyAuthorityMode,",
    expect: "an erased edge is not a value edge",
  },

  /* ── S-A: THE RETIRED FALSEHOODS MAY NOT COME BACK ───────────────────────── */
  {
    label: "S11 the integration claim regresses to \"none connected\"",
    file: SOURCE_MAP,
    suite: GATE,
    find: '"of them; unavailable is not a breach.",',
    replace: '"none connected; unavailable is not a breach.",',
    expect: "must not claim",
  },
  {
    label: "S12 the provider claim regresses to \"simulation vocabulary\"",
    file: SOURCE_MAP,
    suite: GATE,
    find: 'canProve: "Nothing on this surface — the Security Center reads no provider state.",',
    replace: 'canProve: "The provider capability vocabulary and simulation vocabulary.",',
    expect: "must not claim",
  },
  {
    /*
     * The find-string was repaired in E2-2, strictly after the audit source became connected and
     * its `canProve` stopped saying "nothing here". The guarantee is unchanged and is arguably
     * sharper now: the sentence this replaces it with is the very denial the ledger's nine writers
     * disprove, and it must still be refused on a surface that now READS that ledger.
     */
    label: "S13 the audit claim regresses to denying the ledger exists",
    file: SOURCE_MAP,
    suite: GATE,
    find:
      "    canProve:\n" +
      '      "Which governed acts Hebun recorded for this organization — the act, the kind of entity, " +\n' +
      '      "the kind of actor, the result, the recording subsystem, the authority source and whether " +\n' +
      '      "the act was simulated.",',
    replace: '    canProve: "Nothing — no persisted audit exists.",',
    expect: "must not claim",
  },
];

function withMutation(mutation: Mutation, body: () => void): void {
  const original = readFile(mutation.file);
  const before = sha(original);
  assert.ok(
    original.includes(mutation.find),
    `${mutation.label}: the find-string is not present in ${mutation.file} — the mutation would prove nothing`,
  );
  const mutated = original.replace(mutation.find, mutation.replace);
  assert.notEqual(mutated, original, `${mutation.label}: the mutation changed nothing`);
  try {
    writeFileSync(abs(mutation.file), mutated, "utf8");
    assert.equal(sha(readFile(mutation.file)), sha(mutated), `${mutation.label}: the mutation did not reach disk`);
    body();
  } finally {
    writeFileSync(abs(mutation.file), original, "utf8");
  }
  assert.equal(sha(readFile(mutation.file)), before, `${mutation.file} was not restored byte-identically`);
}

function main(): void {
  /* The gate must PASS on the released tree, or every "bite" below is meaningless. */
  const baseline = runSuite(GATE);
  assert.ok(
    baseline.ok,
    `the gate must pass on unmutated source before any mutation proves anything.\n${baseline.output.slice(-2000)}`,
  );

  let bitten = 0;
  for (const mutation of MUTATIONS) {
    withMutation(mutation, () => {
      const run = runSuite(mutation.suite);
      assert.equal(
        run.timedOut,
        false,
        `${mutation.label}: the defending suite TIMED OUT after ${CHILD_TIMEOUT_MS}ms. That is a ` +
          "VOID result, not a bite.",
      );
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the mutation SURVIVED — ${mutation.suite} still passed.\n` +
          `--- actual ---\n${run.output.slice(-2000)}`,
      );
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.expect}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`sec4-security-boundary/bite-proofs: ${bitten} mutations bit`);
}

main();
