"use client";

/*
 * SELF-IMPROVING-AGENTS-3.1 — the filing control.
 *
 * ── WHY THIS IS A SEPARATE COMPONENT FROM THE SIA-3 READ SURFACE ─────────────
 *
 * `agent-improvement-hypothesis.tsx` is a server component with no client boundary, no handler and
 * nothing imported that could mutate — and a released firewall asserts every one of those. That
 * proof is worth keeping exactly as it is, so the write control is a DIFFERENT file rather than an
 * amendment to it. The read surface still cannot reach a writer; this file can reach exactly one,
 * and only through the server action boundary.
 *
 * ── IT FILES. IT DOES NOT APPLY, APPROVE, RETRY, TUNE OR ENABLE ──────────────
 *
 * There is no control here that changes an agent, and none that decides a hypothesis. The single
 * button writes one record and stops. The word "Apply" appears nowhere, and neither does any of its
 * neighbours — a test enumerates them against this file for the same reason the read surface has
 * one, because this is the surface where such a control would look most natural.
 *
 * ── THE CONSEQUENCE IS STATED BEFORE THE CLICK, NOT AFTER ────────────────────
 *
 * Filing is permanent: a hypothesis cannot be withdrawn, edited or deleted, because no such
 * authority was written. So this form does not behave like a text box. Nothing autosaves, the
 * primary action is a two-step confirmation, and the first step lists what the filing will write
 * and — at equal weight — what it will not.
 *
 * ── WHAT IT SENDS ────────────────────────────────────────────────────────────
 *
 * Which agent, which closed target, which closed finding, three pieces of prose, and optionally a
 * predecessor. The tenant, the author, the evidence counts and the instant they were read are
 * resolved server-side and have no parameter here.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StateBlock } from "@/components/ui/state-block";
import { fileImprovementHypothesisAction } from "@/app/(dashboard)/agents/actions";
import {
  EVIDENCE_FINDING_KEYS,
  EVIDENCE_MEANING,
  IMPROVEMENT_TARGETS,
} from "@/features/agent-improvement-hypothesis/contracts";
import {
  FILING_MAX_CANDIDATE_CHANGE,
  FILING_MAX_EXPECTED_EFFECT,
  FILING_MAX_LIMITATIONS,
  FILING_MIN_PROSE,
  HYPOTHESIS_FILING_REFUSAL_TEXT,
  HYPOTHESIS_FILING_WORDING as W,
} from "@/features/agent-improvement-hypothesis/filing-wording";
import type { DurableAgentIdentityRecord } from "@/features/agent-identity/read-durable-agent-identity.server";

/** Why the filing seam is not available, when it is not. Each states the real reason. */
export type HypothesisFilingBlock =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "no-agent-in-service" };

export interface AgentImprovementHypothesisFilingProps {
  readonly block?: HypothesisFilingBlock;
  /** Durable agents this tenant owns. Resolved server-side; the client never names a tenant. */
  readonly identities?: readonly DurableAgentIdentityRecord[];
}

const FIELD =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const FALLBACK_REFUSAL =
  "The filing was refused and nothing was written. The reason was not one this surface knows how to explain.";

function Field({
  label,
  help,
  id,
  value,
  onChange,
  max,
  rows,
}: {
  readonly label: string;
  readonly help: string;
  readonly id: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly max: number;
  readonly rows: number;
}) {
  const short = value.trim().length > 0 && value.trim().length < FILING_MIN_PROSE;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-fg">
        {label}
      </label>
      <p className="text-[0.65rem] leading-4 text-fg-muted">{help}</p>
      <textarea
        id={id}
        rows={rows}
        maxLength={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD}
      />
      <p className="text-[0.6rem] text-fg-muted">
        {short
          ? `At least ${FILING_MIN_PROSE} characters. ${value.trim().length} so far.`
          : `${value.trim().length} / ${max}`}
      </p>
    </div>
  );
}

