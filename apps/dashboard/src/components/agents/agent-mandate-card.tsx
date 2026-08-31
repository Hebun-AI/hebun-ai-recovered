"use client";

/*
 * AMA-3 — the Agent Mandate surface: what a durable agent is FOR, and the human workflow that
 * records it.
 *
 * ── WHAT THIS CARD IS, AND WHAT IT IS NOT ────────────────────────────────────
 *
 * It is the ONLY place in the product where a mandate can be read or written. It renders
 * authoritative rows from `agent_mandates` and calls the ONE released writer. It is not a
 * permissions editor, not a capability toggle, not a role assignment and not a runtime control.
 *
 *     A MANDATE IS A CEILING ON WHAT THIS AGENT MAY **PROPOSE**.
 *
 * Everything on this card is written so a reader cannot come away believing otherwise. The scope
 * list is headed "may propose", never "can do" or "permissions". Every proposal inside the ceiling
 * still needs a human decision, and the card says so beside the scope rather than in a footnote.
 *
 * ── SIX TRUTH CLASSES, KEPT VISUALLY AND SEMANTICALLY APART ──────────────────
 *
 *   authoritative identity     the durable agent record            (rendered by the card above)
 *   authoritative mandate      the effective revision              AUTHORITATIVE
 *   authoritative history      superseded revisions, never edited  AUTHORITATIVE · SUPERSEDED
 *   known absence              nobody has bounded this agent       NO MANDATE
 *   authority unavailable      Hebun could not look                UNAVAILABLE
 *   seeded definitions         the in-memory registry below        NON-AUTHORITATIVE (not here)
 *
 * The middle two are the ones that must never merge, and they are rendered as different states with
 * different tones and different sentences: `NO MANDATE != UNLIMITED MANDATE` and
 * `UNAVAILABLE != NO MANDATE`.
 *
 * ── PROGRESSIVE DISCLOSURE ───────────────────────────────────────────────────
 *
 * The default view answers the two questions a human actually has — what is this agent for, and
 * what may it propose. Governance decision ids, session ids, mandate ids and the full revision
 * chain are real and are kept in `<details>`: technical provenance available on demand, never
 * dominating the surface. CMD-V3 settled that `<details>` layers truth without hiding it.
 *
 * ── THE FORM SENDS FIVE VALUES AND NOTHING ELSE ──────────────────────────────
 *
 * Which agent, a purpose, a scope, a justification, and the revision the reader was shown. The
 * tenant, the actor, the Governance authority, the decision, the session, the ordinal, the
 * predecessor and every timestamp are derived server-side by the writer. The scope selector offers
 * exactly `MANDATE_SCOPE_VOCABULARY` and has no free-text field, so a kind outside the released
 * vocabulary is unrepresentable here — and the writer refuses one anyway.
 *
 * Withdrawal is submitting an EMPTY scope. It is the same one transition and it is confirmed
 * separately, because "this agent may now propose nothing" is a consequence a reader must see
 * before it happens rather than discover afterwards.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScrollText, ShieldQuestion } from "lucide-react";
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
import { establishAgentMandateAction } from "@/app/(dashboard)/agents/actions";
import {
  MANDATE_DOES_NOT_MEAN,
  MANDATE_SCOPE_VOCABULARY,
  MAX_MANDATE_PURPOSE_CHARACTERS,
  MIN_MANDATE_PURPOSE_CHARACTERS,
  type AgentMandateRefusal,
} from "@/features/agent-mandate/contracts";
import type { AgentMandateRevision } from "@/features/agent-mandate/read-agent-mandate.server";
import type { DurableAgentIdentityRecord } from "@/features/agent-identity/read-durable-agent-identity.server";

/** The minimum a Governance justification must carry. Mirrors the released validator's floor. */
const JUSTIFICATION_MIN = 12;

/**
 * One agent's mandate standing, resolved SERVER-SIDE and passed down.
 *
 * `unavailable` is its own variant rather than `mandate: null` with a flag, because the whole point
 * is that a component cannot accidentally render an outage as an absence.
 */
export type AgentMandateStanding =
  | { readonly kind: "known"; readonly effective: AgentMandateRevision | null; readonly history: readonly AgentMandateRevision[] }
  | { readonly kind: "unavailable"; readonly reason: string };

export interface AgentMandateEntry {
  readonly identity: DurableAgentIdentityRecord;
  readonly standing: AgentMandateStanding;
}

/** Why the surface is not available at all. Each states the real reason; neither is "no mandate". */
export type MandateBlock =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "identity-authority-unavailable" }
  | { readonly kind: "no-durable-agent" };

export interface AgentMandateCardProps {
  readonly block?: MandateBlock;
  readonly entries?: readonly AgentMandateEntry[];
}

