/*
 * OPS-P1 — BITE-PROOFS.
 *
 * Every guarantee this phase introduces is mutated in the SHIPPED SOURCE, and the suite defending it
 * must fail — for the INTENDED reason, not merely for some reason.
 *
 * Restoration runs in `finally` and is verified byte-identically. Each child is bounded: a hanging
 * bite-proof is not a verdict, so a timeout is reported VOID rather than counted as a bite.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const FIREWALL = "tests/ops-p1-flow/preparation-firewall.ts";

const RECIPIENTS = "src/components/operations-preparation/recipients-section.tsx";
const WORK = "src/components/operations-preparation/prepared-work-section.tsx";
const NAV = "src/config/workspace-nav.ts";
const JOURNAL = "src/db/migrations/meta/_journal.json";

const CHILD_TIMEOUT_MS = 5 * 60 * 1000;
const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

function runSuite(): { ok: boolean; output: string; timedOut: boolean } {
  const r = spawnSync(process.execPath, ["--import", "tsx", FIREWALL], {
    cwd: ROOT, encoding: "utf8", env: process.env,
    maxBuffer: 64 * 1024 * 1024, timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: r.status === 0,
    output: `${r.stdout ?? ""}${r.stderr ?? ""}`,
    timedOut: r.signal === "SIGTERM" && r.status === null,
  };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    /* R3R has no update path. A surface offering one implies an authority that does not exist. */
    label: "M1 an Edit address control appears",
    file: RECIPIENTS,
    find: `          {pending ? "Retiring…" : "Retire"}`,
    replace: `          {pending ? "Retiring…" : "Retire"}{"Edit address"}`,
    expect: `must not render "Edit address"`,
  },
  {
    label: "M2 the tenant identifier is rendered",
    file: WORK,
    find: `            {artifact.artifactType} · revision {artifact.currentRevision}`,
    replace: `            {artifact.tenantId} {artifact.artifactType} · revision {artifact.currentRevision}`,
    expect: `must not render "tenantId"`,
  },
  {
    label: "M3 the endpoint digest is rendered",
    file: RECIPIENTS,
    find: `          {recipient.endpointKind}: {recipient.endpointValue}`,
    replace: `          {recipient.endpointKind}: {recipient.endpointValue} {recipient.endpointDigest}`,
    expect: `must not render "endpointDigest"`,
  },
  {
    label: "M4 the content digest is rendered",
    file: WORK,
    find: `              {revision.current ? " · current" : ""} — {revision.content}`,
    replace: `              {revision.current ? " · current" : ""} — {revision.content} {revision.contentDigest}`,
    expect: `must not render "contentDigest"`,
  },
  {
    /* A client-built reference can name something the server never resolved. */
    label: "M5 the recipient reference is constructed in the client",
    file: RECIPIENTS,
    find: `import { ReferenceChip } from "./reference-chip";`,
    replace:
      `import { formatRecipientRef } from "@/features/external-recipients/recipient-ref";\n` +
      `import { ReferenceChip } from "./reference-chip";`,
    expect: `must not construct a reference via "formatRecipientRef"`,
  },
  {
    label: "M6 the artifact reference is constructed in the client",
    file: WORK,
    find: `import { ReferenceChip } from "./reference-chip";`,
    replace:
      `import { formatWorkArtifactRef } from "@/features/work-artifacts/artifact-ref";\n` +
      `import { ReferenceChip } from "./reference-chip";`,
    expect: `must not construct a reference via "formatWorkArtifactRef"`,
  },
  {
    /* OPS-P1's whole placement argument is that it adds no destination. */
    label: "M7 a fifth Operations L2 destination appears",
    file: NAV,
    find: `      { label: "Execution Substrate", href: "/director/execution-substrate", icon: Layers, purpose: "The execution stack and what is missing — read-only." },`,
    replace:
      `      { label: "Execution Substrate", href: "/director/execution-substrate", icon: Layers, purpose: "The execution stack and what is missing — read-only." },\n` +
      `      { label: "Preparation", href: "/operations", icon: Layers, purpose: "Recipients and prepared work." },`,
    expect: "the released Operations L2 is exactly four destinations",
  },
  {
    /* Preparation produces inputs. It never files a request. */
    label: "M8 the surface calls the action-request writer directly",
    file: WORK,
    find: `import { ReferenceChip } from "./reference-chip";`,
    replace:
      `import { recordActionRequest } from "@/features/action-authorization/record-action-request.server";\n` +
      `import { ReferenceChip } from "./reference-chip";`,
    expect: `must not reach "recordActionRequest"`,
  },
  {
    /* A second caller of the inlet is a second way a proposal comes into existence. */
    label: "M9 a second proposal-inlet caller appears",
    file: RECIPIENTS,
    find: `import { ReferenceChip } from "./reference-chip";`,
    replace:
      `import { proposeSendAction } from "@/features/heby-action-inlet/send-proposal.server";\n` +
      `import { ReferenceChip } from "./reference-chip";`,
    expect: `must not reach "proposeSendAction"`,
  },
  {
    label: "M10 an execution control appears on the preparation surface",
    file: WORK,
    find: `            History`,
    replace: `            History{"Execute"}`,
    expect: `must not offer "Execute"`,
  },
  {
    /* Revising APPENDS. Editing in place would change bytes an approval already named. */
    label: "M11 an in-place revision editor appears",
    file: WORK,
    find: `              const result = await reviseWorkArtifactAction({`,
    replace:
      `              const replaceContent = true;\n` +
      `              void replaceContent;\n` +
      `              const result = await reviseWorkArtifactAction({`,
    expect: `must not offer "replaceContent"`,
  },
  {
    label: "M12 a migration is added",
    file: JOURNAL,
    /* RE-ANCHORED at GIA-1, as it was at Departmental Placement and WORK-1 before it: the mutation must apply
     * to the journal's CURRENT tail, or it proves nothing. The defect it injects — an extra journal
     * entry — is unchanged, and this anchor moves with every migration by design. */
    find: `      "tag": "20260903093716_cgo1_content_draft_destination",\n      "breakpoints": true\n    }\n  ]`,
    replace:
      `      "tag": "20260828190630_sia3_agent_improvement_hypothesis",\n      "breakpoints": true\n    },\n` +
      `    {\n      "idx": 36,\n      "version": "7",\n      "when": 1787726663801,\n` +
      `      "tag": "20260827000000_ops_p1_should_not_exist",\n      "breakpoints": true\n    }\n  ]`,
    expect: "OPS-P1 adds no migration",
  },
];

