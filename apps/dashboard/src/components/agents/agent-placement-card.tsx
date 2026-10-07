"use client";

/*
 * AP-2 — where each durable agent sits in this organization.
 *
 * HOLDS NO AUTHORITY AND PERFORMS NO READ. It renders what the page read on the server through the
 * Organization Authority and calls two server actions. It imports TYPES only from the authority.
 *
 * Every control sends the placement it was shown as `expectedDepartmentId`, so a change made by
 * somebody else since this page rendered is refused rather than overwritten. A retired agent gets no
 * control: its recorded department is historical attribution, not a current placement.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StateBlock } from "@/components/ui/state-block";
import {
  setAgentPlacementAction,
  withdrawAgentPlacementAction,
} from "@/app/(dashboard)/agents/actions";
import type {
  AgentPlacementRefusal,
  AgentPlacementRegister,
  AgentPlacementView,
  AgentPlacementWriteResult,
} from "@/features/organization-authority/agent-placement-contracts";
import type { OrganizationStructure } from "@/features/organization-authority/contracts";

const REFUSAL_SENTENCE: Record<AgentPlacementRefusal, string> = {
  "no-authorized-tenant-context":
    "No organization is resolved for this session, so nothing was recorded.",
  "not-authorized":
    "Placing an agent requires this organization's Governance authority. Nothing was recorded.",
  "authority-unavailable":
    "Hebun could not reach the placement authority. Nothing was recorded — this is not a refusal of the act itself.",
  "agent-unresolved": "No agent of this organization carries that identity.",
  "agent-retired":
    "That agent is retired. Its recorded department is historical and can no longer change.",
  "department-unresolved": "No department of this organization carries that identity.",
  "department-retired":
    "That department is retired from service, so no agent can be placed in it.",
  "already-placed": "The agent is already placed in that department. Nothing changed.",
  "not-placed": "That agent is not placed in any department. Nothing changed.",
  "placement-changed":
    "Somebody changed this agent's placement since this page was shown. Nothing was recorded — reload to see the current placement.",
};

function stateSentence(view: AgentPlacementView | undefined): string {
  if (!view || view.state === "unplaced") return "Not placed in any department.";
  const name = view.department?.name ?? "";
  switch (view.state) {
    case "placed":
      return `Placed in ${name}.`;
    case "placed-in-retired-department":
      return `Placed in ${name}, which has since been retired from service.`;
    case "historical":
      return `Was placed in ${name} when it was retired. Historical record, not a current placement.`;
  }
}

export interface AgentPlacementCardProps {
  readonly register: AgentPlacementRegister;
  /** `null` when the organization itself could not be read. */
  readonly structure: OrganizationStructure | null;
  /** The durable identities the page already read, for their names and order. */
  readonly identities: readonly { readonly agentId: string; readonly name: string }[];
}

export function AgentPlacementCard({ register, structure, identities }: AgentPlacementCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<AgentPlacementWriteResult | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});

  const run = (action: () => Promise<AgentPlacementWriteResult>) => {
    startTransition(async () => {
      const result = await action();
      setOutcome(result);
      if (result.status !== "refused") {
        setChoice({});
        router.refresh();
      }
    });
  };

  const inServiceDepartments =
    structure?.status === "available"
      ? structure.departments.filter((department) => department.inService)
      : [];

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Department placement</CardTitle>
          <CardDescription>
            Which department this organization has placed each agent in, recorded by its Governance
            authority. A placement is organizational structure only: it grants no mandate, no
            capability, no permission and no execution authority, and nothing in Hebun reads it to
            decide what an agent may do.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {register.status !== "available" ? (
          <StateBlock
            tone="unavailable"
            title="Placements unavailable"
            description="Hebun could not read agent placements. This says nothing about where any agent is placed."
          />
        ) : identities.length === 0 ? (
          <p className="text-xs leading-5 text-fg-secondary">
            This organization has no durable agent identity to place.
          </p>
        ) : (
          <ul className="space-y-2">
            {identities.map((identity) => {
              const view = register.placements.find((entry) => entry.agentId === identity.agentId);
              const current = view?.department?.departmentId ?? null;
              const targets = inServiceDepartments.filter((d) => d.departmentId !== current);
              const selected = choice[identity.agentId] ?? "";
              return (
                <li key={identity.agentId} className="rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-medium text-fg">{identity.name}</span>
                    <span className="font-mono text-xs text-fg-muted">{identity.agentId}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-fg-secondary">{stateSentence(view)}</p>
                  {view && view.agentInService ? (
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      {targets.length > 0 ? (
                        <>
                          <label className="flex-1 basis-48 text-xs text-fg-secondary">
                            Department
                            <select
                              value={selected}
                              onChange={(event) =>
                                setChoice((prior) => ({ ...prior, [identity.agentId]: event.target.value }))
                              }
                              className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
                            >
                              <option value="">Choose a department</option>
                              {targets.map((department) => (
                                <option key={department.departmentId} value={department.departmentId}>
                                  {department.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={pending || selected === ""}
                            onClick={() =>
                              run(() =>
                                setAgentPlacementAction({
                                  agentId: identity.agentId,
                                  departmentId: selected,
                                  expectedDepartmentId: current,
                                }),
                              )
                            }
                          >
                            {current === null ? "Place" : "Move"}
                          </Button>
                        </>
                      ) : current === null ? (
                        <p className="text-xs leading-5 text-fg-secondary">
                          {structure?.status === "available"
                            ? "This organization has no department in service to place an agent in."
                            : "Departments could not be read, so none can be offered."}
                        </p>
                      ) : null}
                      {current !== null ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              withdrawAgentPlacementAction({
                                agentId: identity.agentId,
                                expectedDepartmentId: current,
                              }),
                            )
                          }
                        >
                          Withdraw placement
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {outcome ? (
          outcome.status === "refused" ? (
            <StateBlock tone="unavailable" title="Not recorded" description={REFUSAL_SENTENCE[outcome.reason]} />
          ) : (
            <p className="text-xs leading-5 text-fg-secondary">
              {outcome.status === "withdrawn"
                ? "Withdrawn. This agent is no longer placed in any department."
                : "Recorded. This agent is now placed in that department."}
            </p>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
