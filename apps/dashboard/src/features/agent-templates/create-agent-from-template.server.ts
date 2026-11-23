/*
 * P5-3 — create an agent from a template, through the three released setup acts and nothing else.
 *
 *   1. register the durable identity        Agent Identity (`createDurableAgentIdentity`)
 *   2. establish its mandate (purpose=role)  Agent Mandate (`establishAgentMandateWithResponsibility`)
 *   3. place it in a department, if chosen   Organization Authority (`setAgentPlacement`)
 *
 * THIS MODULE OWNS NOTHING. Each step is its own Governance decision, taken by the released writer with
 * its own authority check, validation, compare-and-swap and audit. A person without Governance authority
 * is refused by step 1 and nothing is written. There is no transaction across the steps (Director
 * decision 2026-11-23): a step that is refused stops the run, the steps already done stay, and the
 * result names the step and the writer's own reason, so the person finishes it on the released card.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { createDurableAgentIdentity, type AgentIdentityDeps } from "@/features/agent-identity/create-durable-agent-identity.server";
import {
  establishAgentMandateWithResponsibility,
  type EstablishAgentMandateDeps,
} from "@/features/agent-mandate/establish-agent-mandate.server";
import { setAgentPlacement, type AgentPlacementWriteDeps } from "@/features/organization-authority/write-agent-placement.server";
import { AGENT_TEMPLATE_RESPONSIBILITY, agentTemplateById, type AgentTemplateId } from "./templates";

export type AgentTemplateStep = "identity" | "mandate" | "placement";

export type CreateAgentFromTemplateResult =
  | { readonly status: "created"; readonly agentId: string; readonly name: string; readonly templateId: AgentTemplateId; readonly placed: boolean }
  | {
      readonly status: "partial";
      readonly agentId: string;
      readonly name: string;
      readonly templateId: AgentTemplateId;
      readonly completed: readonly AgentTemplateStep[];
      readonly failedStep: Exclude<AgentTemplateStep, "identity">;
      readonly reason: string;
    }
  | { readonly status: "refused"; readonly reason: string };

export type CreateAgentFromTemplateDeps = AgentIdentityDeps & EstablishAgentMandateDeps & AgentPlacementWriteDeps;

export async function createAgentFromTemplate(
  tenant: TenantContext | null,
  input: { readonly templateId: unknown; readonly name: unknown; readonly justification: unknown; readonly departmentId?: unknown },
  deps: CreateAgentFromTemplateDeps = {},
): Promise<CreateAgentFromTemplateResult> {
  if (typeof window !== "undefined") throw new Error("Agent templates are server-only.");
  const template = agentTemplateById(input?.templateId);
  if (!template) return { status: "refused", reason: "template-unknown" };
  const justification = String(input?.justification ?? "");
  const departmentId = typeof input?.departmentId === "string" && input.departmentId.length > 0 ? input.departmentId : null;

  /* 1 · identity — the Governance gate for the whole run. */
  const identity = await createDurableAgentIdentity(tenant, { name: input?.name, justification }, deps);
  if (identity.status !== "established") return { status: "refused", reason: identity.reason };
  const { agentId, name } = identity.identity;

  /* 2 · mandate — the template's purpose (the role brief), narrowest scope, organization responsibility. */
  const mandate = await establishAgentMandateWithResponsibility(
    tenant,
    {
      agentId,
      purpose: template.purpose,
      proposalScope: template.proposalScope,
      justification,
      observedMandateRevision: null,
      responsibility: AGENT_TEMPLATE_RESPONSIBILITY,
    },
    deps,
  );
  if (mandate.status !== "established") {
    return { status: "partial", agentId, name, templateId: template.id, completed: ["identity"], failedStep: "mandate", reason: mandate.reason };
  }

  /* 3 · placement — only when the person chose a department. */
  if (!departmentId) return { status: "created", agentId, name, templateId: template.id, placed: false };
  const placement = await setAgentPlacement(tenant, { agentId, departmentId, expectedDepartmentId: null }, deps);
  if (placement.status === "refused") {
    return { status: "partial", agentId, name, templateId: template.id, completed: ["identity", "mandate"], failedStep: "placement", reason: placement.reason };
  }
  return { status: "created", agentId, name, templateId: template.id, placed: true };
}
