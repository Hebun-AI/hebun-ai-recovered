/*
 * KT-2 — the review-evidence projection's surface and boundaries, without a database.
 *
 * THE CLAIMS UNDER TEST:
 *   - the evidence renders INSIDE the existing review control: no second review screen, no route;
 *   - the words say "evidence supplied to generation" and deny that it proves the revision's claims;
 *   - the projection is a READ composed of three existing authorities' own reads (the revision, the
 *     recorded evidence, the replay projection) — it re-runs no retrieval, reads no current
 *     Knowledge, holds no writer and no Governance write seam;
 *   - the client names a revision; the tenant comes from the session;
 *   - no server module reaches a client chunk.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  REVISION_EVIDENCE_NON_CLAIMS,
  REVISION_EVIDENCE_NOTICE,
} from "../../src/features/heby-answer/revision-generation-evidence";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/** Source with comments stripped: assertions are about CODE, not about what prose discusses. */
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

const SERVER = "src/features/heby-answer/revision-generation-evidence.server.ts";
const CONTRACTS = "src/features/heby-answer/revision-generation-evidence.ts";
const PANEL = "src/components/operations-preparation/revision-generation-evidence.tsx";
const CARD = "src/components/operations-preparation/artifact-revision-review.tsx";
const ACTIONS = "src/app/(dashboard)/operations/actions.ts";
const READER = "src/features/work-artifacts/read-work-artifacts.server.ts";

function main(): void {
  /* ── 1. THE WORDS: SUPPLIED TO GENERATION, NOT PROOF OF THE CLAIMS ──────── */
  {
    assert.match(REVISION_EVIDENCE_NOTICE, /evidence supplied to generation/i);
    assert.match(REVISION_EVIDENCE_NOTICE, /not proof/i);
    const joined = REVISION_EVIDENCE_NON_CLAIMS.join(" ");
    assert.match(joined, /every sentence/i, "it denies sentence-level support");
    assert.match(joined, /re-?run|re-?search|current Knowledge/i, "it says it is historical, not a fresh search");
    assert.ok(!/\bconfiden|\bcitation/i.test(REVISION_EVIDENCE_NOTICE + joined), "no invented confidence or citations");
  }

  /* ── 2. ONE REVIEW SURFACE: THE PANEL LIVES INSIDE THE EXISTING CONTROL ── */
  {
    const card = codeOf(read(CARD));
    assert.ok(/<RevisionGenerationEvidence\s/.test(card), "the existing review control renders the evidence");
    assert.ok(card.includes("ARTIFACT_REVIEW_PUBLICATION_NOTICE"), "and still renders what acceptance is not");
    const users = collect("src").filter((f) => f !== PANEL && f.endsWith(".tsx") && /<RevisionGenerationEvidence\s/.test(codeOf(read(f))));
    assert.deepEqual(users.sort(), [CARD], "nothing else renders it — there is no second review screen");
    assert.ok(
      !collect("src/app").some((f) => /evidence/i.test(f) && /page\.tsx$/.test(f) && f.includes("operations")),
      "no new route",
    );
  }

  /* ── 3. THE CLIENT PANEL HOLDS NO AUTHORITY AND NO SERVER MODULE ────────── */
  {
    const panel = read(PANEL);
    assert.ok(panel.startsWith('"use client";'));
    for (const imp of importsOf(panel)) {
      assert.ok(!/\.server/.test(imp), `the panel names no server module, even for types (${imp})`);
    }
    assert.ok(importsOf(panel).includes("@/app/(dashboard)/operations/actions"));
    assert.ok(importsOf(panel).includes("@/features/heby-answer/revision-generation-evidence"));
    assert.ok(codeOf(panel).includes("REVISION_EVIDENCE_NOTICE"), "the notice renders verbatim");
    assert.ok(!/tenantId|userId/.test(codeOf(panel)), "the panel names no tenant and no actor");
    const contracts = codeOf(read(CONTRACTS));
    assert.ok(!importsOf(read(CONTRACTS)).some((imp) => /\.server/.test(imp)), "the shared contract is client-safe");
    assert.ok(!/\bawait\b|\basync\b/.test(contracts), "the contract does no I/O");
  }

  /* ── 4. THE ACTION TAKES A REVISION; THE TENANT COMES FROM THE SESSION ──── */
  {
    const actions = codeOf(read(ACTIONS));
    const start = actions.indexOf("export async function readRevisionGenerationEvidenceAction");
    assert.ok(start > 0);
    const body = actions.slice(start, start + 500);
    assert.ok(body.includes("resolveTenantContext()"), "the tenant is resolved server-side");
    for (const forbidden of ["tenantId:", "userId:", "actorId:", "sourceMessageId", "messageId"]) {
      assert.ok(!body.includes(forbidden), `the client supplies no ${forbidden}`);
    }
  }

  /* ── 5. THE PROJECTION IS A READ OF RECORDED PROVENANCE, NOTHING ELSE ───── */
  {
    const server = codeOf(read(SERVER));
    const imports = importsOf(read(SERVER));
    for (const required of [
      "@/features/work-artifacts/read-work-artifacts.server",
      "@/features/heby-conversation/durable-conversation-repository.server",
      "@/features/heby-conversation/answer-evidence",
    ]) {
      assert.ok(imports.includes(required), `it composes the existing read ${required}`);
    }
    /* GS-1: the one exception is the PURE claim-support check (no I/O; its own test pins its imports). */
    for (const imp of imports.filter((i) => i !== "@/features/knowledge-retrieval/claim-support")) {
      assert.ok(
        !/knowledge-read|knowledge-retrieval|durable-knowledge|knowledge-evidence|knowledge-ratification|knowledge-rejection/.test(imp),
        `it re-runs no retrieval and reads no current Knowledge (${imp})`,
      );
      assert.ok(!/write-work-artifacts|decision-authority|governance-audit|work-artifact-review|action-/.test(imp), `it holds no writer (${imp})`);
      assert.ok(!/provider-|integration-credentials|heby-model/.test(imp), `it reaches no provider or credential (${imp})`);
    }
    assert.ok(!/searchKnowledge|listKnowledgeSources|persistExchange|appendMessage|createConversation/.test(server));
    assert.ok(!/\.insert\(|\.update\(|\.delete\(|\.transaction\(/.test(server), "it writes nothing");
    assert.ok(/listAnswerEvidence\(/.test(server), "historical evidence comes from the recorded rows");
    assert.ok(/fromStoredEvidence\(/.test(server), "through the same replay projection a reloaded answer uses");
  }

  /* ── 6. THE REVISION READ STAYS A READ ─────────────────────────────────── */
  {
    const reader = codeOf(read(READER));
    assert.ok(/export async function readRevisionProvenance/.test(reader));
    assert.ok(!/\.insert\(|\.update\(|\.delete\(/.test(reader), "the Work Artifact reader still writes nothing");
  }

  console.log("PASS kt2 review evidence surface and firewall");
}

main();
