/*
 * KT-3 — the public-use decision: its state machine, its words, and its boundaries. No database.
 *
 * THE CLAIMS UNDER TEST:
 *   - three derived states and four transitions, nothing else;
 *   - its own subject, domain and outcome words, so the ledger can never confuse "may this be used
 *     publicly" with "is this true";
 *   - the projection is Governance's and read-only; the writer is the one Governance writer;
 *   - NOTHING consumes it yet: retrieval, Heby, content preparation, readiness and publication do not
 *     import it (enforcement is a later phase);
 *   - the domain is an additive enum value, nothing more.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  PUBLIC_USE_ACTIONS,
  PUBLIC_USE_DECISION_TYPE,
  PUBLIC_USE_DOMAIN,
  PUBLIC_USE_NON_CLAIMS,
  PUBLIC_USE_OUTCOME,
  PUBLIC_USE_STATE_LABELS,
  PUBLIC_USE_SUBJECT_TYPE,
  nextPublicUseState,
  publicUseStateFromDecisionType,
  type PublicUseAction,
  type PublicUseState,
} from "../../src/features/knowledge-public-use/contracts";
import { RATIFICATION_SUBJECT_TYPE } from "../../src/features/knowledge-ratification/contracts";
import {
  GOVERNANCE_SUBJECT_TYPES,
  SUBJECT_GOVERNANCE_DOMAIN,
} from "../../src/features/governance-decision/contracts";
import { governanceDomainEnum } from "../../src/db/schema/_enums";
import { DECISION_SOURCE_KEYS, DECISION_SOURCE_OWNERS } from "../../src/features/decision-horizon/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
function importsOf(source: string): string[] {
  return [...codeOf(source).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
}
function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return collect(rel);
    return e.isFile() && /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

const PROJECTION = "src/features/governance-decision/knowledge-public-use-read.server.ts";
const DECIDE = "src/features/knowledge-public-use/decide-public-use.server.ts";
const CONTROL = "src/components/knowledge-workspace/knowledge-public-use-control.tsx";
const WRITER = "src/features/governance-decision/decision-authority.server.ts";

function main(): void {
  /* ── 1. THE STATE MACHINE: four transitions, everything else refused ──────── */
  {
    const table: Record<PublicUseState, Record<PublicUseAction, PublicUseState | null>> = {
      unknown: { allow: "allowed", deny: "denied", revoke: null },
      allowed: { allow: null, deny: null, revoke: "denied" },
      denied: { allow: "allowed", deny: null, revoke: null },
    };
    for (const from of ["unknown", "allowed", "denied"] as const) {
      for (const action of PUBLIC_USE_ACTIONS) {
        assert.equal(nextPublicUseState(from, action), table[from][action], `${from} --${action}-->`);
      }
    }
    assert.deepEqual([...PUBLIC_USE_ACTIONS].sort(), ["allow", "deny", "revoke"]);
    assert.equal(publicUseStateFromDecisionType("approve"), "allowed");
    assert.equal(publicUseStateFromDecisionType("reject"), "denied");
    assert.equal(publicUseStateFromDecisionType("revoke"), "denied");
    assert.equal(publicUseStateFromDecisionType("ratify"), null, "a truth word never becomes a use state");
  }

  /* ── 2. ITS OWN SUBJECT, DOMAIN AND LEDGER WORDS ─────────────────────────── */
  {
    assert.notEqual(PUBLIC_USE_SUBJECT_TYPE, RATIFICATION_SUBJECT_TYPE, "use is not truth");
    assert.equal(PUBLIC_USE_DOMAIN, "knowledge-public-use");
    assert.notEqual(PUBLIC_USE_DOMAIN, SUBJECT_GOVERNANCE_DOMAIN.knowledge_node);
    assert.ok((governanceDomainEnum.enumValues as readonly string[]).includes(PUBLIC_USE_DOMAIN), "the domain is in the enum");
    assert.ok(
      !(GOVERNANCE_SUBJECT_TYPES as readonly string[]).includes(PUBLIC_USE_SUBJECT_TYPE),
      "the generic G2 path does not accept it — only its own seam writes it",
    );
    assert.deepEqual(PUBLIC_USE_DECISION_TYPE, { allow: "approve", deny: "reject", revoke: "revoke" });
    const outcomes = Object.values(PUBLIC_USE_OUTCOME);
    for (const word of outcomes) {
      assert.match(word, /^public-use-/, "every outcome word names public use");
      assert.ok(!/ratif|true|truth|approved$|rejected$/.test(word), `${word} says nothing about truth`);
    }
    const writer = codeOf(read(WRITER));
    assert.ok(/PUBLIC_USE_SUBJECT_TYPE/.test(writer), "the one Governance writer knows the subject");
    // The subject must be matched BEFORE the generic approve/revoke/reject branches.
    assert.ok(
      writer.indexOf("PUBLIC_USE_SUBJECT_TYPE ?") < writer.indexOf('input.decisionType === "revoke"'),
      "public-use outcomes are chosen by subject before any generic branch",
    );
  }

  /* ── 3. THE WORDS: ALLOWED IS NOT TRUE, RATIFIED IS NOT PUBLIC ───────────── */
  {
    const joined = PUBLIC_USE_NON_CLAIMS.join(" ");
    assert.match(joined, /allowed[^.]*not[^.]*true/i);
    assert.match(joined, /ratif[^.]*not[^.]*public/i);
    assert.match(joined, /not yet|does not yet|no effect/i, "it says nothing is enforced yet");
    assert.deepEqual(Object.keys(PUBLIC_USE_STATE_LABELS).sort(), ["allowed", "denied", "unknown"]);
    assert.ok(!/true|verified|approved fact/i.test(Object.values(PUBLIC_USE_STATE_LABELS).join(" ")));
  }

  /* ── 4. THE PROJECTION IS GOVERNANCE'S AND READ-ONLY ─────────────────────── */
  {
    const code = codeOf(read(PROJECTION));
    assert.ok(/export async function readKnowledgePublicUse\b/.test(code));
    assert.ok(!/\.insert\(|\.update\(|\.delete\(|\.transaction\(/.test(code));
    assert.ok(/"decision_records"\."tenant_id" = \$\{/.test(code), "tenant-scoped by predicate");
    assert.ok(!/knowledge_nodes|knowledge_facts|@\/db\/schema\/knowledge/.test(code), "reads no Knowledge table");
    assert.ok(!importsOf(read(PROJECTION)).some((i) => /knowledge-ratification|decision-authority/.test(i)));
    assert.ok(!/decision_records/.test(codeOf(read("src/features/knowledge/durable-knowledge-repository.server.ts"))));
  }

  /* ── 5. THE WRITER IS THE ONE GOVERNANCE WRITER, AND KNOWLEDGE IS NOT TOUCHED ─ */
  {
    const code = codeOf(read(DECIDE));
    assert.ok(/writeGovernanceDecisionWithin\(/.test(code), "decisions go through the existing writer");
    assert.ok(!/\.update\(|\.insert\(|\.delete\(/.test(code), "the seam writes no table of its own");
    assert.ok(!/recordKnowledgeMutationWithin/.test(code), "a use decision is not a Knowledge mutation");
    assert.ok(/recordGovernanceEventWithin\(/.test(code), "and it files the Governance audit event");
  }

  /* ── 6. ENFORCEMENT IS OFF: NOTHING CONSUMES THE DECISION YET ────────────── */
  {
    const consumers = collect("src").filter((f) =>
      importsOf(read(f)).some((i) => /knowledge-public-use/.test(i)),
    );
    const allowed = new Set([
      "src/features/knowledge-public-use/decide-public-use.server.ts",
      "src/features/governance-decision/knowledge-public-use-read.server.ts",
      "src/features/governance-decision/decision-authority.server.ts",
      "src/features/decision-horizon/read-decision-horizon.server.ts",
      "src/app/(dashboard)/knowledge/actions.ts",
      "src/app/(dashboard)/knowledge/page.tsx",
      "src/components/knowledge-workspace/knowledge-review-card.tsx",
      CONTROL,
    ]);
    for (const file of consumers) {
      assert.ok(allowed.has(file), `${file} must not consume public-use decisions in this phase`);
    }
    for (const dir of [
      "src/features/knowledge-retrieval",
      "src/features/knowledge",
      "src/features/heby-answer",
      "src/features/work-artifacts",
      "src/features/content-composition",
      "src/features/content-grounding",
      "src/features/heby-action-inlet",
      "src/features/action-execution",
      "src/features/instagram-publishing",
      "src/features/youtube-publishing",
    ]) {
      for (const file of collect(dir)) {
        assert.ok(!/public-use|publicUse|PublicUse/.test(codeOf(read(file))), `${file} is untouched by public use`);
      }
    }
  }

  /* ── 7. THE CLIENT CONTROL HOLDS NO AUTHORITY AND NO SERVER MODULE ───────── */
  {
    const control = read(CONTROL);
    assert.ok(control.startsWith('"use client";'));
    for (const imp of importsOf(control)) assert.ok(!/\.server/.test(imp), `no server module in the client (${imp})`);
    assert.ok(!/tenantId|userId/.test(codeOf(control)));
    const actions = codeOf(read("src/app/(dashboard)/knowledge/actions.ts"));
    const start = actions.indexOf("export async function decideKnowledgePublicUseAction");
    assert.ok(start > 0);
    const body = actions.slice(start, start + 700);
    assert.ok(body.includes("resolveTenantContext()"));
    for (const forbidden of ["tenantId:", "userId:", "outcome:", "decisionId:"]) assert.ok(!body.includes(forbidden));
  }

  /* ── 8. THE HORIZON KEEPS TRUTH AND USE APART ────────────────────────────── */
  {
    assert.ok(DECISION_SOURCE_KEYS.includes("knowledge-review"));
    assert.ok(DECISION_SOURCE_KEYS.includes("knowledge-public-use"));
    assert.notEqual(DECISION_SOURCE_OWNERS["knowledge-public-use"].subject, DECISION_SOURCE_OWNERS["knowledge-review"].subject);
    assert.match(DECISION_SOURCE_OWNERS["knowledge-public-use"].subject, /public/i);
  }

  /* ── 9. THE MIGRATION ADDS ONE ENUM VALUE AND NOTHING ELSE ───────────────── */
  {
    const dir = "src/db/migrations";
    const files = readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".sql"));
    const mine = files.filter((f) => read(path.join(dir, f)).includes("'knowledge-public-use'"));
    assert.equal(mine.length, 1, "exactly one migration names the domain");
    const statements = read(path.join(dir, mine[0]!))
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    assert.deepEqual(statements, [`ALTER TYPE "public"."governance_domain" ADD VALUE 'knowledge-public-use';`]);
  }

  console.log("PASS kt3 public-use state machine and firewall");
}

main();
