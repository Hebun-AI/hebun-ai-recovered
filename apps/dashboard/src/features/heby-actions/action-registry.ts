/*
 * heby-actions/action-registry.ts — the declared, argument-typed ACTION TOOL boundary (Phase 17).
 *
 * An action tool is a DECLARED, gated capability with a typed argument schema, a side-effect
 * class, a reversibility classification, an owning workspace, and an honest `substrateConnected`
 * flag — never an arbitrary repo function, never a generic shell, never a filesystem/browser
 * escape hatch. Phase 17 registers tools across every side-effect class SO THE LIFECYCLE IS
 * COMPLETE AND HONEST, not so the heavier ones run:
 *
 *   READ_ONLY            → a real substrate is connected; invokable (delegates to Phase 16).
 *   PREPARATION_ONLY     → produces a prepared package; there is nothing to execute.
 *   REVERSIBLE_MUTATION  → declared with a deterministic inverse, but NO substrate is connected.
 *   CONSEQUENTIAL_MUTATION → default human-review-required; NO substrate; never auto-runs.
 *   DEVICE_ACTION        → Platform-owned, Director-authorized, absent here; restricted.
 *
 * Every declaration is fixed, structural vocabulary — NOT fabricated runtime data. `substrateConnected`
 * is honest: it is true ONLY for READ_ONLY inspection/navigation and PREPARATION_ONLY, and false
 * for every mutation and device class, because discovery proved no real mutation/device/execution
 * substrate exists in this repository. The registry's own invariants are validated by
 * {@link validateActionRegistry} so a dishonest declaration cannot slip in.
 */

import {
  NAVIGATE_TOOL_ID,
  INSPECT_SYSTEM_STATE_TOOL_ID,
} from "@/features/heby-runtime";
import type { HebyActionKind, HebyActionTool } from "./contracts";

/** The reserved device tool id, shared with the Phase 16 registry so the boundary is one thing. */
export const DEVICE_ACTION_TOOL_ID = "heby.device.action";

