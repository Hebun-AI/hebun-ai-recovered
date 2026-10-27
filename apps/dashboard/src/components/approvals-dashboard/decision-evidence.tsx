"use client";

import { useState, useTransition } from "react";
import { readReviewEvidenceAction } from "@/app/(dashboard)/approvals/actions";
import type {
  ReviewAuditLinkage,
  ReviewDecisionEvidence,
  ReviewDigestComparison,
  ReviewEvidenceField,
  RevisionReviewEvidence,
} from "@/features/work-artifact-review/contracts";

/*
 * GOVERNANCE-DECISION-EVIDENCE-READ-1 — the recorded review decisions on one revision, read on
 * request. Nothing here is in the page payload: the justification and the actor id arrive only from
 * the server action, which answers a Governance authority and nobody else. Read-only — it renders
 * stored values and names what was not recorded; it never offers a decision.
 */

const DIGEST_WORDING: Readonly<Record<ReviewDigestComparison, string>> = {
  match: "Matches the revision's stored content digest",
  mismatch: "Does NOT match the revision's stored content digest",
  "not-recorded": "No valid digest was recorded with this decision",
};

const LINKAGE_WORDING: Readonly<Record<ReviewAuditLinkage, string>> = {
  linked: "One audit event is filed under this decision",
  missing: "No audit event is filed under this decision",
  multiple: "More than one audit event is filed under this decision; all are listed",
  "unexpected-action": "Audit events are filed under this decision, but none records the expected action",
};

const UNREAD_WORDING: Readonly<Record<Exclude<RevisionReviewEvidence["status"], "read">, string>> = {
  "not-authorized": "Decision evidence is shown only to a Governance authority of this organization.",
  "not-found": "This revision was not found in this organization.",
  unavailable: "Decision evidence could not be read. This is unknown, not an absence of decisions.",
};

function Field<T>({ label, field, current }: { label: string; field: ReviewEvidenceField<T>; current?: string }) {
  const value = field.status === "recorded" ? String(field.value) : field.status === "absent" ? "Not recorded" : "Recorded in an unreadable form";
  return <div><dt className="text-xs text-fg-muted">{label}</dt><dd className="break-all font-mono text-xs">{value}{current !== undefined && field.status === "recorded" && String(field.value) !== current ? ` · differs from ${current}` : ""}</dd></div>;
}

function Decision({ decision, artifactId, revisionNo }: { decision: ReviewDecisionEvidence; artifactId: string; revisionNo: number }) {
  return <li className="space-y-3 rounded-lg border border-border p-3" data-review-evidence-decision={decision.decisionId}>
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div><dt className="text-xs text-fg-muted">Decision</dt><dd className="break-all font-mono text-xs">{decision.decisionId}</dd></div>
      <div><dt className="text-xs text-fg-muted">Recorded outcome</dt><dd className="text-xs">{decision.decision ?? decision.outcome} · {decision.decisionType}</dd></div>
      <div><dt className="text-xs text-fg-muted">Decided at</dt><dd className="font-mono text-xs">{decision.decidedAt}</dd></div>
      <div><dt className="text-xs text-fg-muted">Decided by</dt><dd className="break-all text-xs">{decision.actorType} <span className="font-mono">{decision.actorId}</span></dd></div>
      <div><dt className="text-xs text-fg-muted">Under authority of</dt><dd className="break-all text-xs">{decision.authoritySourceActorId ? <>{decision.authoritySourceActorType} <span className="font-mono">{decision.authoritySourceActorId}</span></> : "Not recorded"}</dd></div>
    </dl>
    <div><p className="text-xs text-fg-muted">Recorded justification</p><p className="whitespace-pre-wrap break-words rounded-lg bg-surface-sunken p-3 text-sm">{decision.justification}</p></div>
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Field label="Evidence · artifact" field={decision.recordedArtifactId} current={artifactId} />
      <Field label="Evidence · revision number" field={decision.recordedRevisionNo} current={String(revisionNo)} />
      <Field label="Evidence · content digest" field={decision.recordedContentDigest} />
      <div><dt className="text-xs text-fg-muted">Digest comparison</dt><dd className={`text-xs ${decision.digestComparison === "match" ? "" : "text-warning"}`}>{DIGEST_WORDING[decision.digestComparison]}</dd></div>
    </dl>
    {decision.audit.status === "read" ? <div className="space-y-2">
      <p className={`text-xs ${decision.audit.linkage === "linked" ? "text-fg-muted" : "text-warning"}`}>{LINKAGE_WORDING[decision.audit.linkage]} (expected action {decision.audit.expectedAction}).</p>
      {decision.audit.records.length > 0 && <ul className="space-y-1">{decision.audit.records.map((event) => <li key={event.auditId} className="break-all rounded-lg bg-surface-sunken p-2 font-mono text-[0.7rem] leading-5">
        event {event.auditId} · {event.action} · entity {event.entityId} · {event.actorType} {event.actorId} · {event.outcome} · {event.occurredAt}
      </li>)}</ul>}
    </div> : <p className="text-xs text-warning">The audit history for this decision could not be read.</p>}
  </li>;
}

export function DecisionEvidence({ artifactId, revisionNo }: { artifactId: string; revisionNo: number }) {
  const [result, setResult] = useState<RevisionReviewEvidence | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const read = () => startTransition(async () => {
    setFailed(false);
    try {
      setResult(await readReviewEvidenceAction({ artifactId, revisionNo }));
    } catch {
      setResult(null);
      setFailed(true);
    }
  });

  return <section aria-label="Decision evidence" className="space-y-3 rounded-lg border border-border p-3" data-decision-evidence="">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-medium">Decision evidence · revision {revisionNo}</h3>
      <button type="button" disabled={pending} onClick={read} className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-60">{pending ? "Reading…" : result ? "Read again" : "Read decision evidence"}</button>
    </div>
    <p className="text-xs text-fg-muted">Reads the stored decision records, the evidence they bound and the audit events filed under them. Reading changes nothing.</p>
    {failed && <p role="status" className="text-xs text-warning">The request did not complete. Nothing was read.</p>}
    {result && (result.status === "read" ? <>
      <p className="break-all text-xs text-fg-muted">Revision <span className="font-mono">{result.revisionId}</span> · stored digest <span className="font-mono">{result.storedContentDigest}</span></p>
      {result.decisions.length === 0 ? <p className="text-sm">No review decision is recorded on this revision.</p> : <ol className="space-y-3">{result.decisions.map((decision) => <Decision key={decision.decisionId} decision={decision} artifactId={result.artifactId} revisionNo={result.revisionNo} />)}</ol>}
    </> : <p role="status" className="text-sm text-fg-muted">{UNREAD_WORDING[result.status]}</p>)}
  </section>;
}
