/*
 * TRH-10 — structural boundaries around Governance-backed artifact review.
 *
 * These prove claims about what does NOT exist: no second decision writer, no approval column, no
 * revision creation, no permit, no execution, and no way for a client to supply a tenant or an
 * outcome. Runtime behaviour lives in `review-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ARTIFACT_REVIEW_ACCEPTED_OUTCOME,
  ARTIFACT_REVIEW_ACCEPT_EFFECT,
  ARTIFACT_REVIEW_ACCEPT_NON_EFFECTS,
  ARTIFACT_REVIEW_ACCEPT_TYPE,
  ARTIFACT_REVIEW_DOMAIN,
  ARTIFACT_REVIEW_HISTORY_IS_APPEND_ONLY,
  ARTIFACT_REVIEW_PUBLICATION_NOTICE,
  ARTIFACT_REVIEW_REJECTED_OUTCOME,
  ARTIFACT_REVIEW_REJECT_NON_EFFECTS,
  ARTIFACT_REVIEW_REJECT_TYPE,
  ARTIFACT_REVIEW_REVISION_SCOPE_NOTICE,
  ARTIFACT_REVIEW_SUBJECT_TYPE,
} from "../../src/features/work-artifact-review/contracts";
import {
  GOVERNANCE_SUBJECT_TYPES,
  SUBJECT_GOVERNANCE_DOMAIN,
} from "../../src/features/governance-decision/contracts";
import { workArtifactLifecycleStatusEnum, governanceDomainEnum } from "../../src/db/schema/_enums";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CONTRACTS = "src/features/work-artifact-review/contracts.ts";
const WRITER = "src/features/work-artifact-review/review-revision.server.ts";
const ACTIONS = "src/app/(dashboard)/operations/actions.ts";
const CARD = "src/components/operations-preparation/artifact-revision-review.tsx";
const SECTION = "src/components/operations-preparation/prepared-work-section.tsx";

function main(): void {
  /* ── 1. THE SUBJECT IS A REVISION, AND THE DOMAIN IS ITS OWN ─────────────── */
  {
    assert.equal(ARTIFACT_REVIEW_SUBJECT_TYPE, "work_artifact_revision");
    assert.ok(
      GOVERNANCE_SUBJECT_TYPES.includes(ARTIFACT_REVIEW_SUBJECT_TYPE),
      "the subject joined the closed Governance vocabulary",
    );
    assert.equal(
      SUBJECT_GOVERNANCE_DOMAIN[ARTIFACT_REVIEW_SUBJECT_TYPE],
      ARTIFACT_REVIEW_DOMAIN,
      "the subject maps to its own domain",
    );
    assert.equal(ARTIFACT_REVIEW_DOMAIN, "artifact-review");
    assert.ok(
      (governanceDomainEnum.enumValues as readonly string[]).includes(ARTIFACT_REVIEW_DOMAIN),
      "the domain exists in the released enum, so migration 48 and the contract cannot drift",
    );
    /*
     * THE SUBJECT MUST NOT BE THE ARTIFACT. Binding to `work_artifacts.id` would mean "whatever
     * bytes are current when someone reads this" — the approximation K4 removed `knowledge_fact`
     * for. The word is asserted, not the intent.
     */
    assert.ok(
      !(GOVERNANCE_SUBJECT_TYPES as readonly string[]).includes("work_artifact"),
      "an artifact-level subject is not representable",
    );
  }

  /* ── 2. NO NEW DECISION WORDS, AND THE OUTCOMES DO NOT SAY 'APPROVED' ────── */
  {
    assert.equal(ARTIFACT_REVIEW_ACCEPT_TYPE, "approve");
    assert.equal(ARTIFACT_REVIEW_REJECT_TYPE, "reject");
    /*
     * The ledger words must not read as publication or execution. A row read years from now says
     * a REVISION was accepted, never that anything was approved for the world.
     */
    assert.match(ARTIFACT_REVIEW_ACCEPTED_OUTCOME, /^artifact-revision-accepted$/);
    assert.match(ARTIFACT_REVIEW_REJECTED_OUTCOME, /^artifact-revision-changes-requested$/);
    for (const outcome of [ARTIFACT_REVIEW_ACCEPTED_OUTCOME, ARTIFACT_REVIEW_REJECTED_OUTCOME]) {
      assert.ok(!/publish|execut|authoriz/i.test(outcome), `${outcome} claims no external act`);
    }
  }

  /* ── 3. THE ARTIFACT LIFECYCLE GAINED NOTHING ───────────────────────────── */
  {
    assert.deepEqual(
      [...workArtifactLifecycleStatusEnum.enumValues],
      ["draft", "retired"],
      "review added no approved/rejected lifecycle value",
    );
  }

  /* ── 4. THE WRITER TOUCHES NO ARTIFACT TABLE ────────────────────────────── */
  {
    const writer = codeOf(read(WRITER));
    for (const forbidden of [
      "update(workArtifacts)",
      "update(workArtifactRevisions)",
      "insert(workArtifactRevisions)",
      "insert(workArtifacts)",
      "delete(",
      "currentRevision",
    ]) {
      assert.ok(!writer.includes(forbidden), `the review writer must not reach ${forbidden}`);
    }
    /*
     * It reads the revision and writes only the ledger. The decision goes through the EXISTING
     * Governance authority — a second decision writer is the thing this phase must not become.
     */
    assert.ok(writer.includes("writeGovernanceDecisionWithin"), "it reuses the G2 decision writer");
    assert.ok(writer.includes("recordGovernanceEventWithin"), "it reuses the Governance audit seam");
    assert.ok(
      !writer.includes("insert(decisionRecords)") && !writer.includes("insert(governanceSessions)"),
      "it does not write decisions or sessions itself",
    );
  }

  /* ── 5. NO PERMIT, NO EXECUTION, NO PROVIDER, NO KNOWLEDGE, NO WORK ─────── */
  {
    const surfaces = [read(WRITER), read(CONTRACTS), read(CARD)];
    for (const source of surfaces) {
      for (const banned of [
        "actionPermits",
        "action_permits",
        "hebyActionRequests",
        "actionExecutionAttempts",
        "integration",
        "knowledgeNodes",
        "knowledgeFacts",
        "workItems",
      ]) {
        assert.ok(
          !codeOf(source).includes(banned),
          `artifact review must not reach ${banned}`,
        );
      }
    }
  }

  /* ── 6. THE CLIENT SUPPLIES CONTENT-SHAPED VALUES ONLY ──────────────────── */
  {
    const actions = codeOf(read(ACTIONS));
    /*
     * Both actions resolve the tenant server-side. A tenant, an actor, an outcome or a decision id
     * arriving from a client would make every other guarantee decorative.
     */
    for (const fn of ["acceptArtifactRevisionAction", "requestArtifactRevisionChangesAction"]) {
      const start = actions.indexOf(`export async function ${fn}`);
      assert.ok(start > 0, `${fn} exists`);
      const body = actions.slice(start, start + 600);
      assert.ok(body.includes("resolveTenantContext()"), `${fn} resolves the tenant server-side`);
      for (const forbidden of ["tenantId:", "userId:", "outcome:", "decisionId:", "actorId:"]) {
        assert.ok(!body.includes(forbidden), `${fn} accepts no ${forbidden} from the client`);
      }
    }
  }

  /* ── 7. THE SURFACE STATES WHAT ACCEPTANCE IS NOT ───────────────────────── */
  {
    const card = read(CARD);
    assert.ok(card.includes("ARTIFACT_REVIEW_PUBLICATION_NOTICE"), "the publication notice renders");
    assert.ok(card.includes("ARTIFACT_REVIEW_ACCEPT_NON_EFFECTS"), "accept non-effects render");
    assert.ok(card.includes("ARTIFACT_REVIEW_REJECT_NON_EFFECTS"), "reject non-effects render");
    assert.ok(card.includes("ARTIFACT_REVIEW_REVISION_SCOPE_NOTICE"), "the scope notice renders");
    /*
     * A button reading only "Approve" on a draft addressed to Instagram would be read as approving
     * it FOR Instagram. The action must name the step it authorizes.
     */
    assert.match(card, /Accept for next internal step/);
    assert.ok(!/>\s*Approve\s*</.test(card), "no bare Approve control exists");

    assert.match(ARTIFACT_REVIEW_PUBLICATION_NOTICE, /not publication authorization/i);
    assert.match(ARTIFACT_REVIEW_PUBLICATION_NOTICE, /no provider is connected/i);
    assert.match(ARTIFACT_REVIEW_REVISION_SCOPE_NOTICE, /only to the displayed revision/i);
    assert.match(ARTIFACT_REVIEW_ACCEPT_EFFECT, /this exact revision/);
    assert.ok(
      ARTIFACT_REVIEW_ACCEPT_NON_EFFECTS.includes(
        "does not authorize publication, sending, or any external act",
      ),
    );
    assert.ok(
      ARTIFACT_REVIEW_REJECT_NON_EFFECTS.includes("does not create a new revision"),
      "requesting changes is a judgement, never a trigger",
    );
    // The control is mounted per revision on the released artifact surface.
    assert.match(read(SECTION), /ArtifactRevisionReview/);
  }

  /* ── 8. HISTORY IS APPEND-ONLY, AND THERE IS NO APPROVAL ROW ────────────── */
  {
    assert.equal(ARTIFACT_REVIEW_HISTORY_IS_APPEND_ONLY.priorDecisionsMutated, false);
    assert.equal(ARTIFACT_REVIEW_HISTORY_IS_APPEND_ONLY.priorDecisionsDeleted, false);
    assert.equal(ARTIFACT_REVIEW_HISTORY_IS_APPEND_ONLY.reversalRecordedAsNewDecision, true);
    assert.equal(ARTIFACT_REVIEW_HISTORY_IS_APPEND_ONLY.currentStateDerivedFromLatest, true);
    /*
     * The dead `approvals` table must stay dead. Reviving it would create the second approval
     * source of truth this whole design exists to avoid.
     */
    assert.ok(!codeOf(read(WRITER)).includes("approvals"), "the dead approvals schema stays dead");
  }

  console.log("PASS trh10 artifact review boundaries and firewall");
}

main();
