import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Decisions — Hebun AI" };

/*
 * Legacy Approval Center — retired in Hebun UI Phase 23D.
 *
 * This page presented a fabricated approval queue as organizational truth. Human decision authority is
 * not owned by Governance; it belongs to Decisions. Governance evaluates and explains; it does not
 * approve, reject, or authorize. The authoritative human-decision surface is Decisions at /approvals.
 * This route permanently redirects there. Single hop, no loop, no chain.
 */

export default function GovernanceApprovalsLegacyPage(): never {
  permanentRedirect("/approvals");
}
