"use client";

import { useState, useTransition } from "react";
import { openInstagramApprovalImageAction } from "@/app/(dashboard)/approvals/actions";
import type {
  InstagramApprovalImageResult,
  InstagramApprovalPreviewResult,
} from "@/features/instagram-publishing/approval-preview.server";

/**
 * INSTAGRAM-APPROVAL-PREVIEW-1 — what this Instagram publication request would publish, shown BEFORE
 * the decision controls.
 *
 * TWO SECTIONS THAT MUST NOT BLUR. "Governed request" is the frozen payload, each fact proven against
 * its digest on the server. "Current readiness" is today's Content Package context beside it — it
 * never replaces the requested image or caption, and it decides nothing here.
 *
 * The image is opened on request through a server action that takes the REQUEST id, so which image
 * is shown is decided by the payload, never by this component. It holds no store and no provider.
 */
export function InstagramApprovalPreview({
  requestId,
  preview,
}: {
  readonly requestId: string;
  /** `undefined` when the preview read did not answer for this request — unknown, not empty. */
  readonly preview: Exclude<InstagramApprovalPreviewResult, { status: "not-found" }> | undefined;
}) {
  const [image, setImage] = useState<InstagramApprovalImageResult | null>(null);
  const [opening, startOpening] = useTransition();

  if (!preview || preview.status !== "read") {
    return (
      <div className="rounded-md border border-warning/40 bg-warning/10 px-2.5 py-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-warning">Instagram publication preview</p>
        <p className="mt-0.5 text-xs leading-5 text-fg-secondary">
          {preview?.status === "payload-unreadable"
            ? "The stored request does not parse as an Instagram publication, so nothing was resolved from it."
            : "The preview could not be read right now. That is unknown, not empty — the frozen parameters below are still the request."}
        </p>
      </div>
    );
  }

  const p = preview.preview;
  const caption =
    p.caption.status === "verified"
      ? null
      : p.caption.status === "digest-mismatch"
        ? "Integrity mismatch: the governed revision no longer hashes to the digest this request froze. No caption is shown."
        : "The governed caption revision could not be read. No other copy is shown in its place.";
  const imageNote =
    p.image.status === "bound"
      ? null
      : p.image.status === "digest-mismatch"
        ? "Integrity mismatch: the image record no longer matches the digest this request froze. No image is shown."
        : p.image.status === "not-of-governed-draft"
          ? "The bound image does not belong to the governed draft. No image is shown."
          : "The bound image could not be read. No other image is shown in its place.";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-bg px-2.5 py-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">
        Governed request — what this authorization would publish to Instagram
      </p>

      <div className="min-w-0">
        {imageNote ? (
          <p className="text-xs leading-5 text-warning">{imageNote}</p>
        ) : image?.status === "read" ? (
          <figure className="min-w-0 space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL is not a static asset and must not be optimized, cached or proxied. */}
            <img
              src={image.url}
              alt="The image bound to this Instagram publication request"
              width={image.width}
              height={image.height}
              className="h-auto max-h-80 w-auto max-w-full rounded-lg border border-border-subtle"
            />
            <figcaption className="text-xs text-fg-muted">
              The original this request binds. Private link, expires shortly; verified against the frozen digest before it was shown.
            </figcaption>
          </figure>
        ) : (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="self-start rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg-primary disabled:opacity-60"
              disabled={opening}
              aria-busy={opening}
              onClick={() => startOpening(async () => setImage(await openInstagramApprovalImageAction({ requestId })))}
            >
              {opening ? "Verifying…" : "Show the bound image"}
            </button>
            {image?.status === "refused" ? (
              <p className="text-xs leading-5 text-warning">
                {image.reason === "digest-mismatch" || image.reason === "not-of-governed-draft"
                  ? "Integrity mismatch — the stored image is not the one this request froze. Nothing is shown."
                  : "The bound image could not be opened right now. Nothing else is shown in its place."}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-xs text-fg-muted">Caption (revision {p.governed.revisionNo}, as frozen)</p>
        {caption ? (
          <p className="text-xs leading-5 text-warning">{caption}</p>
        ) : p.caption.status === "verified" ? (
          <>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-fg-primary">{p.caption.text}</p>
            {p.caption.revisionStanding !== "current" ? (
              <p className="text-xs leading-5 text-warning">
                {p.caption.revisionStanding === "superseded"
                  ? "A newer revision of this draft exists. This request still binds the revision shown."
                  : "This draft has since been retired. This request still binds the revision shown."}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-fg-muted">Destination</dt>
          <dd className="text-fg-primary">Instagram</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-fg-muted">Account</dt>
          <dd className="break-all text-fg-primary">
            {p.account.status === "bound-connection"
              ? `${p.account.label ?? "Instagram account"} (${p.governed.externalAccountId})`
              : p.account.status === "account-changed"
                ? `${p.governed.externalAccountId} — the bound connection now answers for a different account`
                : p.account.status === "connection-not-found"
                  ? `${p.governed.externalAccountId} — the bound connection is no longer recorded`
                  : `${p.governed.externalAccountId} — connection could not be read`}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-fg-muted">Revision</dt>
          <dd className="break-all font-mono text-[0.7rem] text-fg-primary">{p.governed.draftRef}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-fg-muted">Publish derivative</dt>
          <dd className="text-fg-primary">
            {p.derivative.status === "lineage-verified"
              ? "JPEG derivative of exactly this original (lineage verified)"
              : p.derivative.status === "lineage-refused"
                ? `Lineage does not verify (${p.derivative.reason})`
                : "Lineage could not be read"}
          </dd>
        </div>
      </dl>

      {p.acknowledgement.status !== "none-in-payload" ? (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5">
          <p className="text-xs font-semibold text-warning">Republish acknowledgement</p>
          <p className="break-all text-xs leading-5 text-fg-secondary">
            This request acknowledges prior attempt {p.acknowledgement.attemptId}
            {p.acknowledgement.status === "recorded"
              ? ` — the ledger records it as ${p.acknowledgement.attemptStatus}${p.acknowledgement.providerResultId ? `, provider id ${p.acknowledgement.providerResultId}` : ""}.`
              : p.acknowledgement.status === "not-found"
                ? " — the ledger holds no such attempt for this revision."
                : " — the ledger could not be read for it."}
          </p>
          <p className="text-[0.65rem] leading-5 text-fg-muted">
            A recorded attempt is what the action ledger holds; it is not a live read of what Instagram shows now.
          </p>
        </div>
      ) : null}

      <div className="border-t border-border pt-1.5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">Current readiness (context)</p>
        <p className="text-xs leading-5 text-fg-secondary">
          {p.readiness.status === "ready"
            ? "READY — the current Content Package still authorizes this image."
            : p.readiness.status === "not-ready"
              ? `BLOCKED — ${p.readiness.failure}${p.readiness.blockers.length > 0 ? ` (${p.readiness.blockers.join(", ")})` : ""}.`
              : "Unknown — the Content Package could not be read now."}
        </p>
        <p className="text-[0.65rem] leading-5 text-fg-muted">
          Today&rsquo;s package, beside the request — not a replacement for it. Execution re-checks readiness before anything reaches Instagram.
        </p>
      </div>
    </div>
  );
}
