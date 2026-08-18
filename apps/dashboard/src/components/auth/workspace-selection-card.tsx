"use client";

/*
 * Workspace selection card — the picker a human sees when a sign-in finds several memberships.
 *
 * IT EXTENDS THE SIGN-IN SURFACE. Not a switcher, not an account menu, not a workspace manager:
 * it exists only for the moment between a proven credential and a tenant-bound session, and it lives
 * under `/login` because that is where that moment is.
 *
 * THE LANGUAGE IS DELIBERATE. "Choose workspace", "Continue". Never Create, Join, Invite, Manage,
 * Leave or Settings — each of those describes something this card does not do.
 *
 * IT RENDERS ONLY WHAT THE SERVER DERIVED. The list arrives as a prop built from the human's own
 * active memberships; the card has no way to add to it, and the id it submits is re-read and
 * re-validated server-side before anything is issued.
 *
 * WHAT THIS DOES NOT DO is rendered from frozen values, so the wording cannot drift from the code.
 *
 * ACCESSIBILITY: a real fieldset/legend, real radio inputs with real labels, refusals in
 * role="alert", the pending transition in role="status", and state carried by words rather than
 * colour.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { selectWorkspaceAction } from "@/app/login/actions";
import {
  PRE_TENANT_RECEIPT,
  TENANT_SELECTION_EFFECT,
  TENANT_SELECTION_NON_EFFECTS,
  type WorkspaceSelectionRefusal,
} from "@/features/tenant-selection/contracts";

const REFUSAL_TEXT: Record<WorkspaceSelectionRefusal, string> = {
  "no-selection-context":
    "This sign-in step expired. Sign in again to choose a workspace.",
  "membership-unavailable":
    "That workspace is no longer available to you. Sign in again to see the current list.",
  unavailable: "Sign-in is unavailable right now. Nothing was changed.",
};

export interface WorkspaceOption {
  readonly membershipId: string;
  readonly tenantName: string;
  readonly roleName: string | null;
}

export function WorkspaceSelectionCard({
  workspaces,
}: {
  readonly workspaces: readonly WorkspaceOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(workspaces[0]?.membershipId ?? "");
  const [refusal, setRefusal] = useState<WorkspaceSelectionRefusal | null>(null);

  const legendId = useId();
  const errorId = useId();
  const statusId = useId();

  function submit() {
    setRefusal(null);
    startTransition(async () => {
      const result = await selectWorkspaceAction({ membershipId: selected });
      if (result.status === "selected") {
        router.replace("/foundation");
        router.refresh();
        return;
      }
      setRefusal(result.reason);
    });
  }

  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
        <h1 className="flex items-center gap-2 text-lg font-medium">
          <Building2 aria-hidden className="size-4" />
          No workspace yet
        </h1>
        <p className="text-sm text-fg-muted" role="status">
          Your sign-in was accepted, but you do not belong to a workspace yet. Someone with
          Governance authority in the organization has to admit you before you can enter one.
        </p>
        <p className="text-xs text-fg-muted">
          This sign-in step grants {PRE_TENANT_RECEIPT.grants}. It ends when {PRE_TENANT_RECEIPT.diesWhen}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-medium" id={legendId}>
          <Building2 aria-hidden className="size-4" />
          Choose workspace
        </h1>
        <p className="text-sm text-fg-muted">
          You belong to more than one workspace. Choosing one {TENANT_SELECTION_EFFECT}.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2" aria-describedby={refusal ? errorId : undefined}>
        <legend className="sr-only">Workspaces you belong to</legend>
        {workspaces.map((workspace) => (
          <label
            key={workspace.membershipId}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm"
          >
            <input
              type="radio"
              name="workspace"
              className="mt-1"
              value={workspace.membershipId}
              checked={selected === workspace.membershipId}
              onChange={() => setSelected(workspace.membershipId)}
              disabled={pending}
            />
            <span className="flex flex-col">
              <span className="font-medium">{workspace.tenantName}</span>
              <span className="text-xs text-fg-muted">
                {workspace.roleName ? `Your role: ${workspace.roleName}` : "Role unavailable"}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={submit} disabled={pending || !selected}>
          {pending ? "Opening…" : "Continue"}
        </Button>
        {pending ? (
          <span className="text-sm text-fg-muted" id={statusId} role="status">
            Opening the workspace you chose.
          </span>
        ) : null}
      </div>

      {refusal ? (
        <p className="text-sm text-fg-danger" id={errorId} role="alert">
          {REFUSAL_TEXT[refusal]}
        </p>
      ) : null}

      <div className="rounded-md border border-border bg-surface-subtle p-3 text-xs text-fg-muted">
        <ul className="list-disc space-y-1 pl-4">
          {TENANT_SELECTION_NON_EFFECTS.map((entry) => (
            <li key={entry}>Choosing a workspace {entry}.</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
