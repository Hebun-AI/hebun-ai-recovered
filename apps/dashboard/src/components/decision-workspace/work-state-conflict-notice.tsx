"use client";

import { useEffect, useState } from "react";
import { readWorkStateConflictAction } from "@/app/(dashboard)/approvals/actions";
import type { WorkStateConflictRead } from "@/features/action-authorization/read-work-state-conflict.server";

/**
 * WORK-UPDATE V1 (U6) — a minimal stale-state warning on a declared-state change, read once when the
 * card is shown. It is a read of the item's state NOW against the state the proposal froze. It blocks
 * nothing: the Work Authority refuses a stale change under its row lock whether or not this is read.
 * Silent when the item still holds the proposed-from state.
 */
export function WorkStateConflictNotice({ requestId }: { readonly requestId: string }) {
  const [read, setRead] = useState<WorkStateConflictRead | null>(null);
  useEffect(() => {
    let live = true;
    readWorkStateConflictAction({ requestId }).then(
      (result) => live && setRead(result),
      () => live && setRead({ status: "unavailable" }),
    );
    return () => {
      live = false;
    };
  }, [requestId]);

  if (read === null || read.status === "current") return null;
  const text =
    read.status === "changed"
      ? `This work item's declared state changed after this was proposed (proposed from ${read.fromState}, now ${read.currentState}). Executing it will be refused and nothing will change.`
      : read.status === "gone"
        ? "This work item is retired or no longer resolves. Executing it will be refused and nothing will change."
        : "The work item's current state could not be read. Execution still re-checks it and refuses a stale change.";
  return <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-fg-primary">{text}</p>;
}
