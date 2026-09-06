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
import type {
  HebyActionKind,
  HebyActionTool,
  HebyReversibility,
  ToolSideEffectClass,
} from "./contracts";

/** The reserved device tool id, shared with the Phase 16 registry so the boundary is one thing. */
export const DEVICE_ACTION_TOOL_ID = "heby.device.action";

/**
 * GIA-1's tool id, exported so the executor, the inlet and the firewall all name ONE string.
 *
 * A repeated literal is how a rename becomes a silent divergence between what a registry declares
 * and what an executor will accept.
 */
export const RECORD_WORK_TOOL_ID = "heby.work.record-work";

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
    /*
     * R3B — THE ONE CONNECTED MUTATION SUBSTRATE, and the only one the validator permits.
     *
     * True since `action-execution` exists: a durable execution-attempt authority, one bounded
     * HTTPS adapter, an idempotency key derived from the permit, and a receipt. Every other
     * mutation and device tool still declares `false`, and {@link validateActionRegistry} now
     * refuses any second one by name rather than by count.
     *
     * CONNECTED IS NOT ARMED. The durable `external-send` kill switch ships disabled and no
     * provider credential is configured, so execution refuses at the switch. This flag says a
     * substrate EXISTS — not that a send can happen today, and not that one ever has.
     */
    substrateConnected: true,
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
    /*
     * GIA-1 — THE SECOND CONNECTED MUTATION SUBSTRATE, AND THE ONLY INTERNAL ONE.
     *
     * `heby.work.record-work` records ONE organizational work item through the Organizational Work
     * Authority, inside the transaction that spends a human's permit. Its substrate is not a
     * provider and not a transport: it is `recordWorkWithin`, the authority that owns `work_items`.
     *
     * ITS POSTURE IS NOT THE SEND'S POSTURE, and the validator checks the difference rather than
     * granting an exception by name. A send is irreversible because nobody can un-receive an email.
     * This is `deterministic-inverse` because `retireWork` exists, is owned by the same authority,
     * and withdraws exactly this state. Calling it irreversible would be as false as calling the
     * send reversible.
     *
     * REVERSIBLE IS NOT UNDOABLE. Retirement leaves the creation, its audit event and the
     * Governance record exactly where they are. Nothing in this repository rolls a committed
     * transaction backwards, and GIA-1 builds no automatic rollback.
     */
    toolId: RECORD_WORK_TOOL_ID,
    actionKind: "record-work",
    capability: "organizational-work-record",
    sideEffect: "CONSEQUENTIAL_MUTATION",
    reversibility: "deterministic-inverse",
    /*
     * Command owns the Director's organization-wide routes, and `/director/work` is one of them.
     * No eighth workspace is invented for one tool.
     */
    ownerWorkspace: "command",
    authorityRequirement: "human-review-required",
    governanceGated: true,
    substrateConnected: true,
    /*
     * TWO ARGUMENTS, AND THE DEPARTMENT IS REQUIRED HERE.
     *
     * `recordWork` lets a human file work against no department, because an organization may
     * legitimately record work before deciding which part of itself carries it. The GOVERNED path
     * is stricter on purpose: a consequential mutation a human approves must name something that
     * exists, and the `record-ref` gate is what makes the department a retrieved row rather than a
     * string. A proposal that named nothing real would put a decision about a fiction in front of
     * the Director — the exact failure R3W moved the evidence check above human review to prevent.
     *
     * The accountable human is deliberately ABSENT. Naming somebody accountable is a separate
     * released act with its own writer (`setWorkAccountableHuman`), and folding it in here would
     * widen one approved payload into two organizational facts.
     */
    argumentSchema: {
      fields: [
        {
          name: "title",
          kind: "string",
          required: true,
          describes: "What the work is, in the organization's own words.",
        },
        /*
         * ── THE DISCRIMINATOR, REQUIRED (TRH-16) ────────────────────────────
         *
         * The department used to be a REQUIRED record-ref, which forced every proposal to name a
         * department — including proposals from organizations that have none. That made the
         * governed path stricter than the truth: `recordWorkWithin` has always accepted
         * `departmentId = null`, and a one-person organization legitimately holds work at
         * organization level.
         *
         * The strictness was right; its shape was wrong. What the governed path must prevent is
         * FICTION — a fabricated, foreign-tenant or retired reference put in front of the Director
         * — not ABSENCE. So the caller now DECLARES which organizational truth it is asserting,
         * and declaring neither is refused. Silence means nothing here, which is the point.
         */
        {
          name: "departmentScope",
          kind: "enum",
          required: true,
          enumValues: ["department", "organization-level"],
          describes: "Whether this work belongs to a department or to the organization itself.",
        },
        {
          /*
           * OPTIONAL, AND THE GENERIC GATE ALREADY MEANS THE RIGHT THING: "an optional record-ref
           * that is simply absent is fine; one that is SUPPLIED must resolve." Optionality here
           * therefore weakens no reference validation — a supplied reference is checked exactly as
           * before. The cross-field rule (present iff scope is `department`) is enforced by the
           * resolver, which is the only place that knows both fields.
           */
          name: "departmentRef",
          kind: "record-ref",
          required: false,
          describes: "An in-service department: department/<uuid>. Required when scope is `department`.",
        },
      ],
    },
    inputSummary:
      "A title, and either one in-service department of this organization or an explicit declaration that the work is organization-level.",
    outputSummary:
      "Would record one organizational work item, authored by the system under a human's authorization. Reversible through retirement; nothing is erased.",
    describes:
      "Records one organizational work item through the Organizational Work Authority. Consequential and governed; a human authorizes it and Hebun performs it.",
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
 * WHAT PERFORMS AN EXECUTABLE ACTION — a fact about the substrate, not a category to fill.
 *
 * Two values, because two things exist: a bounded HTTPS adapter reaching a provider, and an
 * in-repository authority mutating its own table inside the caller's transaction. There is no third
 * value and no "other".
 */
