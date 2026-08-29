"use client";

/*
 * SELF-IMPROVING-AGENTS-3.1 — deciding one improvement hypothesis, on the Governance surface.
 *
 * ── WHY IT IS HERE AND NOT ON /agents ────────────────────────────────────────
 *
 * Filing and deciding are two acts by two authorities. `/agents` is where the evidence is read and
 * where a human files a question; this is where a Governance authority answers it. Putting the
 * answer beside the question would put an author one click from accepting their own argument, and
 * would create a second place where Governance authority is exercised.
 *
 * It sits next to `PendingEnrollmentCard` and takes the same shape for the same reason: both are a
 * Governance authority turning a key on a subject some other subsystem owns.
 *
 * ── ACCEPTING IS NOT APPLYING, AND THE CARD SAYS SO BEFORE THE BUTTON ────────
 *
 * "Governance approved" is exactly the phrase a reader finishes for themselves as "so it was
 * done". Nothing in this repository can apply a hypothesis, so the sentence that says so is
 * rendered above the controls rather than in a footnote — and the accept button is worded "Accept
 * as worth pursuing", never "Approve" and never "Apply".
 *
 * ── IT DECIDES. IT CHANGES NO AGENT AND WITHDRAWS NO HYPOTHESIS ──────────────
 *
 * The only action imported is the Governance decision boundary. There is no control here that
 * edits, withdraws or deletes a hypothesis, because no such authority was written.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scale } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StateBlock } from "@/components/ui/state-block";
import { decideImprovementHypothesisAction } from "@/app/(dashboard)/governance/authority/actions";
import { JUSTIFICATION_LIMITS } from "@/features/governance-decision/contracts";
import {
  HYPOTHESIS_DECISION_REFUSAL_TEXT,
  HYPOTHESIS_DECISION_WORDING as W,
} from "@/features/agent-improvement-hypothesis/filing-wording";

/**
 * One undecided hypothesis, as this card needs it.
 *
 * A PROJECTION OF SIA-3'S RELEASED VIEW, narrowed on the page. This component declares its own
 * shape rather than importing the read model's type, so it pulls no server module into the client
 * bundle — and the narrowing is what stops a decision control from ever being handed a hypothesis
 * that already carries a decision.
 */
export interface UndecidedHypothesis {
  readonly hypothesisId: string;
  readonly agentName: string;
  readonly evidenceFindingKey: string;
  readonly evidenceSource: string;
  readonly evidenceObservedValue: number;
  readonly evidenceObservedTotal: number;
  readonly evidenceObservedAt: string;
  readonly candidateChange: string;
  readonly expectedEffect: string;
  readonly limitations: string;
  readonly filedAt: string;
}

export interface UndecidedHypothesisCardProps {
  readonly hypotheses: readonly UndecidedHypothesis[];
  /** True when the SIA-3 read seam did not answer. Unknown is never rendered as "none". */
  readonly unavailable?: boolean;
}

const FIELD =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const FALLBACK_REFUSAL =
  "The decision was refused and nothing was recorded. The reason was not one this surface knows how to explain.";

function Line({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
        {label}
      </span>
      <span className="text-xs leading-5 text-fg">{value}</span>
    </div>
  );
}

export function UndecidedHypothesisCard({
  hypotheses,
  unavailable = false,
}: UndecidedHypothesisCardProps) {
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);

  function decide(hypothesisId: string, decision: "approve" | "reject") {
    setRefusal(null);
    setActive(hypothesisId);
    startTransition(async () => {
      const result = await decideImprovementHypothesisAction({
        hypothesisId,
        decision,
        justification,
      });
      if (result.status === "refused") {
        setRefusal(HYPOTHESIS_DECISION_REFUSAL_TEXT[result.reason] ?? FALLBACK_REFUSAL);
        return;
      }
      setJustification("");
      setActive(null);
      router.refresh();
    });
  }

  const justificationTooShort = justification.trim().length < JUSTIFICATION_LIMITS.minimumLength;

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Scale aria-hidden className="size-4" />
            {W.regionTitle}
          </CardTitle>
          <CardDescription>{W.regionSummary}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* ── WHAT A DECISION HERE DOES NOT DO ──────────────────────────── */}
        <div className="flex flex-col gap-1.5 rounded-md border bg-surface-sunken p-3">
          <p className="text-xs leading-5 text-fg">{W.acceptingIsNotApplying}</p>
          <p className="text-xs leading-5 text-fg-muted">{W.decliningIsNotDeleting}</p>
          <p className="text-xs leading-5 text-fg-muted">{W.decisionIsFinal}</p>
        </div>

        {unavailable ? (
          <StateBlock tone="unavailable" title={W.unavailable} description={W.noneIsNotNothingFiled} />
        ) : hypotheses.length === 0 ? (
          <StateBlock tone="empty" title={W.none} description={W.noneIsNotNothingFiled} />
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${ids}-just`} className="text-xs font-medium text-fg">
                {W.justificationLabel}
              </label>
              <p className="text-[0.65rem] leading-4 text-fg-muted">{W.justificationHelp}</p>
              <textarea
                id={`${ids}-just`}
                rows={3}
                maxLength={JUSTIFICATION_LIMITS.maximumLength}
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                className={FIELD}
              />
              <p className="text-[0.6rem] text-fg-muted">
                {justificationTooShort
                  ? `At least ${JUSTIFICATION_LIMITS.minimumLength} characters. ${justification.trim().length} so far.`
                  : `${justification.trim().length} / ${JUSTIFICATION_LIMITS.maximumLength}`}
              </p>
            </div>

            {hypotheses.map((hypothesis) => (
              <article
                key={hypothesis.hypothesisId}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <header className="flex flex-wrap items-baseline gap-2">
                  <h4 className="text-sm font-semibold text-fg">{hypothesis.agentName}</h4>
                  <span className="text-[0.65rem] text-fg-muted">
                    filed {hypothesis.filedAt}
                  </span>
                </header>
                <Line
                  label="Observed"
                  value={`${hypothesis.evidenceFindingKey}: ${hypothesis.evidenceObservedValue} of ${hypothesis.evidenceObservedTotal}, read from ${hypothesis.evidenceSource} at ${hypothesis.evidenceObservedAt}`}
                />
                <Line label="Candidate change" value={hypothesis.candidateChange} />
                <Line label="Expected structural effect" value={hypothesis.expectedEffect} />
                <Line label="What it does not know" value={hypothesis.limitations} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => decide(hypothesis.hypothesisId, "approve")}
                    disabled={pending || justificationTooShort}
                  >
                    {W.acceptControl}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => decide(hypothesis.hypothesisId, "reject")}
                    disabled={pending || justificationTooShort}
                  >
                    {W.declineControl}
                  </Button>
                  {pending && active === hypothesis.hypothesisId ? (
                    <span className="self-center text-[0.65rem] text-fg-muted">recording…</span>
                  ) : null}
                </div>
              </article>
            ))}
          </>
        )}

        {refusal ? (
          <StateBlock tone="unavailable" title="Nothing was recorded" description={refusal} />
        ) : null}
      </CardContent>
    </Card>
  );
}
