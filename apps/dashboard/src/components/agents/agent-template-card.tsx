"use client";

/*
 * P5-3 — set up an agent from a template. One form, three released Governance acts (identity, mandate
 * with the template's role, optional placement). The card decides nothing: every refusal is the
 * writer's, shown with the step it came from.
 */
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createAgentFromTemplateAction } from "@/app/(dashboard)/agents/actions";
import { AGENT_TEMPLATES, type AgentTemplateId } from "@/features/agent-templates/templates";
import type { CreateAgentFromTemplateResult } from "@/features/agent-templates/create-agent-from-template.server";
import type { OrganizationStructure } from "@/features/organization-authority/contracts";

const FIELD =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const STEP_WORDS = { identity: "registration", mandate: "mandate", placement: "department placement" } as const;

export function AgentTemplateCard({ structure }: { readonly structure: OrganizationStructure | null }) {
  const ids = useId();
  const router = useRouter();
  const [templateId, setTemplateId] = useState<AgentTemplateId>("content");
  const [name, setName] = useState(AGENT_TEMPLATES[0]!.name);
  const [departmentId, setDepartmentId] = useState("");
  const [justification, setJustification] = useState("");
  const [outcome, setOutcome] = useState<CreateAgentFromTemplateResult | null>(null);
  const [pending, startTransition] = useTransition();
  const template = AGENT_TEMPLATES.find((t) => t.id === templateId)!;
  const departments =
    structure?.status === "available" ? structure.departments.filter((department) => department.inService) : [];

  const choose = (id: AgentTemplateId) => {
    setTemplateId(id);
    setName(AGENT_TEMPLATES.find((t) => t.id === id)!.name);
    setOutcome(null);
  };

  const submit = () =>
    startTransition(async () => {
      const result = await createAgentFromTemplateAction({ templateId, name, justification, departmentId: departmentId || null });
      setOutcome(result);
      if (result.status !== "refused") {
        setJustification("");
        router.refresh();
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up an agent from a template</CardTitle>
        <CardDescription>
          Registers the agent, records its mandate with the template&apos;s role, and optionally places it in a department.
          Each is a Governance decision with your reason. The agent only prepares drafts for a person to review.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="mb-1 text-xs font-medium text-fg">Template</legend>
          {AGENT_TEMPLATES.map((t) => (
            <label key={t.id} className="flex cursor-pointer flex-col gap-1 rounded-md border border-border p-3 text-xs has-[:checked]:border-primary">
              <span className="flex items-center gap-2 font-medium text-fg">
                <input type="radio" name={`${ids}-template`} checked={templateId === t.id} onChange={() => choose(t.id)} />
                {t.name}
              </span>
              <span className="text-fg-muted">{t.summary}</span>
            </label>
          ))}
        </fieldset>

        <div className="rounded-md border bg-surface-sunken p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">Role it will be given</p>
          <p className="mt-1 text-xs leading-5 text-fg">{template.purpose}</p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-name`} className="text-xs font-medium text-fg">Name</label>
          <input id={`${ids}-name`} value={name} onChange={(event) => setName(event.target.value)} className={FIELD} />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-department`} className="text-xs font-medium text-fg">Department (optional)</label>
          <select id={`${ids}-department`} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className={FIELD}>
            <option value="">Not placed</option>
            {departments.map((department) => (
              <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-justification`} className="text-xs font-medium text-fg">Why you are setting up this agent</label>
          <textarea id={`${ids}-justification`} rows={2} value={justification} onChange={(event) => setJustification(event.target.value)} className={FIELD} />
        </div>

        <div>
          <Button onClick={submit} disabled={pending || justification.trim().length === 0 || name.trim().length === 0}>
            {pending ? "Setting up…" : `Set up ${template.name}`}
          </Button>
        </div>

        {outcome ? (
          <p className="text-xs leading-5 text-fg" role="status">
            {outcome.status === "created"
              ? `${outcome.name} is registered with its mandate${outcome.placed ? " and placed in the department" : ""}.`
              : outcome.status === "partial"
                ? `${outcome.name} is registered, but its ${STEP_WORDS[outcome.failedStep]} was refused (${outcome.reason}). Finish it on the ${outcome.failedStep === "mandate" ? "mandate" : "placement"} card below.`
                : `Nothing was set up: ${outcome.reason}.`}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
