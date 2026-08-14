"use client";

/*
 * Pending enrollment card — where the SECOND key is turned.
 *
 * ── IT EXTENDS THE GOVERNANCE WORKSPACE, IT IS NOT A SECOND ONBOARDING SURFACE ─
 *
 * Approving an enrollment is a Governance act by the same authority that authorized the membership
 * and issued the capability, so it belongs beside those controls rather than in a new place where
 * authority is exercised.
 *
 * ── WHAT IT SHOWS, AND WHAT IT CANNOT ────────────────────────────────────────
 *
 * A submission id, the invitation it belongs to, and when it arrived. NOT the prospective human's
 * address: the read seam does not return it, on purpose. The approver is being asked "did you hand a
 * capability to someone at about this time?", which is the only question they can honestly answer —
 * Hebun delivered nothing and verified nobody, and the card says so rather than implying otherwise.
 *
 * ── THE LANGUAGE IS DELIBERATE ───────────────────────────────────────────────
 *
 * "Approve identity enrollment", never "Approve user", "Add member" or "Accept invitation" — each of
 * those describes something this control does not do. Approval creates no account; it permits the
 * bearer to create one.
 *
 * ── VOCABULARY STAYS ON THE SERVER ───────────────────────────────────────────
 *
 * Refusal sentences arrive as a prop the server built from the real refusal union, so this component
 * never names the enrollment authority and a new refusal reason cannot render as a blank line.
 *
 * ACCESSIBILITY: a real fieldset per submission, a real labelled textarea, refusals in role="alert",
 * the pending transition in role="status", and state carried by words rather than colour.
 */

import { useId, useState, useTransition } from "react";
import { UserRoundCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { decideIdentityEnrollmentAction } from "@/app/(dashboard)/governance/authority/actions";

/** One waiting submission, exactly as the read seam returns it. No address, by design. */
export interface PendingEnrollmentOption {
  readonly enrollmentId: string;
  readonly invitationId: string;
  readonly submittedAt: string;
  /**
   * Already approved, and never completed. Approval was only permission for the bearer's final act;
   * if they lost the browser that started the ceremony, that permission can never be spent and this
   * row blocks every fresh submission until it is rejected.
   */
  readonly strandedAfterApproval: boolean;
  readonly approvedAt: string | null;
}

export interface PendingEnrollmentWording {
  readonly refusals: Readonly<Record<string, string>>;
  readonly minimumJustificationLength: number;
  readonly whatApprovalMeans: string;
  readonly whatItDoesNotProve: string;
}

const FALLBACK_REFUSAL = "That could not be completed. Nothing was changed.";

/**
 * What rejecting a stranded ceremony does and does not do, rendered as a list so the approver is not
 * guessing. Every line is a fact the runtime enforces.
 */
const STRANDED_RECOVERY_FACTS: readonly string[] = Object.freeze([
  "No account, credential or membership exists — nothing is undone.",
  "The invitation is NOT revoked and stays valid until it expires.",
  "No new capability is issued, and the old one is not changed.",
  "The person can submit the SAME capability they already hold and start again.",
]);

export function PendingEnrollmentCard({
  pending: submissions,
  wording,
}: {
  readonly pending: readonly PendingEnrollmentOption[];
  readonly wording: PendingEnrollmentWording;
}) {
  const [busy, startTransition] = useTransition();
  const [active, setActive] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);

  const justificationId = useId();
  const errorId = useId();

  function decide(enrollmentId: string, decision: "approve" | "reject") {
    setRefusal(null);
    setActive(enrollmentId);
    startTransition(async () => {
      const result = await decideIdentityEnrollmentAction({
        enrollmentId,
        decision,
        justification,
      });
      /* Checked positively: the success branch carries a compound discriminant and narrows poorly. */
      if (result.status === "refused") {
        setRefusal(wording.refusals[result.reason] ?? FALLBACK_REFUSAL);
        return;
      }
      setJustification("");
      setActive(null);
    });
  }

  const justificationTooShort = justification.trim().length < wording.minimumJustificationLength;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRoundCheck aria-hidden className="size-4" />
          Enrollment submissions awaiting your decision
        </CardTitle>
        <CardDescription>{wording.whatApprovalMeans}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {submissions.length === 0 ? (
          <p className="text-sm text-fg-muted" role="status">
            Nothing is waiting. A submission appears here when somebody presents an onboarding
            capability you issued.
          </p>
        ) : (
          <>
            {refusal ? (
              <p
                aria-live="assertive"
                className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
                id={errorId}
                role="alert"
              >
                <span className="font-medium">Not decided. </span>
                {refusal}
              </p>
            ) : null}

            <label className="flex flex-col gap-1 text-sm" htmlFor={justificationId}>
              <span className="font-medium">Reason</span>
              <textarea
                className="min-h-20 rounded-md border border-border bg-bg px-3 py-2 text-sm"
                id={justificationId}
                onChange={(event) => setJustification(event.target.value)}
                required
                value={justification}
              />
              <span className="text-xs text-fg-muted">
                At least {wording.minimumJustificationLength} characters. It is written into the
                Governance decision and cannot be edited afterwards.
              </span>
            </label>

            <ul className="flex flex-col gap-3">
              {submissions.map((submission) => (
                <li
                  className="flex flex-col gap-2 rounded-md border border-border p-3"
                  key={submission.enrollmentId}
                >
                  <p className="text-sm">
                    <span className="font-medium">Submitted</span>{" "}
                    <time dateTime={submission.submittedAt}>{submission.submittedAt}</time>
                  </p>
                  <p className="font-mono text-xs text-fg-muted">
                    submission {submission.enrollmentId}
                  </p>
                  <p className="font-mono text-xs text-fg-muted">
                    capability {submission.invitationId}
                  </p>
                  {/*
                    A STRANDED CEREMONY IS SHOWN AS ITSELF. Calling an approved row "awaiting your
                    decision" would describe a state the tenant cannot act on, and offering Approve
                    again would be a control that does nothing.
                  */}
                  {submission.strandedAfterApproval ? (
                    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-2 p-2">
                      <p className="text-sm font-medium" role="status">
                        Approved, but the account was never created
                      </p>
                      <p className="text-xs text-fg-muted">
                        You approved this on{" "}
                        <time dateTime={submission.approvedAt ?? undefined}>
                          {submission.approvedAt}
                        </time>
                        . The person never finished — usually because they lost the browser they
                        started in. It cannot be finished now, and it blocks any new attempt with
                        that capability until you reject it.
                      </p>
                      <ul className="list-disc pl-4 text-xs text-fg-muted">
                        {STRANDED_RECOVERY_FACTS.map((fact) => (
                          <li key={fact}>{fact}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {submission.strandedAfterApproval ? null : (
                      <Button
                        disabled={busy || justificationTooShort}
                        onClick={() => decide(submission.enrollmentId, "approve")}
                      >
                        {busy && active === submission.enrollmentId
                          ? "Deciding…"
                          : "Approve identity enrollment"}
                      </Button>
                    )}
                    <Button
                      disabled={busy || justificationTooShort}
                      onClick={() => decide(submission.enrollmentId, "reject")}
                      variant="outline"
                    >
                      {submission.strandedAfterApproval
                        ? "Reject so they can try again"
                        : "Reject"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-xs text-fg-muted">{wording.whatItDoesNotProve}</p>
      </CardContent>
    </Card>
  );
}