export type ExecutionSubstrateClass = "external-provider" | "internal-authority";

/**
 * THE CLOSED, EXACT EXECUTABLE SET AND ITS PER-KIND POSTURE (GIA-1).
 *
 * ── WHAT THIS REPLACED, AND WHY THE REPLACEMENT IS STRONGER ──────────────────
 *
 * R3B shipped a NAME allowlist plus a CARDINALITY guard: "at most one tool may declare a connected
 * mutation substrate". That pair was exactly right while one executor existed and becomes useless
 * the moment a second is authorized — a cardinality of two admits ANY second tool that satisfies a
 * generic shape, which is the property this repository must not have.
 *
 * So the invariant is not relaxed to two. It is replaced by an EXACT SET: the tools declaring a
 * connected mutation substrate must be precisely the kinds named here — no more, and NO FEWER. A
 * third executable action cannot appear by satisfying a shape; it can only appear by a human
 * editing this table and discharging the obligations the entry declares.
 *
 * ── EACH KIND CARRIES ITS OWN POSTURE, AND THE POSTURES DIFFER ───────────────
 *
 * The exception is granted to a POSTURE, never to a name. `send-external-communication` is
 * irreversible and reaches a provider; `record-work` has a deterministic inverse and reaches an
 * internal authority. Both are consequential, both require human review, both are governance-gated.
 * The validator compares the declared tool against its posture field by field, so loosening either
 * tool — making the send reversible, making the record irreversible, dropping a governance gate —
 * is a violation rather than a quiet edit.
 *
 * ADDING AN ENTRY HERE AUTHORIZES NOTHING BY ITSELF. A registry entry is not a permit, a mandate,
 * a decision or an execution; every one of those still has to happen, in that order, per act.
 */
export interface ExecutableActionPosture {
  readonly actionKind: HebyActionKind;
  readonly toolId: string;
  /** Both authorized kinds are consequential. A cheaper class is not an executable posture. */
  readonly sideEffect: ToolSideEffectClass;
  /** The TRUTH about undoing it, per kind. Never copied from the sibling entry. */
  readonly reversibility: HebyReversibility;
  readonly execution: ExecutionSubstrateClass;
}

export const EXECUTABLE_ACTION_POSTURES: readonly ExecutableActionPosture[] = Object.freeze([
  Object.freeze({
    actionKind: "send-external-communication" as const,
    toolId: "heby.operations.send-communication",
    sideEffect: "CONSEQUENTIAL_MUTATION" as const,
    reversibility: "irreversible" as const,
    execution: "external-provider" as const,
  }),
  Object.freeze({
    actionKind: "record-work" as const,
    toolId: RECORD_WORK_TOOL_ID,
    sideEffect: "CONSEQUENTIAL_MUTATION" as const,
    reversibility: "deterministic-inverse" as const,
    execution: "internal-authority" as const,
  }),
]);

/** The executable kinds, derived from the postures so the two can never disagree. */
export const EXECUTABLE_ACTION_KINDS: readonly HebyActionKind[] = Object.freeze(
  EXECUTABLE_ACTION_POSTURES.map((posture) => posture.actionKind),
);

/** The posture for a kind, or `undefined` — which is what "not executable" looks like here. */
export function executablePostureFor(
  actionKind: HebyActionKind,
): ExecutableActionPosture | undefined {
  return EXECUTABLE_ACTION_POSTURES.find((posture) => posture.actionKind === actionKind);
}