const ACTION_TOOLS: readonly HebyActionTool[] = [
  {
    toolId: INSPECT_SYSTEM_STATE_TOOL_ID,
    actionKind: "inspect-system-state",
    capability: "expose-runtime",
    sideEffect: "READ_ONLY",
    reversibility: "none",
    ownerWorkspace: "operations",
    authorityRequirement: "advisory-only",
    governanceGated: false,
    substrateConnected: true,
    argumentSchema: { fields: [] },
    inputSummary: "The current workspace context (system state is read from the Executive Overview).",
    outputSummary: "Derived, non-authoritative system health/section state with provenance.",
    describes: "Reads the Executive Overview read model. Read-only; fabricates nothing.",
  },
  {
    toolId: NAVIGATE_TOOL_ID,
    actionKind: "resolve-navigation",
    capability: "navigate",
    sideEffect: "READ_ONLY",
    reversibility: "none",
    ownerWorkspace: "command",
    authorityRequirement: "advisory-only",
    governanceGated: false,
    substrateConnected: true,
    argumentSchema: {
      fields: [
        { name: "query", kind: "string", required: true, describes: "A navigation phrase or workspace name." },
      ],
    },
    inputSummary: "A navigation phrase or workspace name.",
    outputSummary: "A real in-app route target (or real candidates); never auto-followed.",
    describes: "Resolves a target to a real product route. Read-only; the human navigates.",
  },
  {
    toolId: "heby.operations.prepare-plan",
    actionKind: "prepare-operational-plan",
    capability: "prepare-information",
    sideEffect: "PREPARATION_ONLY",
    reversibility: "none",
    ownerWorkspace: "operations",
    authorityRequirement: "advisory-only",
    governanceGated: false,
    // Preparation is deterministic and side-effect-free: its deliverable is the prepared package.
    substrateConnected: true,
    argumentSchema: {
      fields: [
        { name: "workflowRef", kind: "record-ref", required: false, describes: "The workflow the plan concerns." },
      ],
    },
    inputSummary: "An optional workflow reference the plan concerns.",
    outputSummary: "A prepared operational plan for a human to review. Nothing is executed.",
    describes: "Prepares an advisory operational plan. Preparation only — there is nothing to run.",
  },
  {
    toolId: "heby.operations.restart-workflow",
    actionKind: "restart-workflow",
    capability: "operational-mutation",
    sideEffect: "REVERSIBLE_MUTATION",
    // Classified reversible ONLY because a workflow restart has a defined deterministic inverse
    // (stop and restore the prior run state). It is still NOT runnable — no substrate is connected.
    reversibility: "deterministic-inverse",
    ownerWorkspace: "operations",
    authorityRequirement: "human-review-required",
    governanceGated: true,
    substrateConnected: false,
    argumentSchema: {
      fields: [
        { name: "workflowRef", kind: "record-ref", required: true, describes: "The workflow to restart." },
      ],
    },
    inputSummary: "The workflow reference to restart.",
    outputSummary: "Would restart the workflow — but no execution substrate is connected.",
    describes: "Restarts a workflow. Reversible (defined inverse), yet non-runnable: no substrate, and human review is required.",
  },
  {
    toolId: "heby.operations.send-communication",
    actionKind: "send-external-communication",
    capability: "external-communication",
    sideEffect: "CONSEQUENTIAL_MUTATION",
    reversibility: "irreversible",
    ownerWorkspace: "operations",
    authorityRequirement: "human-review-required",
    governanceGated: true,
    substrateConnected: false,
    /*
     * R3A.1 — FOUR ARGUMENTS, NOT TWO.
     *
     * The two references alone are not a binding. R3W proved why for the draft half: a bare
     * reference is a moving target unless the exact bytes travel with it, and R3R made the same
     * true of the address. The digests are what make "what was approved == what may be executed"
     * mean anything for a send.
     *
     * THE DIGESTS ARE NOT USER INPUT. A caller supplies the two REFERENCES; the inlet resolves
     * each one against its owning authority and derives the digest from what it actually read. A
     * supplied digest would let a caller approve one thing while naming another, which is exactly
     * the drift this exists to stop — so `heby-action-inlet` computes both and a test pins that a
     * client-supplied value cannot reach them.
     *
     * `kind: "string"` rather than a new digest kind: `record-ref` carries an evidence-backing
     * obligation that a digest cannot satisfy (it names no record), and inventing a kind would
     * make every other tool's validator learn a concept only this tool uses.
     */
    argumentSchema: {
      fields: [
        { name: "recipientRef", kind: "record-ref", required: true, describes: "The recipient record." },
        {
          name: "recipientEndpointDigest",
          kind: "string",
          required: true,
          describes: "SHA-256 of the recipient's exact recorded address, derived server-side.",
        },
        // The body is a REFERENCED, prepared draft — never raw free-form text from a model.
        { name: "draftRef", kind: "record-ref", required: true, describes: "A prepared draft record (not raw text)." },
        {
          name: "draftRevisionDigest",
          kind: "string",
          required: true,
          describes: "SHA-256 of the exact draft revision's bytes, derived server-side.",
        },
      ],
    },
    inputSummary: "A recipient record and a prepared draft record, each bound to its exact bytes.",
    outputSummary: "Would send an external communication — irreversible; always requires human review.",
    describes: "Sends an external communication. Consequential and irreversible; never auto-executed.",
  },
  {
    toolId: "heby.decisions.grant-permission",
    actionKind: "grant-permission",
    capability: "authority-grant",
    sideEffect: "CONSEQUENTIAL_MUTATION",
    reversibility: "irreversible",
    // Only the human-authority surface could ever own an authority grant. No workspace may
    // silently grant permission via Heby — Workforce may prepare assignments, never grant authority.
    ownerWorkspace: "decisions",
    authorityRequirement: "human-review-required",
    governanceGated: true,
    substrateConnected: false,
    argumentSchema: {
      fields: [
        { name: "subjectRef", kind: "record-ref", required: true, describes: "The subject to grant to." },
        { name: "permission", kind: "enum", required: true, enumValues: ["read", "write", "admin"], describes: "The permission level." },
      ],
    },
    inputSummary: "A subject record and a permission level.",
    outputSummary: "Would grant a permission — a human-authority act; never performed by Heby.",
    describes: "Grants a permission. Consequential authority change; only a human may authorize it.",
  },
  {
    toolId: "heby.decisions.modify-policy",
    actionKind: "modify-governance-policy",
    capability: "governance-mutation",
    sideEffect: "CONSEQUENTIAL_MUTATION",
    reversibility: "irreversible",
    // Governance workspace may EXPLAIN policy, never MUTATE it. Policy mutation is owned only by
    // the human-authority surface, and even there Heby prepares — it never edits policy.
    ownerWorkspace: "decisions",
    authorityRequirement: "human-review-required",
    governanceGated: true,
    substrateConnected: false,
    argumentSchema: {
      fields: [
        { name: "policyRef", kind: "record-ref", required: true, describes: "The policy to modify." },
        { name: "change", kind: "enum", required: true, enumValues: ["tighten", "loosen"], describes: "The direction of change." },
      ],
    },
    inputSummary: "A policy record and a change direction.",
    outputSummary: "Would modify governance policy — consequential; never performed by Heby.",
    describes: "Modifies a governance policy. Consequential and irreversible; only a human may authorize it.",
  },
  {
    toolId: DEVICE_ACTION_TOOL_ID,
    actionKind: "device-action",
    capability: "future-device-use",
    sideEffect: "DEVICE_ACTION",
    reversibility: "irreversible",
    ownerWorkspace: "platform",
    authorityRequirement: "future-authorized-preparation",
    governanceGated: true,
    substrateConnected: false,
    argumentSchema: { fields: [] },
    inputSummary: "—",
    outputSummary: "—",
    describes: "Reserved. Device actions require a governed, Platform-owned device runtime and Director authorization; not implemented.",
  },
];

