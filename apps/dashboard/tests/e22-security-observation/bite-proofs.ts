/*
 * E2-2 / S-B — BITE-PROOFS.
 *
 * Every guarantee this slice introduces is mutated in the SHIPPED SOURCE, and the suite defending
 * it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the find-string is present (so the mutation APPLIES — one that
 * cannot be applied looks exactly like one that failed to bite), it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 *
 * ── WHAT IS BEING PROVED ─────────────────────────────────────────────────────
 *
 * Two families. The first is the pair of distinctions the whole milestone rests on — derived is not
 * authoritative, and known-empty is not unavailable — because both are one word away from being
 * quietly wrong and neither shows up as a crash. The second is the authority boundary: a read
 * connection must not become a write, a handle, a finding, a score, or a Governance import, and
 * `connected` must not be claimable by a surface that stopped reading.
 *
 *     DERIVED OBSERVATION != AUTHORITATIVE SECURITY TRUTH
 *     KNOWN EMPTY         != UNAVAILABLE
 *     READ CONNECTION     != WRITE AUTHORITY
 *     SOURCE EXISTS       != SECURITY CENTER CONNECTED
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const OBSERVATION = "tests/e22-security-observation/observation.ts";
const GATE = "tests/e22-security-observation/firewall.ts";
const SEC4 = "tests/sec4-security-boundary/firewall.ts";
const RELEASED = "tests/security-center/security-center.ts";

const PROJECTION = "src/features/governance-activity/security-observation-source.server.ts";
const SOURCE_MAP = "src/features/security-center/source-map.ts";
const DOMAINS = "src/features/security-center/domains.ts";
const PIPELINE = "src/features/security-center/pipeline.ts";
const ROUTE = "src/app/(dashboard)/director/governance/security/page.tsx";
const READER = "src/features/governance-activity/act-history-read.server.ts";
const CONTRACTS = "src/features/security-center/contracts.ts";
/* The SECOND consumer of the source map — outside every Security Center guard. */
const HEBY_COMMANDS = "src/features/heby-commands/read-commands.server.ts";
const S1 = "tests/s1-flow/dispatch-and-availability.ts";

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