const FIELD =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/* The words this surface uses. Held together so a truth claim cannot drift one edit at a time. */
const W = {
  regionTitle: "Agent mandate",
  regionDescription:
    "What this organization has recorded that each durable agent is FOR, and the maximum surface inside which it may propose. A mandate is a ceiling: it grants nothing, and every proposal inside it still requires a human decision.",
  unauthenticatedTitle: "Sign in to read agent mandates",
  unauthenticatedDetail:
    "Mandates are read tenant-scoped from your session. Nothing is shown to an unauthenticated reader, and nothing is assumed about what any agent may propose.",
  authorityUnavailableTitle: "The durable agent authority could not be reached",
  authorityUnavailableDetail:
    "Which agents exist could not be read, so what any of them is bounded to is unknown. This is an unread state, not a statement that this organization has no agents and not a statement that any agent is unbounded.",
  noAgentTitle: "No durable agent has been established",
  noAgentDetail:
    "There is nothing for a mandate to bound yet. Establishing a durable agent identity grants it nothing on its own — an agent with no mandate may propose nothing.",
  absentTitle: "No mandate recorded",
  absentDetail:
    "Nobody has bounded this agent. This is a measured absence, never a permission: an agent with no mandate may propose NOTHING, and its proposals are refused before anything is written.",
  mandateUnavailableTitle: "Mandate authority unavailable",
  mandateUnavailableDetail:
    "Hebun could not read this agent's recorded ceiling. UNAVAILABLE is not NO MANDATE — nothing here says a mandate does or does not exist, and no mandate may be established until the authority answers.",
  withdrawnLabel: "May propose nothing — withdrawn",
  withdrawnDetail:
    "The organization recorded an empty ceiling. That is how withdrawal is expressed: a new revision rather than a flag, so the previous one stays readable exactly as it was authorized.",
  scopeHeading: "May propose",
  scopeCaveat:
    "Inside this list a proposal may be FILED. It is not approved, not permitted and not executed by being inside it — a human still decides every one.",
  establishHeading: "Record a mandate",
  reviseHeading: "Revise this mandate",
  establishedNotice:
    "The mandate was recorded. It bounds what this agent may propose from now on, and it authorized nothing.",
} as const;

/* Refusal reasons rendered as sentences. The REASON CODE is the product truth; this is its prose. */
const REFUSAL_TEXT: Record<AgentMandateRefusal, string> = {
  unauthenticated:
    "No authenticated organization and human could be resolved for this request. Nothing was written.",
  "persistence-unavailable":
    "The control-plane database could not be reached. The write failed closed — nothing was recorded, and no mandate was assumed.",
  "justification-required": `A Governance decision needs a stated reason of at least ${JUSTIFICATION_MIN} characters. Nothing was written.`,
  "mandate-purpose-required": `The purpose must be ${MIN_MANDATE_PURPOSE_CHARACTERS}–${MAX_MANDATE_PURPOSE_CHARACTERS} characters. It is never trimmed into shape for you, because a repaired purpose is a different purpose.`,
  "mandate-scope-invalid":
    "The proposed scope named something outside the action kinds an agent may originate. It was refused whole rather than narrowed, because a narrowed scope is a mandate nobody authorized.",
  "agent-identity-authority-unavailable":
    "The agent identity authority could not be reached, so the agent could not be confirmed to exist. Nothing was written.",
  "agent-unresolvable":
    "No durable agent with that identifier exists in this organization. Nothing was written.",
  "agent-retired":
    "That agent has been withdrawn from service. Bounding the future proposals of something that no longer proposes would state a constraint on nothing.",
  "no-governance-authority":
    "This organization has not established Governance authority yet, so no human can authorize a mandate. Nothing was written.",
  "not-the-governance-authority":
    "You are signed in, and you are not the human this organization established as its Governance authority. A tenant owner without Governance authority is refused exactly like a stranger.",
  "stale-mandate-revision":
    "The mandate changed since this page was loaded, so the revision you were shown is no longer the effective one. Nothing was written and nothing was overwritten — reload to see the current ceiling before deciding again.",
  "concurrent-mandate-change":
    "Another mandate change committed at the same moment and this one lost the race. Nothing was written, and nothing was overwritten.",
};

const FALLBACK_REFUSAL = "The mandate was refused, and nothing was written.";

