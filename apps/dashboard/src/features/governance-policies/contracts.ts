/*
 * governance-policies/contracts.ts — read-only presentation contract for the
 * Policies & Rules surface (Hebun UI Phase 23B).
 *
 * Policies & Rules answers: "what policy/rule evaluation machinery exists, what is its
 * provenance, and what can we truthfully inspect?" It surfaces the REAL policy engine
 * (features/policy: registry + governance pipeline) — but its policy definitions and
 * reasoning inputs are SEEDED, so every record is labelled DERIVED · SEEDED INPUT and never
 * presented as live organizational policy truth. It is READ-ONLY: no create/edit/enable/
 * approve/enforce control, no fabricated compliance/risk/audit score, no fake policy count.
 *
 * Distinctions kept explicit: policy definition ≠ enforcement; evaluation ≠ authorization;
 * evaluation ≠ execution; constraint ≠ human decision; seeded ≠ live; derived ≠ authoritative.
 */

import type { PolicyCategory, ApprovalMode } from "@/features/policy/types";

/** A structural policy/rule definition from the real engine — provenance is seeded. */
export interface PolicyRuleView {
  readonly id: string;
  readonly name: string;
  readonly category: PolicyCategory;
  readonly owner: string;
  readonly description: string;
  /** Registry keys this rule applies to (structural). */
  readonly appliesTo: readonly string[];
  /** The approval path a decision under this rule would require (never executed here). */
  readonly approvalMode: ApprovalMode;
  readonly reviewRequired: boolean;
}

/** One deterministic step of the real governance evaluation pipeline (structural). */
export interface PipelineStepView {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface PoliciesRulesModel {
  /** Engine availability — always DERIVED · SEEDED INPUT; no live store/evaluator connected. */
  readonly engine: {
    readonly provenance: "derived-seeded";
    readonly headline: string;
    readonly detail: string;
  };
  /** The real deterministic evaluation pipeline (structural machinery, not fabricated data). */
  readonly pipeline: readonly PipelineStepView[];
  /** Policy/rule definitions from the real registry — labelled derived-from-seed. */
  readonly rules: readonly PolicyRuleView[];
  /** The provenance chain — where policies and inputs come from. */
  readonly provenance: readonly string[];
  /** The mutation/authority boundary — distinctions kept explicit. */
  readonly boundaries: readonly string[];
}
