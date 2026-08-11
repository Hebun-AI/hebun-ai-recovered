"use client";

/*
 * Authority roster card (G3) — the tenant's Governance authorities, their provenance, and the two
 * ceremonies that move authority.
 *
 * IT EXTENDS THE GOVERNANCE WORKSPACE. There is no competing authority-management product: this
 * card sits under the existing Governance Authority page, beside the genesis card, and it creates
 * nothing of its own — every action writes a Governance decision through the same seam G2 built.
 *
 * THE LANGUAGE IS DELIBERATE. "Delegate Governance Authority", "Revoke Governance Authority",
 * "Active Governance Authorities", "Authority Provenance". Never Enable, Turn on, Promote, Make
 * admin, or Approve user — those describe product features, and this is not one.
 *
 * WHAT DELEGATION DOES NOT CHANGE is rendered from frozen values, so the wording cannot drift from
 * the code. A test asserts every entry appears.
 *
 * ACCESSIBILITY: real <label>s, help and error wired through aria-describedby, `aria-invalid` on
 * refusal, refusals in role="alert", success in role="status", and authority state carried by words
 * and an icon rather than colour.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  delegateGovernanceAuthorityAction,
  revokeGovernanceAuthorityAction,
} from "@/app/(dashboard)/governance/authority/actions";
import { JUSTIFICATION_LIMITS } from "@/features/governance-decision/contracts";
import {
  AUTHORITY_REVOCATION_POLICY,
  DELEGATION_EFFECT,
  DELEGATION_NON_EFFECTS,
  DELEGATION_SCOPE_NOTICE,
  REVOCATION_EFFECT,
  REVOCATION_NON_EFFECTS,
  type AuthorityRoster,
  type DelegationRefusal,
  type RevocationRefusal,
} from "@/features/governance-decision/delegation-contracts";

/** A human this tenant could receive authority — resolved server-side, never guessed here. */
export interface DelegationCandidate {
  readonly userId: string;
  readonly label: string;
}

const DELEGATION_REFUSAL_TEXT: Record<DelegationRefusal, string> = {
  unauthenticated: "Your session ended. Sign in again.",
  "no-governance-authority": "This tenant has no Governance authority yet.",
  "not-a-governance-authority":
    "Only a current Governance authority may delegate. An organizational role does not grant it.",
  "target-unresolvable": "That human is not an active member of this tenant.",
  "self-delegation": "You already hold Governance authority.",
  "already-authorized": "That human already holds Governance authority.",
  "justification-required": `A reason of at least ${JUSTIFICATION_LIMITS.minimumLength} characters is required.`,
  "persistence-unavailable": "The durable store is unavailable. Nothing was changed.",
};

const REVOCATION_REFUSAL_TEXT: Record<RevocationRefusal, string> = {
  unauthenticated: "Your session ended. Sign in again.",
  "no-governance-authority": "This tenant has no Governance authority yet.",
  "not-a-governance-authority": "Only a current Governance authority may revoke.",
  "delegation-unresolvable": "That delegation could not be resolved in this tenant.",
  "not-the-grantor":
    "You may revoke only the delegations you granted. Ask the genesis authority to revoke this one.",
  "already-revoked": "That authority was already revoked.",
  "bootstrap-not-revocable":
    "The genesis authority is constitutional and cannot be revoked. Authority transfer is a separate phase.",
  "justification-required": `A reason of at least ${JUSTIFICATION_LIMITS.minimumLength} characters is required.`,
  "persistence-unavailable": "The durable store is unavailable. Nothing was changed.",
};

const FIELD_STYLE =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function shortId(value: string | null): string {
  return value ? `${value.slice(0, 8)}…` : "—";
}

