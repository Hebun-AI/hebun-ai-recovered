/*
 * R3R — the boundaries a recorded recipient must never cross.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Recording an address is not authentication, not Knowledge, not Memory, not a Governance
 *    decision, not a permit, not an execution and not a CRM — and the code cannot express any of
 *    those, rather than merely declining to."
 *
 * These are STRUCTURAL assertions over source with comments stripped: they are about what the code
 * can reach, not about what its prose promises.
 *
 * Pure. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  RECIPIENT_ENDPOINT_KINDS,
  isRecipientEndpointKind,
} from "../../src/features/external-recipients/contracts";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration";
import { resolveSource } from "../../src/features/heby-runtime";
import { getActionToolByKind } from "../../src/features/heby-actions/action-registry";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/** Source with comments stripped: assertions are about CODE, not about what prose discusses. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function collect(dir: string, ext = /\.tsx?$/): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return collect(rel, ext);
    return ext.test(e.name) ? [rel] : [];
  });
}

const R3R_FILES = collect("src/features/external-recipients");
const R3R_CODE = R3R_FILES.map((f) => codeOf(read(f))).join("\n");

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE AUTH / USER FIREWALL — the reason this domain exists at all.
 * ═════════════════════════════════════════════════════════════════════════ */

function authFirewall(): void {
  /*
   * `users` is root-scoped with a GLOBAL unique email and three foreign keys that make a row an
   * authenticatable principal. If any writer here could reach it, recording a customer would mint
   * a login — and one customer address could then exist only once across the whole installation.
   */
  for (const forbidden of [
    "schema/user",
    "schema/membership",
    "schema/invitation",
    "schema/auth",
    "auth-runtime/identity-repository",
    "membership-authority/authorize-membership",
    "identity-enrollment/",
  ]) {
    assert.ok(
      !R3R_CODE.includes(forbidden),
      `R3R must not import ${forbidden} — a recipient is never a principal`,
    );
  }
  for (const table of ["users", "memberships", "invitations", "authIdentities", "authCredentials"]) {
    assert.ok(
      !new RegExp(`\\.insert\\(\\s*${table}\\b`).test(R3R_CODE),
      `R3R must never insert into ${table}`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. KNOWLEDGE AND MEMORY FIREWALL — a contact is directory data, not truth.
 * ═════════════════════════════════════════════════════════════════════════ */

function knowledgeAndMemoryFirewall(): void {
  for (const forbidden of [
    "knowledge_nodes",
    "knowledgeNodes",
    "knowledgeFacts",
    "knowledgeEdges",
    "enterpriseMemoryRecords",
    "workingMemories",
    "learningSessions",
    "features/knowledge/",
    "features/memory/",
  ]) {
    assert.ok(!R3R_CODE.includes(forbidden), `R3R must not reach ${forbidden}`);
  }
  /* And it never claims authority: the evidence path pins authoritative to a literal false. */
  const evidence = codeOf(read("src/features/external-recipients/recipient-evidence.server.ts"));
  assert.ok(
    !/authoritative:\s*true/.test(evidence),
    "a recorded address is never organizational truth",
  );
  assert.equal(
    (evidence.match(/authoritative:\s*false/g) ?? []).length >= 2,
    true,
    "every resolution — resolved and unavailable — says authoritative: false",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. GOVERNANCE, PERMIT AND EXECUTION FIREWALL.
 * ═════════════════════════════════════════════════════════════════════════ */

function governanceAndExecutionFirewall(): void {
  for (const forbidden of [
    "decisionRecords",
    "governanceSessions",
    "actionPermits",
    "hebyActionRequests",
    "writeGovernanceDecision",
    "recordActionRequest",
    "approveActionRequest",
    "consumeActionPermit",
    "revokeActionPermit",
    "schema/execution",
  ]) {
    assert.ok(
      !R3R_CODE.includes(forbidden),
      `recording an address is not approving one — R3R must not reach ${forbidden}`,
    );
  }
  /* No network, no provider, no credential. */
  for (const forbidden of ["fetch(", "axios", "nodemailer", "smtp", "apiKey", "accessToken", "process.env.ANTHROPIC"]) {
    assert.ok(!R3R_CODE.includes(forbidden), `R3R must not reach ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE ADDRESS BYTES HAVE NO UPDATE PATH ANYWHERE IN THE REPOSITORY.
 *
 * This is the release-critical one. If any module could UPDATE `endpointValue`, a permit already
 * approved for jane@old.com would silently start meaning jane@new.com.
 * ═════════════════════════════════════════════════════════════════════════ */

function endpointBytesAreNeverUpdated(): void {
  const everySource = collect("src")
    .filter((f) => !f.includes("db/migrations"))
    .map((f) => ({ file: f, code: codeOf(read(f)) }));

  for (const { file, code } of everySource) {
    if (!code.includes("externalRecipients")) continue;
    /* Find every `.set({...})` in a file that touches the table and read what it assigns. */
    for (const match of code.matchAll(/\.set\(\s*\{([\s\S]*?)\}\s*\)/g)) {
      const assigned = match[1]!;
      for (const immutable of ["endpointValue", "endpointDigest", "endpointKind"]) {
        assert.ok(
          !assigned.includes(immutable),
          `${file} assigns ${immutable} in an UPDATE — the address must be replaced, never edited`,
        );
      }
    }
  }

  /* And exactly one module writes the table at all. */
  const writers = everySource.filter(
    ({ code }) => /\.insert\(\s*externalRecipients/.test(code) || /\.update\(\s*externalRecipients/.test(code),
  );
  assert.deepEqual(
    writers.map((w) => w.file),
    ["src/features/external-recipients/write-external-recipients.server.ts"],
    "exactly one module writes external_recipients",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. HUMAN-ONLY CREATION, STRUCTURALLY.
 * ═════════════════════════════════════════════════════════════════════════ */

function creationIsHumanOnly(): void {
  const writer = codeOf(read("src/features/external-recipients/write-external-recipients.server.ts"));

  assert.ok(
    /createdByType:\s*"human"/.test(writer),
    "the author type is a hard-coded literal, not a parameter",
  );
  assert.ok(
    !/createdByType:\s*(?!"human")/.test(writer.replace(/createdByType:\s*"human"/g, "")),
    "there is no other value it could take",
  );
  assert.ok(
    !/"agent"/.test(writer),
    "no agent path exists — Heby cannot record a recipient",
  );

  /*
   * R3W deliberately HAS an agent path (`createWorkArtifactFromHebyPreparation`). The asymmetry is
   * the point: an artifact is inert text the tenant owns, an address is a claim about a real person
   * who becomes the target of an irreversible act. Pin that the two really do differ, so a future
   * "consistency" refactor cannot quietly give Heby this one.
   */
  const artifactWriter = codeOf(read("src/features/work-artifacts/write-work-artifacts.server.ts"));
  assert.ok(
    /FromHebyPreparation/.test(artifactWriter),
    "R3W has an agent authoring path…",
  );
  assert.ok(
    !/Heby|heby/.test(codeOf(read("src/features/external-recipients/write-external-recipients.server.ts"))),
    "…and R3R deliberately has none",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. NO VERIFICATION CLAIM, ANYWHERE.
 * ═════════════════════════════════════════════════════════════════════════ */

function noVerificationClaim(): void {
  /*
   * THE GUARD ASSERTS CLAIMS, NOT VOCABULARY. Banning the literal "verified" is the brittle kind of
   * guard this repository has already been bitten by, and it fires on exactly the sentence we most
   * want to keep: the provenance line reads "never verified". A denial is the opposite of a claim.
   *
   * So identifiers are checked with string literals REMOVED, and the user-visible strings are
   * checked separately for an affirmative claim.
   */
  const identifiers = R3R_CODE.replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");

  for (const forbidden of [
    "verified",
    "verifiedAt",
    "isDeliverable",
    "confidence",
    "trustScore",
    "certainty",
    "leadScore",
    "opportunityStage",
    "lifetimeValue",
    "campaign",
    "pipeline",
  ]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\b`, "i").test(identifiers),
      `R3R must not name a "${forbidden}" value — nothing here could establish it`,
    );
  }

  /* No STRING may assert the address is good; saying it is NOT verified is required, not banned. */
  for (const claim of [
    /\bis verified\b/i,
    /\bverified (recipient|address|email)\b/i,
    /\bconfirmed (address|recipient)\b/i,
    /\bdeliverable\b(?!.*\bnever\b)/i,
  ]) {
    assert.ok(!claim.test(R3R_CODE), `no surface string may claim ${claim}`);
  }
  const evidence = read("src/features/external-recipients/recipient-evidence.server.ts");
  assert.ok(
    /never verified/i.test(evidence),
    "and the provenance says so explicitly, rather than staying silent",
  );

  const schema = codeOf(read("src/db/schema/external-recipient.ts")).replace(
    /"(?:[^"\\]|\\.)*"/g,
    '""',
  );
  for (const forbidden of ["verified", "score", "stage", "owner", "notes", "tags", "providerId"]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}`, "i").test(schema),
      `the table must not carry a "${forbidden}" column`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE VOCABULARY IS MINIMAL AND CLOSED.
 * ═════════════════════════════════════════════════════════════════════════ */

function vocabularyIsMinimal(): void {
  assert.deepEqual(
    RECIPIENT_ENDPOINT_KINDS,
    ["email"],
    "exactly one channel — the only address shape with evidence behind it",
  );
  assert.equal(isRecipientEndpointKind("email"), true);
  for (const not of ["sms", "phone", "whatsapp", "linkedin", "uri", "", null, 1]) {
    assert.equal(isRecipientEndpointKind(not), false);
  }

  const enums = codeOf(read("src/db/schema/_enums.ts"));
  assert.ok(
    /externalRecipientStatusEnum[\s\S]*?"active",\s*"retired",?\s*\]/.test(enums),
    "two states, and `invalid` is absent because no writer could establish it",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE SOURCE CLASS IS REGISTERED, AND THE PURE RESOLVER STAYS HONEST.
 * ═════════════════════════════════════════════════════════════════════════ */

function sourceClassIsRegisteredAndHonest(): void {
  assert.ok(
    (HEBY_SOURCE_CLASSES as readonly string[]).includes("external-recipients"),
    "the source class exists in the vocabulary",
  );

  /*
   * The PURE resolver holds no tenant and can open no connection, so it must report unavailable
   * rather than invent items. Here that matters more than anywhere else in the codebase: a
   * fabricated item in this class would be a real person's address that nobody recorded.
   */
  const resolution = resolveSource("external-recipients");
  assert.equal(resolution.state, "unavailable");
  assert.equal(resolution.items.length, 0);
  assert.equal(resolution.authoritative, false);
  assert.ok(resolution.unavailableReason!.length > 0, "and it says why");

  /* Even with an overview in hand, it cannot manufacture a recipient. */
  assert.equal(
    resolveSource("external-recipients", { sections: [] } as never).items.length,
    0,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. THE ACTION REGISTRY WAS NOT LOOSENED.
 * ═════════════════════════════════════════════════════════════════════════ */

function registryNotLoosened(): void {
  const tool = getActionToolByKind("send-external-communication");
  assert.ok(tool, "the tool still exists");
  assert.equal(tool!.substrateConnected, false, "R3R connects NO execution substrate");
  assert.equal(tool!.authorityRequirement, "human-review-required");
  assert.equal(tool!.governanceGated, true);
  assert.equal(tool!.sideEffect, "CONSEQUENTIAL_MUTATION");
  assert.equal(tool!.reversibility, "irreversible");

  const recipientField = tool!.argumentSchema.fields.find((f) => f.name === "recipientRef");
  assert.ok(recipientField, "recipientRef is still declared");
  assert.equal(
    recipientField!.kind,
    "record-ref",
    "still a REFERENCE, never a string address — a model may not name a destination",
  );
  assert.equal(recipientField!.required, true);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 10. THE PRIVACY BOUNDARY: the address never reaches the model or an audit row.
 * ═════════════════════════════════════════════════════════════════════════ */

function privacyBoundary(): void {
  const evidence = codeOf(read("src/features/external-recipients/recipient-evidence.server.ts"));
  assert.ok(
    !/content:\s*recipient\.endpointValue/.test(evidence),
    "the address must not be placed in ResolvedSourceItem.content — that goes to the model provider",
  );
  assert.ok(
    !/endpointValue/.test(evidence.replace(/detail:[^\n]*/g, "")),
    "the evidence item carries a reference and a label, never the address",
  );

  /* No console logging of anything, anywhere in the domain. */
  assert.ok(!/console\.(log|info|warn|error)/.test(R3R_CODE), "R3R logs nothing");

  /* Retirement is not erasure, and the writer must not pretend otherwise. */
  const writer = codeOf(read("src/features/external-recipients/write-external-recipients.server.ts"));
  assert.ok(!/\.delete\(/.test(writer), "retirement is a status change, not a delete");
}

authFirewall();
knowledgeAndMemoryFirewall();
governanceAndExecutionFirewall();
endpointBytesAreNeverUpdated();
creationIsHumanOnly();
noVerificationClaim();
vocabularyIsMinimal();
sourceClassIsRegisteredAndHonest();
registryNotLoosened();
privacyBoundary();

console.log("PASS r3r boundaries and firewall");