const MUTATIONS: readonly Mutation[] = [
  /* ── THE TWO DISTINCTIONS THE MILESTONE RESTS ON ─────────────────────────── */
  {
    /*
     * M1 — the tenant predicate, removed at the RELEASED reader rather than at the projection.
     *
     * That is where the boundary actually lives: the projection issues no query, so it has nothing
     * to widen and mutating it would prove nothing about isolation. E2-2's evidence path INHERITS
     * this predicate, so the honest proof is that the predicate is still defended — by R7.1.1's own
     * firewall, which counts the one expression and the two statements that take it. Restating that
     * proof in E2-2's suite would be a second definition of the same boundary.
     */
    label: "M1 the inherited tenant predicate is gutted while keeping its shape",
    file: READER,
    suite: GATE,
    find: "  const tenantScope = and(eq(auditLog.tenantId, tenantId));",
    replace: "  const tenantScope = undefined;",
    expect: "not merely present",
  },
  {
    /* M2 — the one word that would turn a bounded view of a ledger into security truth. */
    label: "M2 the derived observation claims to be authoritative",
    file: PROJECTION,
    suite: OBSERVATION,
    find: "    state: \"recorded\",\n    authoritative: false,",
    replace: "    state: \"recorded\",\n    authoritative: true as false,",
    expect: "every state reports the observation as derived",
  },
  {
    /*
     * M3 — a successful read of an empty ledger reported as a failure. It reads as caution and is
     * a lie in the customer's favour, which is why it needs a proof rather than a comment.
     */
    label: "M3 known-empty is reported as unavailable",
    file: PROJECTION,
    suite: OBSERVATION,
    find: "  if (result.status === \"empty\") {",
    replace: "  if (result.status === \"empty\") {\n    return unavailable(\"read-failed\");",
    expect: "known-empty",
  },
  {
    /*
     * M4 — the inverse, and the dangerous direction: a read that could not run rendered as "your
     * organization has recorded nothing". Hebun would be asserting an organizational fact it never
     * established.
     */
    label: "M4 an unavailable read is reported as a known-empty ledger",
    file: PROJECTION,
    suite: OBSERVATION,
    find: "  if (result.status === \"unavailable\") {\n    return unavailable(result.reason);\n  }",
    replace:
      "  if (result.status === \"unavailable\") {\n" +
      "    return {\n" +
      "      sourceClass: \"audit\",\n" +
      "      state: \"known-empty\",\n" +
      "      authoritative: false,\n" +
      "      provenance: SECURITY_OBSERVATION_PROVENANCE,\n" +
      "      limits: SECURITY_OBSERVATION_LIMITS,\n" +
      "      generatedAt: null,\n" +
      "      acts: [],\n" +
      "      totalRecordedActs: 0,\n" +
      "      truncated: false,\n" +
      "      unavailableReason: null,\n" +
      "    };\n" +
      "  }",
    expect: "unavailable",
  },
  {
    /* M14 — provenance re-worded. A second wording is a second interpretation of a limitation. */
    label: "M14 the provenance stops being the ledger boundary's own sentence",
    file: PROJECTION,
    suite: OBSERVATION,
    find: "export const SECURITY_OBSERVATION_PROVENANCE = RECORDED_ACT_HISTORY_BOUNDARY.rationale;",
    replace:
      "export const SECURITY_OBSERVATION_PROVENANCE = \"Read from the security audit trail.\";",
    expect: "provenance is the ledger boundary's own sentence",
  },
  {
    /*
     * M12 — the bound's meaning, which is the half E2-2 owns.
     *
     * The `.limit()` itself lives in the released reader and is already defended there. What this
     * projection can break is the INDEPENDENT total: substituting `acts.length` makes the page and
     * the total agree by construction, which reads as "your organization has recorded exactly 20
     * acts" for every organization with more. Truncation would then be permanently false and the
     * bound would silently become a ceiling on the truth.
     */
    label: "M12 the independent total is replaced by the page length",
    file: PROJECTION,
    suite: OBSERVATION,
    find: "    totalRecordedActs: result.page.totalRecordedActs,",
    replace: "    totalRecordedActs: acts.length,",
    expect: "the total is the real total",
  },
  {
    /*
     * M9 — a withheld audit column smuggled onto the surface. `actorId` is the sharpest of the ten:
     * it names WHICH person acted, on a page a reader will interpret as a security page.
     */
    label: "M9 a withheld audit column reaches the security observation",
    file: PROJECTION,
    suite: OBSERVATION,
    find: "    simulation: act.simulation,\n  }));",
    replace:
      "    simulation: act.simulation,\n" +
      "    ...(\"actorId\" in act ? { actorId: (act as { actorId?: string }).actorId } : {}),\n" +
      "  }) as SecurityRecordedAct);",
    expect: "withheld audit column",
  },

  /* ── THE AUTHORITY BOUNDARY ──────────────────────────────────────────────── */
  {
    /* M5 — the audit ledger's own writer, one directory from the readers. */
    label: "M5 an audit ledger writer is imported into the projection",
    file: PROJECTION,
    suite: GATE,
    find: 'import { observeRecordedActHistory, type ObserveGovernanceActivityDeps } from "./observe.server";',
    replace:
      'import { observeRecordedActHistory, type ObserveGovernanceActivityDeps } from "./observe.server";\n' +
      'import { recordGovernanceDecisionAudit } from "@/features/governance-audit/governance-decision-audit.server";',
    expect: "governance-audit",
  },
  {
    /* M6 — the Governance decision authority itself. */
    label: "M6 the Governance decision authority is imported into the projection",
    file: PROJECTION,
    suite: GATE,
    find: 'import { RECORDED_ACT_HISTORY_BOUNDARY, type RecordedActHistoryResult } from "./contracts";',
    replace:
      'import { RECORDED_ACT_HISTORY_BOUNDARY, type RecordedActHistoryResult } from "./contracts";\n' +
      'import { recordGovernanceDecision } from "@/features/governance-decision/record-decision.server";',
    expect: "governance-decision",
  },
  {
    /* M7 — the read projection acquires a write. */
    label: "M7 the projection performs a durable write",
    file: PROJECTION,
    suite: GATE,
    find: "export interface SecurityObservationDeps extends ObserveGovernanceActivityDeps {",
    replace:
      "export async function persistObservation(db: { insert: (t: unknown) => { values: (v: unknown) => Promise<void> } }, table: unknown): Promise<void> {\n" +
      "  await db.insert(table).values({ observed: true });\n" +
      "}\n\n" +
      "export interface SecurityObservationDeps extends ObserveGovernanceActivityDeps {",
    expect: "performs no durable write",
  },
  {
    /* M8 — a synthetic posture number derived from how much Hebun happened to record. */
    label: "M8 a security score is computed from recorded activity",
    file: CONTRACTS,
    suite: GATE,
    find: "  readonly truncated: boolean;\n  /** The one honest sentence for why the read could not run, or `null` when it did. */",
    replace:
      "  readonly truncated: boolean;\n  readonly securityScore: number;\n" +
      "  /** The one honest sentence for why the read could not run, or `null` when it did. */",
    expect: "score",
  },
  {
    /*
     * M10 — the Security Center opens its own handle. SEC-4 owns this rule and E2-2 must not have
     * quietly bought an exemption from it by connecting something.
     */
    label: "M10 the Security Center opens a database handle of its own",
    file: SOURCE_MAP,
    suite: SEC4,
    find: 'import type { SecuritySourceClass, SecuritySourceStatus } from "./contracts";',
    replace:
      'import type { SecuritySourceClass, SecuritySourceStatus } from "./contracts";\n' +
      'import { getControlPlaneDb } from "@/db/client.server";',
    expect: "must not reference",
  },
  {
    /*
     * M13 — a Governance import inside the Security Center's own feature directory. This is the
     * released token firewall E2-2 was architected AROUND rather than through: the projection lives
     * beside the facts precisely so this ban never has to be loosened.
     */
    label: "M13 a features/governance import appears inside the Security Center",
    file: DOMAINS,
    suite: RELEASED,
    find: 'import type { SecurityDomainStatus } from "./contracts";',
    replace:
      'import type { SecurityDomainStatus } from "./contracts";\n' +
      'import { observeRecordedActHistory } from "@/features/governance-activity/observe.server";',
    expect: "features/governance",
  },
  {
    /*
     * M11 — the claim without the code. The source map is a frozen record and will assert any
     * connection an author types, so `connected` is only true while the route actually reads. This
     * removes the read and leaves the claim standing.
     */
    label: "M11 audit stays connected after the route stops consuming the seam",
    file: ROUTE,
    suite: GATE,
    find: "  const recordedActs = await readSecurityRecordedActObservation(tenant);",
    replace: "  const recordedActs = null;",
    expect: "the route CALLS the projection",
  },

  /* ── THE BOUNDED PREREQUISITE MAY NOT REGRESS ────────────────────────────── */
  {
    /*
     * The stale denial that survived three releases because SEC-4's scan watched one file. It is
     * mutated back into `domains.ts` — the module the released guard could not see — so the scope
     * repair is proved rather than asserted.
     */
    label: "M15 the retired \"none connected\" denial returns through domains.ts",
    file: DOMAINS,
    suite: GATE,
    find: 'detail: "Tenant-scoped integration connections exist and belong to the integration authority. This surface reads none of them." },',
    replace: 'detail: "Platform integration state. None connected." },',
    expect: "no retired denial may be served",
  },
  {
    /* And the third one, from the other module the released scan never covered. */
    label: "M16 the retired \"no persisted audit\" denial returns through pipeline.ts",
    file: PIPELINE,
    suite: SEC4,
    find: 'detail: "No response receipt — nothing is executed here, so nothing is recorded for it. Hebun\'s governed audit ledger is persisted, and its recorded acts are observed separately above." },',
    replace: 'detail: "No receipt; no persisted audit." },',
    expect: "a retired denial is being served again",
  },

  /* ── THE SECOND CONSUMER OF THE SOURCE MAP ───────────────────────────────────
   *
   * The Security Center is not the only surface that reads `listSecuritySources()`. Heby's
   * `/security` read command reads the same map, and it had the SAME two-branch defect — which no
   * Security firewall could see, because that command is not a Security Center file. It was found
   * by the full suite, not by design, and these two mutations make the repair defended rather than
   * merely present.
   */
  {
    label: "M17 the /security command sweeps the connected class into \"not connected\"",
    file: HEBY_COMMANDS,
    suite: S1,
    find: '      const notConnected = sources.filter((source) => source.state === "not-connected");',
    replace: '      const notConnected = sources.filter((source) => source.state !== "derived");',
    expect: "NOT swept into the not-connected list",
  },
  {
    /*
     * CONNECTED != LIVE FEED, on the surface that would have announced the opposite. A bounded read
     * taken for one request is not a feed, and "any class is connected" must never answer "is a
     * live feed connected".
     */
    label: "M18 the /security command reports a connected class as a live security feed",
    file: HEBY_COMMANDS,
    suite: S1,
    find:
      "      const liveFeed = sources.filter(\n" +
      "        (source) =>\n" +
      '          (source.sourceClass === "incident-feed" ||\n' +
      '            source.sourceClass === "network" ||\n' +
      '            source.sourceClass === "policy") &&\n' +
      '          source.state !== "not-connected",\n' +
      "      );",
    replace: '      const liveFeed = sources.filter((source) => source.state === "connected");',
    expect: "it states there is no feed",
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
  /* Every defending suite must PASS on the released tree, or every "bite" below is meaningless. */
  for (const suite of [...new Set(MUTATIONS.map((m) => m.suite))]) {
    const baseline = runSuite(suite);
    assert.ok(
      baseline.ok,
      `${suite} must pass on unmutated source before any mutation proves anything.\n${baseline.output.slice(-2000)}`,
    );
  }

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
  console.log(`e22-security-observation/bite-proofs: ${bitten} mutations bit`);
}

main();
