"use client";

/*
 * Workspace switch card — the control an ALREADY-AUTHORIZED human uses to change workspace.
 *
 * IT IS NOT THE SIGN-IN PICKER. That one lives under `/login` and exists for the moment between a
 * proven credential and a tenant-bound session. This one exists inside a working session, and it
 * says so: the workspace the session is currently in is shown and marked as current rather than
 * hidden, because "where am I" is the first question such a control has to answer.
 *
 * IT IS NOT A WORKSPACE MANAGER. Never Create, Join, Invite, Manage, Leave or Settings — each of
 * those describes something this card does not do and no authority behind it could perform.
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
import { switchWorkspaceAction } from "@/app/login/actions";
import {
  SWITCH_LIFETIME,
  TENANT_SWITCH_EFFECT,
  TENANT_SWITCH_NON_EFFECTS,
  type WorkspaceSwitchRefusal,
} from "@/features/tenant-switching/contracts";

const REFUSAL_TEXT: Record<WorkspaceSwitchRefusal, string> = {
  "no-active-session":
    "Your sign-in is no longer valid here. Sign in again to change workspace.",
  "membership-unavailable":
    "That workspace is no longer available to you. Reload to see the current list.",
  "already-active": "You are already in that workspace.",
  "switch-superseded":
    "Something else changed this session while you were choosing. Nothing was changed here — reload and try again.",
  unavailable: "Changing workspace is unavailable right now. Nothing was changed.",
};

export interface SwitchableWorkspace {
  readonly membershipId: string;
  readonly tenantName: string;
  readonly roleName: string | null;
}

export function WorkspaceSwitchCard({
  workspaces,
  currentMembershipId,
}: {
  readonly workspaces: readonly SwitchableWorkspace[];
  readonly currentMembershipId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(currentMembershipId);
  const [refusal, setRefusal] = useState<WorkspaceSwitchRefusal | null>(null);

  const legendId = useId();
  const errorId = useId();
  const statusId = useId();

  function submit() {
    setRefusal(null);
    startTransition(async () => {
      const result = await switchWorkspaceAction({ membershipId: selected });
      if (result.status === "switched") {
        router.refresh();
        return;
      }
      setRefusal(result.reason);
    });
  }

  /*
   * ONE workspace means there is nothing to change to. Said plainly rather than rendering a control
   * that can only refuse itself.
   */
  if (workspaces.length < 2) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Building2 aria-hidden className="size-4" />
          Workspace
        </h2>
        <p className="text-sm text-fg-muted">
          You belong to one workspace, so there is nothing to change to.
        </p>
      </div>
    );
  }

  const atCurrent = selected === currentMembershipId;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-sm font-medium" id={legendId}>
          <Building2 aria-hidden className="size-4" />
          Change workspace
        </h2>
        <p className="text-sm text-fg-muted">
          You belong to more than one workspace. Changing {TENANT_SWITCH_EFFECT}.
        </p>
      </div>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={refusal ? errorId : undefined}
      >
        <legend className="sr-only">Workspaces you belong to</legend>
        {workspaces.map((workspace) => {
          const isCurrent = workspace.membershipId === currentMembershipId;
          return (
            <label
              key={workspace.membershipId}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm"
            >
              <input
                type="radio"
                name="switch-workspace"
                className="mt-1"
                value={workspace.membershipId}
                checked={selected === workspace.membershipId}
                onChange={() => setSelected(workspace.membershipId)}
                disabled={pending}
              />
              <span className="flex flex-col">
                <span className="font-medium">
                  {workspace.tenantName}
                  {isCurrent ? (
                    <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-xs font-normal text-fg-muted">
                      Current workspace
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-fg-muted">
                  {workspace.roleName ? `Your role: ${workspace.roleName}` : "Role unavailable"}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={submit} disabled={pending || atCurrent}>
          {pending ? "Changing…" : "Change workspace"}
        </Button>
        {pending ? (
          <span className="text-sm text-fg-muted" id={statusId} role="status">
            Moving this session to the workspace you chose.
          </span>
        ) : null}
        {!pending && atCurrent ? (
          <span className="text-sm text-fg-muted" id={statusId} role="status">
            This is the workspace you are in.
          </span>
        ) : null}
      </div>

      {refusal ? (
        <p className="text-sm text-fg-danger" id={errorId} role="alert">
          {REFUSAL_TEXT[refusal]}
        </p>
      ) : null}

      <div className="rounded-md border border-border bg-surface-subtle p-3 text-xs text-fg-muted">
        <p className="mb-1">Your sign-in clock is untouched: {SWITCH_LIFETIME.absoluteExpiresAt}.</p>
        <ul className="list-disc space-y-1 pl-4">
          {TENANT_SWITCH_NON_EFFECTS.map((entry) => (
            <li key={entry}>Changing workspace {entry}.</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
