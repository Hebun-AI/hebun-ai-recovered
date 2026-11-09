"use client";

import { useState, useTransition } from "react";
import { updateOwnDisplayNameAction } from "@/app/(dashboard)/account/actions";
import { DISPLAY_NAME_MAX } from "@/features/account-profile/contracts";

const WORDING = {
  unauthenticated: "Your session could not be confirmed. Sign in again.",
  "invalid-display-name": `Use up to ${DISPLAY_NAME_MAX} characters, without control characters.`,
  "stale-version": "Your profile changed in another window. Refresh and try again.",
  "persistence-unavailable": "Hebun could not save this right now. Nothing was changed.",
} as const;

export function DisplayNameForm({ current, version }: { readonly current: string | null; readonly version: number }) {
  const [value, setValue] = useState(current ?? "");
  const [seen, setSeen] = useState(version);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateOwnDisplayNameAction({ displayName: value, expectedVersion: seen });
          if (r.status === "updated") {
            setSeen(r.profileVersion);
            setMessage(r.displayName ? "Saved. This is how you appear to your team." : "Cleared. Your name is shown instead.");
          } else if (r.status === "unchanged") setMessage("Nothing to change.");
          else setMessage(WORDING[r.reason]);
        });
      }}
    >
      <label className="flex min-w-0 flex-col gap-1 text-xs">
        <span className="text-fg-muted">Display name</span>
        <input
          value={value}
          maxLength={DISPLAY_NAME_MAX}
          onChange={(e) => setValue(e.target.value)}
          className="w-72 max-w-full rounded border border-border-subtle bg-transparent px-2 py-1 text-sm"
        />
      </label>
      <button type="submit" disabled={pending} aria-busy={pending} className="rounded border border-border-subtle px-3 py-1 text-xs disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
      {message ? (
        <p role="status" className="basis-full text-xs text-fg-muted">
          {message}
        </p>
      ) : null}
    </form>
  );
}