export function listActionTools(): readonly HebyActionTool[] {
  return ACTION_TOOLS;
}

export function getActionTool(toolId: string): HebyActionTool | undefined {
  return ACTION_TOOLS.find((tool) => tool.toolId === toolId);
}

export function getActionToolByKind(actionKind: HebyActionKind): HebyActionTool | undefined {
  return ACTION_TOOLS.find((tool) => tool.actionKind === actionKind);
}

/** Tools whose side-effect class is actually invokable now (READ_ONLY + a connected substrate). */
export function invokableActionTools(): readonly HebyActionTool[] {
  return ACTION_TOOLS.filter((tool) => tool.sideEffect === "READ_ONLY" && tool.substrateConnected);
}

export interface RegistryConsistencyIssue {
  readonly toolId: string;
  readonly issue: string;
}

/**
 * Validate the registry's OWN honesty invariants — a structural guard against a dishonest
 * declaration. Enforced:
 *  - reversibility matches the side-effect class (no "reversible" consequential mutation, and no
 *    mutation dressed as READ_ONLY);
 *  - no mutation or device tool declares its substrate connected (there is none);
 *  - the authority requirement matches the class (mutations/devices are never advisory-only).
 * Returns the list of violations — empty when the registry is internally honest.
 */
export function validateActionRegistry(): readonly RegistryConsistencyIssue[] {
  const issues: RegistryConsistencyIssue[] = [];
  for (const tool of ACTION_TOOLS) {
    // Reversibility ↔ side-effect class.
    if ((tool.sideEffect === "READ_ONLY" || tool.sideEffect === "PREPARATION_ONLY") && tool.reversibility !== "none") {
      issues.push({ toolId: tool.toolId, issue: "read-only/preparation must have reversibility 'none'" });
    }
    if (tool.sideEffect === "REVERSIBLE_MUTATION" && tool.reversibility !== "deterministic-inverse") {
      issues.push({ toolId: tool.toolId, issue: "reversible mutation must have a deterministic inverse" });
    }
    if ((tool.sideEffect === "CONSEQUENTIAL_MUTATION" || tool.sideEffect === "DEVICE_ACTION") && tool.reversibility !== "irreversible") {
      issues.push({ toolId: tool.toolId, issue: "consequential/device must be classified irreversible" });
    }
    // No mutation/device substrate is connected — honesty over fake capability.
    const isMutationOrDevice =
      tool.sideEffect === "REVERSIBLE_MUTATION" ||
      tool.sideEffect === "CONSEQUENTIAL_MUTATION" ||
      tool.sideEffect === "DEVICE_ACTION";
    if (isMutationOrDevice && tool.substrateConnected) {
      issues.push({ toolId: tool.toolId, issue: "mutation/device tool must not declare a connected substrate" });
    }
    // Authority requirement ↔ class.
    if (isMutationOrDevice && tool.authorityRequirement === "advisory-only") {
      issues.push({ toolId: tool.toolId, issue: "mutation/device must not be advisory-only" });
    }
    if (tool.sideEffect === "READ_ONLY" && tool.authorityRequirement !== "advisory-only") {
      issues.push({ toolId: tool.toolId, issue: "read-only must be advisory-only" });
    }
  }
  return issues;
}