export function AgentImprovementHypothesisFiling({
  block,
  identities = [],
}: AgentImprovementHypothesisFilingProps) {
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();

  const inService = identities.filter((identity) => identity.inService);

  const [agentId, setAgentId] = useState("");
  const [finding, setFinding] = useState<string>(EVIDENCE_FINDING_KEYS[0] ?? "");
  const [candidateChange, setCandidateChange] = useState("");
  const [expectedEffect, setExpectedEffect] = useState("");
  const [limitations, setLimitations] = useState("");
  const [supersedes, setSupersedes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  if (block) {
    return (
      <StateBlock
        tone={block.kind === "unauthenticated" ? "restricted" : "empty"}
        title={block.kind === "unauthenticated" ? W.regionTitle : W.noAgentsTitle}
        description={
          block.kind === "unauthenticated" ? W.unauthenticatedDetail : W.noAgentsDetail
        }
      />
    );
  }

  const chosenAgent = inService.find((identity) => identity.agentId === agentId);
  const proseReady =
    candidateChange.trim().length >= FILING_MIN_PROSE &&
    expectedEffect.trim().length >= FILING_MIN_PROSE &&
    limitations.trim().length >= FILING_MIN_PROSE;
  const ready = Boolean(chosenAgent) && proseReady;

  function file() {
    setRefusal(null);
    startTransition(async () => {
      const result = await fileImprovementHypothesisAction({
        agentId,
        /*
         * THE CLOSED TARGET, FROM THE CONTRACT — never a free string and never a second value. A
         * vocabulary with one entry is not a dropdown; offering a choice here would imply the other
         * targets exist.
         */
        improvementTarget: IMPROVEMENT_TARGETS[0] ?? "",
        evidenceFindingKey: finding,
        candidateChange,
        expectedEffect,
        limitations,
        supersedesHypothesisId: supersedes.trim() === "" ? null : supersedes.trim(),
      });
      if (result.status === "filed") {
        setConfirming(false);
        setCandidateChange("");
        setExpectedEffect("");
        setLimitations("");
        setSupersedes("");
        setOutcome(W.filedNotice);
        router.refresh();
        return;
      }
      setOutcome(null);
      setRefusal(HYPOTHESIS_FILING_REFUSAL_TEXT[result.reason] ?? FALLBACK_REFUSAL);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <FilePlus2 aria-hidden className="size-4" />
            {W.regionTitle}
          </CardTitle>
          <CardDescription>{W.regionSummary}</CardDescription>
        </div>
        <Badge variant="primary">canonical database</Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* ── WHAT THIS IS NOT, SAID FIRST ──────────────────────────────── */}
        <div className="flex flex-col gap-1.5 rounded-md border bg-surface-sunken p-3">
          <p className="text-xs leading-5 text-fg">{W.filingIsNotImproving}</p>
          <p className="text-xs leading-5 text-fg-muted">{W.filingIsNotApproving}</p>
          <p className="text-xs leading-5 text-fg-muted">{W.preparedIsNotFiled}</p>
        </div>

        {/* ── THE SUBJECT ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-agent`} className="text-xs font-medium text-fg">
            {W.agentLabel}
          </label>
          <p className="text-[0.65rem] leading-4 text-fg-muted">{W.agentHelp}</p>
          <select
            id={`${ids}-agent`}
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
            className={FIELD}
          >
            <option value="">—</option>
            {inService.map((identity) => (
              <option key={identity.agentId} value={identity.agentId}>
                {identity.name}
              </option>
            ))}
          </select>
        </div>

        {/* ── THE EVIDENCE, CHOSEN AS A FINDING AND NEVER AS A NUMBER ───── */}
        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-finding`} className="text-xs font-medium text-fg">
            {W.evidenceLabel}
          </label>
          <p className="text-[0.65rem] leading-4 text-fg-muted">{W.evidenceHelp}</p>
          <select
            id={`${ids}-finding`}
            value={finding}
            onChange={(event) => setFinding(event.target.value)}
            className={FIELD}
          >
            {EVIDENCE_FINDING_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          {/*
           * WHAT THE CHOSEN FINDING MEANS — AND DOES NOT MEAN. Rendered from SIA-3's released
           * mapping, so the sentence that stops a reader treating `no-action` as a failure travels
           * with the control that files it.
           */}
          <p className="mt-1 text-[0.65rem] leading-4 text-fg-muted">
            {EVIDENCE_MEANING[finding as keyof typeof EVIDENCE_MEANING]}
          </p>
        </div>

        <Field
          label={W.candidateChangeLabel}
          help={W.candidateChangeHelp}
          id={`${ids}-change`}
          value={candidateChange}
          onChange={setCandidateChange}
          max={FILING_MAX_CANDIDATE_CHANGE}
          rows={4}
        />
        <Field
          label={W.expectedEffectLabel}
          help={W.expectedEffectHelp}
          id={`${ids}-effect`}
          value={expectedEffect}
          onChange={setExpectedEffect}
          max={FILING_MAX_EXPECTED_EFFECT}
          rows={3}
        />
        <Field
          label={W.limitationsLabel}
          help={W.limitationsHelp}
          id={`${ids}-limits`}
          value={limitations}
          onChange={setLimitations}
          max={FILING_MAX_LIMITATIONS}
          rows={3}
        />

        {/* ── LINEAGE, AND WHAT IT DOES NOT DO ──────────────────────────── */}
        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-supersedes`} className="text-xs font-medium text-fg">
            {W.supersedesLabel}
          </label>
          <p className="text-[0.65rem] leading-4 text-fg-muted">{W.supersedingWithdrawsNothing}</p>
          <input
            id={`${ids}-supersedes`}
            value={supersedes}
            onChange={(event) => setSupersedes(event.target.value)}
            className={FIELD}
            placeholder="—"
          />
        </div>

        <p className="text-[0.65rem] leading-4 text-fg-muted">{W.filingTwiceWritesTwo}</p>

        {/* ── THE TWO-STEP ──────────────────────────────────────────────── */}
        {confirming ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-sunken p-3">
            <p className="text-xs font-semibold text-fg">{W.confirmationTitle}</p>
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {W.confirmationConsequences.map((line) => (
                <li key={line} className="text-xs leading-5 text-fg-muted">
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button onClick={file} disabled={pending || !ready}>
                {W.confirmControl}
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                {W.cancelControl}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button onClick={() => setConfirming(true)} disabled={pending || !ready}>
              {W.reviewControl}
            </Button>
          </div>
        )}

        {refusal ? (
          <StateBlock tone="unavailable" title="Nothing was written" description={refusal} />
        ) : null}
        {outcome ? (
          <StateBlock tone="empty" title="Filed, and undecided" description={outcome} />
        ) : null}
      </CardContent>
    </Card>
  );
}