export function AuthorityRosterCard({
  roster,
  candidates,
  viewerUserId,
}: {
  roster: AuthorityRoster;
  candidates: readonly DelegationCandidate[];
  viewerUserId: string | null;
}) {
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"none" | "delegate" | "revoke">("none");
  const [target, setTarget] = useState("");
  const [revokeTarget, setRevokeTarget] = useState("");
  const [justification, setJustification] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const tooShort = justification.trim().length < JUSTIFICATION_LIMITS.minimumLength;
  const errorId = `${ids}-error`;
  const helpId = `${ids}-help`;

  /* A1-c: the genesis human may revoke anything; a delegate may revoke only their own grants. */
  const revocable = roster.active
    .filter((entry) => entry.kind === "delegated")
    .filter(
      (entry) =>
        roster.viewerIsBootstrapAuthority || entry.grantedByActorId === viewerUserId,
    );

  function reset() {
    setMode("none");
    setTarget("");
    setRevokeTarget("");
    setJustification("");
    setRefusal(null);
  }

  function submit() {
    setRefusal(null);
    startTransition(async () => {
      if (mode === "delegate") {
        const result = await delegateGovernanceAuthorityAction({
          toUserId: target,
          justification,
        });
        if (result.status === "refused") {
          setRefusal(DELEGATION_REFUSAL_TEXT[result.reason]);
          return;
        }
        setDone("Governance authority delegated. It takes effect on their next request.");
      } else {
        const result = await revokeGovernanceAuthorityAction({
          delegationDecisionId: revokeTarget,
          justification,
        });
        if (result.status === "refused") {
          setRefusal(REVOCATION_REFUSAL_TEXT[result.reason]);
          return;
        }
        setDone("Governance authority revoked. The delegation decision remains in the record.");
      }
      reset();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" aria-hidden />
          Active Governance Authorities
        </CardTitle>
        <CardDescription>
          Who may make Governance decisions in this tenant, and how each of them came to.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* ── Authority Provenance ── */}
        <ul className="flex flex-col gap-2">
          {roster.active.map((entry) => (
            <li
              key={entry.decisionId}
              className="rounded-lg border border-border bg-surface-muted p-3 text-sm"
            >
              <p className="flex items-start gap-2 text-fg">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium">{shortId(entry.actorId)}</span>
                  {entry.actorId === viewerUserId ? " (you)" : ""} —{" "}
                  {entry.kind === "bootstrap"
                    ? "genesis authority, established by this tenant's bootstrap decision"
                    : `delegated by ${shortId(entry.grantedByActorId)}`}
                </span>
              </p>
              <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-fg-muted sm:grid-cols-2">
                <div>
                  <dt className="inline uppercase tracking-wide">Since </dt>
                  <dd className="inline">{entry.since}</dd>
                </div>
                <div>
                  <dt className="inline uppercase tracking-wide">Decision </dt>
                  <dd className="inline break-all">{entry.decisionId}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline uppercase tracking-wide">Stated reason </dt>
                  {/* Rendered as text, never as markup. It is inert. */}
                  <dd className="inline whitespace-pre-wrap break-words">{entry.justification}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        {roster.revoked.length > 0 ? (
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
              Authority Provenance — revoked
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-fg-muted">
              {roster.revoked.map((entry) => (
                <li key={entry.revocationDecisionId} className="flex items-start gap-2">
                  <ShieldOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    {shortId(entry.actorId)} — delegated by {shortId(entry.grantedByActorId)} at{" "}
                    {entry.since}, revoked by {shortId(entry.revokedByActorId)} at {entry.revokedAt}.
                    The delegation decision remains in the record.
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {done ? (
          <p
            role="status"
            className="rounded-lg border border-border bg-surface-muted p-3 text-sm text-fg"
          >
            {done}
          </p>
        ) : null}

        {!roster.viewerIsAuthority ? (
          <p className="rounded-lg border border-border bg-surface-muted p-3 text-sm text-fg-muted">
            Only a current Governance authority may delegate or revoke. Holding an owner or director
            role does not grant Governance authority.
          </p>
        ) : mode === "none" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => { setDone(null); setMode("delegate"); }}>
              Delegate Governance Authority
            </Button>
            {revocable.length > 0 ? (
              <Button variant="outline" onClick={() => { setDone(null); setMode("revoke"); }}>
                Revoke Governance Authority
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-surface-muted p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                {mode === "delegate"
                  ? `Delegating ${DELEGATION_EFFECT}`
                  : `Revoking ${REVOCATION_EFFECT}`}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-fg-muted">
                {(mode === "delegate" ? DELEGATION_NON_EFFECTS : REVOCATION_NON_EFFECTS).map(
                  (effect) => (
                    <li key={effect}>
                      {mode === "delegate" ? "Delegation" : "Revocation"} {effect}.
                    </li>
                  ),
                )}
              </ul>
            </div>

            <p className="text-xs text-fg-muted">
              {mode === "delegate" ? DELEGATION_SCOPE_NOTICE : AUTHORITY_REVOCATION_POLICY.rationale}
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-target`} className="text-sm font-medium text-fg">
                {mode === "delegate" ? "Which human receives Governance authority?" : "Which delegated authority ends?"}
              </label>
              <select
                id={`${ids}-target`}
                className={FIELD_STYLE}
                value={mode === "delegate" ? target : revokeTarget}
                onChange={(event) =>
                  mode === "delegate"
                    ? setTarget(event.target.value)
                    : setRevokeTarget(event.target.value)
                }
                required
              >
                <option value="">Select…</option>
                {mode === "delegate"
                  ? candidates.map((candidate) => (
                      <option key={candidate.userId} value={candidate.userId}>
                        {candidate.label}
                      </option>
                    ))
                  : revocable.map((entry) => (
                      <option key={entry.decisionId} value={entry.decisionId}>
                        {shortId(entry.actorId)} — delegated {entry.since}
                      </option>
                    ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-justification`} className="text-sm font-medium text-fg">
                {mode === "delegate"
                  ? "Why are you delegating Governance authority?"
                  : "Why are you revoking this Governance authority?"}
              </label>
              <textarea
                id={`${ids}-justification`}
                className={FIELD_STYLE}
                rows={3}
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                maxLength={JUSTIFICATION_LIMITS.maximumLength}
                aria-describedby={refusal ? `${helpId} ${errorId}` : helpId}
                aria-invalid={refusal !== null || undefined}
                required
              />
              <p id={helpId} className="text-xs text-fg-muted">
                Required, written by you, and stored permanently on the Governance decision. At least{" "}
                {JUSTIFICATION_LIMITS.minimumLength} characters.
              </p>
            </div>

            {refusal ? (
              <p id={errorId} role="alert" className="text-sm text-fg">
                {refusal}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={submit}
                disabled={
                  pending || tooShort || (mode === "delegate" ? target === "" : revokeTarget === "")
                }
              >
                {pending
                  ? "Recording…"
                  : mode === "delegate"
                    ? "Delegate Governance Authority"
                    : "Revoke Governance Authority"}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={pending}>
                Not now
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Icon re-exported for the page's empty state so it does not import lucide twice. */
export { UserPlus as DelegationIcon };
