"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/*
 * reference-chip.tsx — one canonical record reference, shown and copyable (OPS-P1).
 *
 * ── THE REFERENCE IS READ, NEVER BUILT ───────────────────────────────────────
 *
 * The string arrives already formed from the authoritative view — `RecipientView.recordRef` and
 * `WorkArtifactView.currentRef`. This component receives it as an opaque value and renders it. It
 * imports no formatter, holds no uuid, and cannot construct a reference: a client that assembled
 * `work-artifact/<id>@<n>` itself could name a revision the server never resolved, which is exactly
 * the drift the `@<n>` suffix exists to make unrepresentable.
 *
 * IT IS SECOND IN THE VISUAL ORDER, ON PURPOSE. A human recognises a person by name and a draft by
 * title; the reference is the machine's handle for the same thing, needed today only because
 * `/send` takes it as an argument. It is rendered small and monospaced beneath the human fact, not
 * as the identity of the row.
 *
 * A REFERENCE IS NOT AUTHORITY. Holding one grants nothing — every read still resolves inside a
 * server-resolved tenant.
 */
export function ReferenceChip({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(reference).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          },
          () => {
            /* Clipboard refused. The reference stays visible and selectable, so nothing is lost. */
          },
        );
      }}
      className="group inline-flex max-w-full items-center gap-1.5 rounded border border-border-subtle bg-surface-2 px-2 py-1 text-left font-mono text-[0.7rem] text-fg-muted transition-colors hover:border-border hover:text-fg-secondary"
      title="Copy this reference"
    >
      <span className="min-w-0 break-all">{reference}</span>
      {copied ? (
        <Check className="size-3 shrink-0 text-success" aria-hidden />
      ) : (
        <Copy className="size-3 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden />
      )}
      <span className="sr-only">{copied ? "Reference copied" : "Copy reference"}</span>
    </button>
  );
}
