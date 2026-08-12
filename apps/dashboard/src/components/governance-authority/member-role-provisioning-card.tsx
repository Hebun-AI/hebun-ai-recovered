"use client";

/*
 * Member role provisioning card (I1.1) — the Governance ceremony that establishes the tenant's
 * ordinary member role.
 *
 * IT EXTENDS THE GOVERNANCE WORKSPACE. Not a role manager: there is no list, no editor, no delete,
 * no type picker and no name field. One button, once per tenant, and the database enforces the once.
 *
 * THE LANGUAGE IS DELIBERATE. "Provision Member Role". Never Add Role, Create Role, Manage Roles or
 * Save — each of those describes role administration, which this is not.
 *
 * WHEN THE ROLE ALREADY EXISTS the ceremony is not shown at all, per the Director's instruction:
 * a disabled button inviting a refused click is not an honest surface.
 *
 * ACCESSIBILITY: a real <label>, help and error wired through aria-describedby, `aria-invalid` on
 * refusal, refusals in role="alert", success in role="status", state carried by words not colour.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { provisionMemberRoleAction } from "@/app/(dashboard)/governance/authority/actions";
import { JUSTIFICATION_LIMITS } from "@/features/governance-decision/contracts";
import {
  BASELINE_UNIQUENESS,
  ROLE_BASELINE_EFFECT,
  ROLE_BASELINE_NON_EFFECTS,
  type RoleBaselineRefusal,
} from "@/features/tenant-role-baseline/contracts";

const REFUSAL_TEXT: Record<RoleBaselineRefusal, string> = {
  unauthenticated: "Your session ended. Sign in again.",
  "no-governance-authority": "This tenant has no Governance authority yet.",
  "not-the-governance-authority":
    "Only a current Governance authority may establish this role. An organizational role does not grant it.",
  "justification-required": `A reason of at least ${JUSTIFICATION_LIMITS.minimumLength} characters is required.`,
  "already-provisioned": "This organization already has its member role. Nothing was changed.",
  "persistence-unavailable": "The durable store is unavailable. Nothing was changed.",
};

export interface MemberRoleProvisioningCardProps {
  /** Null when the tenant has no member role yet — the only state showing the ceremony. */
  readonly memberRoleId: string | null;
}

export function MemberRoleProvisioningCard({ memberRoleId }: MemberRoleProvisioningCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [justification, setJustification] = useState("");
  const [refusal, setRefusal] = useState<RoleBaselineRefusal | null>(null);
  const [provisioned, setProvisioned] = useState(false);

  const reasonId = useId();
  const errorId = useId();

  function submit() {
    setRefusal(null);
    startTransition(async () => {
      const result = await provisionMemberRoleAction({ justification });
      if (result.status === "provisioned") {
        setProvisioned(true);
        setJustification("");
        router.refresh();
        return;
      }
      setRefusal(result.reason);
    });
  }

  const alreadyExists = memberRoleId !== null || provisioned;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users aria-hidden className="size-4" />
          Provision Member Role
        </CardTitle>
        <CardDescription>
          This establishes the organization&rsquo;s ordinary onboarding role.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="rounded-md border border-border bg-surface-subtle p-3 text-xs text-fg-muted">
          <p className="font-medium text-fg">This {ROLE_BASELINE_EFFECT}.</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {ROLE_BASELINE_NON_EFFECTS.map((entry) => (
              <li key={entry}>It {entry}.</li>
            ))}
          </ul>
        </div>

        {alreadyExists ? (
          <p className="flex items-start gap-2 text-sm text-fg-muted" role="status">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              This organization has its member role. {BASELINE_UNIQUENESS.rule} No account,
              membership, or invitation was created.
            </span>
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor={reasonId}>
                Reason
              </label>
              <textarea
                id={reasonId}
                rows={3}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                aria-describedby={refusal ? errorId : undefined}
                aria-invalid={refusal === "justification-required"}
                disabled={pending}
              />
            </div>
            <div>
              <Button onClick={submit} disabled={pending}>
                {pending ? "Provisioning…" : "Provision Member Role"}
              </Button>
            </div>
          </div>
        )}

        {refusal ? (
          <p className="text-sm text-fg-danger" id={errorId} role="alert">
            {REFUSAL_TEXT[refusal]}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