function withMutation(m: Mutation, body: () => void): void {
  const original = readFile(m.file);
  const before = sha(original);
  assert.ok(
    original.includes(m.find),
    `${m.label}: the find-string is not present in ${m.file} — the mutation would prove nothing`,
  );
  const mutated = original.replace(m.find, m.replace);
  assert.notEqual(mutated, original, `${m.label}: the mutation changed nothing`);
  try {
    writeFileSync(abs(m.file), mutated, "utf8");
    assert.equal(sha(readFile(m.file)), sha(mutated), `${m.label}: the mutation did not reach disk`);
    body();
  } finally {
    writeFileSync(abs(m.file), original, "utf8");
  }
  assert.equal(sha(readFile(m.file)), before, `${m.file} was not restored byte-identically`);
}

function main(): void {
  let bitten = 0;
  for (const m of MUTATIONS) {
    withMutation(m, () => {
      const run = runSuite();
      assert.equal(run.timedOut, false, `${m.label}: the defending suite TIMED OUT. VOID, not a bite.`);
      assert.equal(
        run.ok, false,
        `${m.label}: the mutation SURVIVED — the firewall still passed.\n--- actual ---\n${run.output.slice(-1500)}`,
      );
      assert.ok(
        run.output.includes(m.expect),
        `${m.label}: the suite failed, but not for the intended reason. Expected "${m.expect}".\n` +
          `--- actual ---\n${run.output.slice(-2000)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${m.label}`);
  }
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`ops-p1-flow/bite-proofs: ${bitten} mutations bit`);
}

main();