/**
 * Validate the registry's OWN honesty invariants — a structural guard against a dishonest
 * declaration. Enforced:
 *  - reversibility matches the side-effect class (no "reversible" consequential mutation, and no
 *    mutation dressed as READ_ONLY);
 *  - a mutation tool declares a connected substrate ONLY if its action kind is in the CLOSED
 *    executable set, and only while it matches that kind's OWN declared posture — side-effect
 *    class, reversibility, human review and governance gate — so the exception cannot be borrowed
 *    by relaxing the tool it was granted to, nor by copying a sibling kind's posture;
 *  - a DEVICE_ACTION may never declare one, under any circumstances;
 *  - the set of tools declaring a connected mutation substrate is EXACTLY the executable set — no
 *    third executor, and no executable kind quietly losing its substrate;
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
    /*
     * CONSEQUENTIAL DID NOT MEAN IRREVERSIBLE — it meant "not cheap", and every consequential tool
     * happened to be irreversible until GIA-1. `record-work` is consequential AND has a real
     * deterministic inverse (`retireWork`), so the blanket rule was NARROWED rather than deleted:
     * the only consequential tools that may state anything other than `irreversible` are the ones
     * whose executable posture DECLARES that reversibility, and they must state exactly it.
     *
     * A device action keeps the blanket rule with no exception at all.
     */
    if (tool.sideEffect === "DEVICE_ACTION" && tool.reversibility !== "irreversible") {
      issues.push({ toolId: tool.toolId, issue: "consequential/device must be classified irreversible" });
    }
    if (tool.sideEffect === "CONSEQUENTIAL_MUTATION" && tool.reversibility !== "irreversible") {
      const declared = executablePostureFor(tool.actionKind);
      if (!declared || declared.reversibility !== tool.reversibility) {
        issues.push({ toolId: tool.toolId, issue: "consequential/device must be classified irreversible" });
      }
    }
    // Substrate honesty — narrowed at R3B, never widened. See SUBSTRATE_CONNECTED_ACTION_KINDS.
    const isMutationOrDevice =
      tool.sideEffect === "REVERSIBLE_MUTATION" ||
      tool.sideEffect === "CONSEQUENTIAL_MUTATION" ||
      tool.sideEffect === "DEVICE_ACTION";
    if (isMutationOrDevice && tool.substrateConnected) {
      // A device action is never exempt, whatever any allowlist says. Computer Use stays absent.
      if (tool.sideEffect === "DEVICE_ACTION") {
        issues.push({ toolId: tool.toolId, issue: "device tool must not declare a connected substrate" });
      } else {
        const posture = executablePostureFor(tool.actionKind);
        if (!posture) {
          issues.push({ toolId: tool.toolId, issue: "mutation tool must not declare a connected substrate" });
        } else {
          /*
           * The exception is granted to a tool in ITS OWN posture, not to a name and not to a
           * shape a sibling kind established. Loosening any of these would let an executor be
           * reached with less friction — or described less truthfully — than the human who
           * authorized building it agreed to.
           */
          if (tool.toolId !== posture.toolId) {
            issues.push({ toolId: tool.toolId, issue: "executable action kind is backed by a different tool than its posture names" });
          }
          if (tool.sideEffect !== posture.sideEffect) {
            issues.push({ toolId: tool.toolId, issue: "connected mutation substrate must keep its declared side-effect class" });
          }
          if (tool.reversibility !== posture.reversibility) {
            issues.push({ toolId: tool.toolId, issue: "connected mutation substrate must state its declared reversibility" });
          }
          if (tool.authorityRequirement !== "human-review-required" || !tool.governanceGated) {
            issues.push({ toolId: tool.toolId, issue: "connected mutation substrate requires human review and a governance gate" });
          }
        }
      }
    }
    // Authority requirement ↔ class.
    if (isMutationOrDevice && tool.authorityRequirement === "advisory-only") {
      issues.push({ toolId: tool.toolId, issue: "mutation/device must not be advisory-only" });
    }
    if (tool.sideEffect === "READ_ONLY" && tool.authorityRequirement !== "advisory-only") {
      issues.push({ toolId: tool.toolId, issue: "read-only must be advisory-only" });
    }
  }

  /*
   * THE EXACT-SET GUARD (GIA-1), which replaced a cardinality guard.
   *
   * A count of "at most two" would admit any second tool that satisfied a generic shape. This
   * compares the two sets in BOTH directions:
   *
   *   a connected mutation tool whose kind is not in the executable set  → a third executor
   *   an executable kind with no connected mutation tool                 → a claim with no substrate
   *
   * The second direction is not pedantry. `EXECUTABLE_ACTION_POSTURES` is read by the decision and
   * execution surfaces; an entry no tool backs would let this repository state that an act is
   * executable when nothing can perform it.
   */
  const connectedMutationKinds = ACTION_TOOLS.filter(
    (tool) => tool.sideEffect !== "READ_ONLY" && tool.sideEffect !== "PREPARATION_ONLY" && tool.substrateConnected,
  ).map((tool) => tool.actionKind);

  for (const kind of connectedMutationKinds) {
    if (!EXECUTABLE_ACTION_KINDS.includes(kind)) {
      issues.push({
        toolId: kind,
        issue: "the executable set is closed: this kind declares a connected mutation substrate and is not in it",
      });
    }
  }
  for (const posture of EXECUTABLE_ACTION_POSTURES) {
    if (!connectedMutationKinds.includes(posture.actionKind)) {
      issues.push({
        toolId: posture.toolId,
        issue: "an executable action kind declares no connected mutation substrate",
      });
    }
  }
  return issues;
}