function ScopeList({ scope }: { scope: readonly string[] }) {
  if (scope.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface-sunken p-3">
        <Badge variant="warning">{W.withdrawnLabel}</Badge>
        <p className="mt-2 text-xs leading-5 text-fg-secondary">{W.withdrawnDetail}</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border bg-surface-sunken p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
        {W.scopeHeading}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {scope.map((kind) => (
          <Badge key={kind} variant="success">
            {kind}
          </Badge>
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-fg-secondary">{W.scopeCaveat}</p>
    </div>
  );
}

/** Technical provenance, layered rather than hidden. */
function Provenance({ revision }: { revision: AgentMandateRevision }) {
  return (
    <details className="rounded-md border border-border bg-surface-sunken p-3">
      <summary className="cursor-pointer text-xs font-medium text-fg">
        Governance binding and record identifiers
      </summary>
      <dl className="mt-2 grid gap-1 text-[0.7rem] text-fg-secondary">
        <div>
          <dt className="inline font-medium">Mandate record: </dt>
          <dd className="inline break-all font-mono">{revision.mandateId}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Governance decision: </dt>
          <dd className="inline break-all font-mono">{revision.governanceDecisionId}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Governance session: </dt>
          <dd className="inline break-all font-mono">{revision.governanceSessionId}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Effective from: </dt>
          <dd className="inline">{revision.effectiveFrom}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Supersedes: </dt>
          <dd className="inline break-all font-mono">
            {revision.supersedesMandateId ?? "nothing — this is the first revision"}
          </dd>
        </div>
      </dl>
    </details>
  );
}

function History({ revisions }: { revisions: readonly AgentMandateRevision[] }) {
  if (revisions.length === 0) return null;
  return (
    <details className="rounded-md border border-border bg-surface-sunken p-3">
      <summary className="cursor-pointer text-xs font-medium text-fg">
        {revisions.length} superseded {revisions.length === 1 ? "revision" : "revisions"} — never
        edited, kept exactly as authorized
      </summary>
      <ul className="mt-2 flex flex-col gap-3">
        {revisions.map((revision) => (
          <li key={revision.mandateId} className="border-t border-border pt-2">
            <p className="text-xs font-medium text-fg">
              Revision {revision.mandateRevision}{" "}
              <Badge variant="neutral">superseded</Badge>
            </p>
            <p className="mt-1 text-xs leading-5 text-fg-secondary">{revision.purpose}</p>
            <p className="mt-1 text-[0.7rem] text-fg-muted">
              {revision.proposalScope.length === 0
                ? "May propose nothing"
                : `May propose: ${revision.proposalScope.join(", ")}`}{" "}
              · effective from {revision.effectiveFrom}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

function MandateForm({
  entry,
  heading,
  observedRevision,
}: {
  entry: AgentMandateEntry;
  heading: string;
  observedRevision: number | null;
}) {
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [purpose, setPurpose] = useState("");
  const [scope, setScope] = useState<readonly string[]>(MANDATE_SCOPE_VOCABULARY);
  const [justification, setJustification] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const purposeReady =
    purpose.trim().length >= MIN_MANDATE_PURPOSE_CHARACTERS &&
    purpose.trim().length <= MAX_MANDATE_PURPOSE_CHARACTERS;
  const ready = purposeReady && justification.trim().length >= JUSTIFICATION_MIN;
  const withdrawing = scope.length === 0;

  function toggle(kind: string) {
    setScope((current) =>
      current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind],
    );
  }

  function submit() {
    setRefusal(null);
    startTransition(async () => {
      const result = await establishAgentMandateAction({
        agentId: entry.identity.agentId,
        purpose,
        proposalScope: scope,
        justification,
        /*
         * THE REVISION THE READER WAS SHOWN — the concurrency token, never a value the reader
         * types. A ceiling revised by somebody else since this page loaded is refused, never
         * merged.
         */
        observedMandateRevision: observedRevision,
      });
      if (result.status === "established") {
        setConfirming(false);
        setPurpose("");
        setJustification("");
        setNotice(W.establishedNotice);
        router.refresh();
        return;
      }
      setNotice(null);
      setRefusal(REFUSAL_TEXT[result.reason] ?? FALLBACK_REFUSAL);
    });
  }

  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-medium text-fg">{heading}</p>

      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-purpose`} className="text-xs font-medium text-fg">
            What this agent is for
          </label>
          <p className="text-[0.65rem] leading-4 text-fg-muted">
            A sentence the organization stands behind. It is recorded verbatim and never repaired.
          </p>
          <textarea
            id={`${ids}-purpose`}
            rows={3}
            maxLength={MAX_MANDATE_PURPOSE_CHARACTERS}
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            className={FIELD}
          />
          <p className="text-[0.6rem] text-fg-muted">
            {purpose.trim().length} / {MAX_MANDATE_PURPOSE_CHARACTERS} · at least{" "}
            {MIN_MANDATE_PURPOSE_CHARACTERS}
          </p>
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className="text-xs font-medium text-fg">
            The most it may propose
          </legend>
          <p className="text-[0.65rem] leading-4 text-fg-muted">
            Only the action kinds an agent may originate are offered. Selecting none records a
            withdrawal: this agent may then propose nothing.
          </p>
          <div className="mt-1 flex flex-wrap gap-3">
            {MANDATE_SCOPE_VOCABULARY.map((kind) => (
              <label key={kind} className="flex items-center gap-2 text-xs text-fg">
                <input
                  type="checkbox"
                  checked={scope.includes(kind)}
                  onChange={() => toggle(kind)}
                />
                {kind}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-justification`} className="text-xs font-medium text-fg">
            Why you are recording this bound
          </label>
          <p className="text-[0.65rem] leading-4 text-fg-muted">
            Every Governance decision carries a reason, and this is one. It is kept permanently.
          </p>
          <textarea
            id={`${ids}-justification`}
            rows={2}
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            className={FIELD}
          />
        </div>

        {confirming ? (
          <div className="rounded-md border border-border bg-surface-sunken p-3">
            <p className="text-xs font-medium text-fg">
              {withdrawing
                ? "This records an EMPTY ceiling. From the moment it is written, this agent may propose nothing, and every proposal it originates is refused before anything is stored."
                : `This records a ceiling of: ${scope.join(", ")}.`}
            </p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-[0.7rem] leading-4 text-fg-secondary">
              {MANDATE_DOES_NOT_MEAN.map((claim) => (
                <li key={claim}>Not {claim}.</li>
              ))}
              <li>
                The previous revision is not edited or deleted — it stays readable exactly as it was
                authorized.
              </li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={submit} disabled={pending}>
                {withdrawing ? "Record withdrawal" : "Record mandate"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button size="sm" onClick={() => setConfirming(true)} disabled={!ready || pending}>
              Review what will be recorded
            </Button>
          </div>
        )}

        {refusal ? (
          <p className="rounded-md border border-border bg-surface-sunken p-2 text-xs leading-5 text-fg">
            {refusal}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-md border border-border bg-surface-sunken p-2 text-xs leading-5 text-fg">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EntryBody({ entry }: { entry: AgentMandateEntry }) {
  if (entry.standing.kind === "unavailable") {
    /*
     * AN OUTAGE, AND NEVER AN ABSENCE. No form is offered: a mandate cannot be responsibly recorded
     * against a ceiling nobody could read, because the writer's concurrency token would be a guess.
     */
    return (
      <StateBlock
        tone="empty"
        title={W.mandateUnavailableTitle}
        description={W.mandateUnavailableDetail}
      />
    );
  }

  const { effective, history } = entry.standing;
  const superseded = history.filter(
    (revision) => revision.mandateRevision !== effective?.mandateRevision,
  );

  if (!effective) {
    return (
      <div className="flex flex-col gap-3">
        <StateBlock tone="empty" title={W.absentTitle} description={W.absentDetail} />
        {entry.identity.inService ? (
          <MandateForm entry={entry} heading={W.establishHeading} observedRevision={null} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success">AUTHORITATIVE</Badge>
        <Badge variant="neutral">revision {effective.mandateRevision}</Badge>
      </div>
      <p className="text-sm leading-6 text-fg">{effective.purpose}</p>
      <ScopeList scope={effective.proposalScope} />
      <Provenance revision={effective} />
      <History revisions={superseded} />
      {entry.identity.inService ? (
        <MandateForm
          entry={entry}
          heading={W.reviseHeading}
          observedRevision={effective.mandateRevision}
        />
      ) : null}
    </div>
  );
}

export function AgentMandateCard({ block, entries = [] }: AgentMandateCardProps) {
  if (block) {
    const map = {
      unauthenticated: [W.unauthenticatedTitle, W.unauthenticatedDetail, "restricted"] as const,
      "identity-authority-unavailable": [
        W.authorityUnavailableTitle,
        W.authorityUnavailableDetail,
        "empty",
      ] as const,
      "no-durable-agent": [W.noAgentTitle, W.noAgentDetail, "empty"] as const,
    };
    const [title, description, tone] = map[block.kind];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldQuestion aria-hidden className="size-4" />
            {W.regionTitle}
          </CardTitle>
          <CardDescription>{W.regionDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock tone={tone} title={title} description={description} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText aria-hidden className="size-4" />
          {W.regionTitle}
        </CardTitle>
        <CardDescription>{W.regionDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {entries.map((entry) => (
          <section key={entry.identity.agentId} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-fg">{entry.identity.name}</h3>
              <Badge variant={entry.identity.inService ? "success" : "neutral"}>
                {entry.identity.inService ? "in service" : "retired"}
              </Badge>
            </div>
            <EntryBody entry={entry} />
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
