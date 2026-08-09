/*
 * governance-overview/model.ts — builds the Governance Overview truth surface (Hebun UI Phase 23B).
 *
 * A structural availability map grounded in repository reality: the real policy engine is
 * derived-from-seed; Security Center is real (Phase 19); human approvals are external
 * (Decisions); the execution governance gate is not connected (Operations Phase 22); Heby is
 * restricted/advisory (read from the real Heby governance profile). It imports NO
 * @/features/governance mock and fabricates no percentage, count, health, or timestamp.
 */

import { getHebyWorkspaceProfile } from "@/features/heby-integration";
import type { GovernanceAreaView, GovernanceOverviewModel } from "./contracts";

function hebyGovernanceStatus(): { status: "restricted"; detail: string } {
  const profile = getHebyWorkspaceProfile("governance");
  const allContractOnly = profile.capabilities.every((c) => c.state === "contract-only");
  return {
    status: "restricted",
    detail: allContractOnly
      ? "Heby Governance is advisory-only (governance-inspection and evidence-tracing are contract-only). It explains policy; it never modifies policy, grants authority, approves, or decides."
      : "Heby Governance is advisory-only. It explains policy; it never modifies policy, grants authority, approves, or decides.",
  };
}

/** Build the Governance Overview model. Pure, synchronous, read-only. */
export function getGovernanceOverviewModel(): GovernanceOverviewModel {
  const heby = hebyGovernanceStatus();

  const availability: readonly GovernanceAreaView[] = [
    {
      area: "Policies & Rules",
      question: "What policy/rule machinery exists?",
      status: "derived-seeded",
      authorityOwner: "Governance",
      backing: "policy engine",
      canMutate: false,
      detail: "A real deterministic policy/rule evaluation engine exists, but its policies and inputs are seeded — derived, not live organizational policy.",
      href: "/director/governance/policies",
    },
    {
      area: "Compliance evaluation",
      question: "Is anything compliant?",
      status: "derived-seeded",
      authorityOwner: "Governance",
      backing: "policy compliance engine",
      canMutate: false,
      detail: "Compliance is evaluated deterministically over seeded input. No live compliance certification exists; no fabricated compliance score is presented.",
    },
    {
      area: "Risk evaluation",
      question: "What risk is known?",
      status: "derived-seeded",
      authorityOwner: "Governance",
      backing: "policy risk engine",
      canMutate: false,
      detail: "Risk is evaluated deterministically over seeded input — a derived risk posture, not a confirmed organizational risk.",
    },
    {
      area: "Audit & Explainability",
      question: "Why did the system act?",
      status: "derived-seeded",
      authorityOwner: "Governance",
      backing: "policy audit / explanation",
      canMutate: false,
      detail: "The engine builds a deterministic audit trace and explanation over seeded input. There is no durable audit persistence; no audit health is fabricated.",
    },
    {
      area: "Security Center",
      question: "What is the security posture?",
      status: "authoritative-real",
      authorityOwner: "Governance",
      backing: "security-center (Phase 19)",
      canMutate: false,
      detail: "The real, authoritative security intelligence, evidence, and response boundary. Governance links to it; it is not duplicated here.",
      href: "/director/governance/security",
    },
    {
      area: "Human decisions",
      question: "Who approves?",
      status: "external-authority",
      authorityOwner: "Decisions",
      backing: "Decisions (/approvals)",
      canMutate: false,
      detail: "Human approval is not Governance's authority. Governance constrains and informs a decision; the decision is made in Decisions.",
      href: "/approvals",
    },
    {
      area: "Execution governance gate",
      question: "Does governance gate live execution?",
      status: "not-connected",
      authorityOwner: "Operations",
      backing: "no live evaluator",
      canMutate: false,
      detail: "No live governance evaluator is connected to execution (Operations Phase 22). The policy evaluation engine is not the live execution governance gate.",
      href: "/director/execution-substrate",
    },
    {
      area: "Heby Governance",
      question: "What may Heby do here?",
      status: heby.status,
      authorityOwner: "Heby (advisory)",
      backing: "heby-integration profile",
      canMutate: false,
      detail: heby.detail,
    },
  ];

  return {
    availability,
    note: "Governance holds the rules — policy, constraints, evaluation, compliance, risk, audit, and the security posture. It authorizes no human decision and executes nothing. States are honest: real where real, derived where seeded, not-connected where nothing is wired.",
  };
}
