"use client";

/*
 * AGENT-ID-0.1 — the durable agent identity ceremony surface.
 *
 * ── IT IS THE ONLY CONTROL ON THIS PAGE THAT WRITES A DATABASE ROW ───────────
 *
 * Everything else under /agents is the seeded, in-memory Agent Registry simulation. That surface now
 * names itself at every control it offers, so a reader is never choosing between two things that
 * both look like "create a real agent". This card is the durable one, and it says so.
 *
 * ── THE CONSEQUENCE IS STATED BEFORE THE ACTION, NOT AFTER ───────────────────
 *
 * Establishing a durable agent identity is a ONE-WAY DOOR: it may happen once per organization, and
 * retiring the result does not reopen it. So this form deliberately does not behave like a text box:
 *
 *   - nothing autosaves, and nothing saves on blur;
 *   - the primary action is a two-step confirmation, and the first step only REVEALS what will be
 *     written, what will deliberately stay empty, and what the ceremony does NOT grant;
 *   - the final button says "Establish durable identity", never "Save", "Create" or "OK";
 *   - retirement is confirmed separately, and its confirmation states that retirement is terminal
 *     and that it does not return the organization to "no agent has ever existed".
 *
 * ── IT CLAIMS NOTHING IT CANNOT SUPPORT ──────────────────────────────────────
 *
 * No health, no status light, no capability, no readiness score. An identity that has been created
 * is shown as an identity that has been created — the ladder beside it says plainly that it cannot
 * authenticate, cannot authorize, has no runtime and executes nothing.
 *
 * The tenant and the human are resolved SERVER-SIDE. This component sends a name, or an id.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ShieldOff } from "lucide-react";
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
import {
  createDurableAgentIdentityAction,
  retireDurableAgentIdentityAction,
} from "@/app/(dashboard)/agents/actions";
import {
  AGENT_CAPABILITY_LADDER,
  GENESIS_DISCLOSURE,
  PERSISTED_IDENTITY_FIELDS,
  RETIREMENT_AUTHORITY_SUMMARY,
  WITHHELD_IDENTITY_FIELDS,
} from "@/features/agent-identity/ceremony-disclosure";
import { MAX_AGENT_NAME_LENGTH } from "@/features/agent-identity/contracts";
import type { DurableAgentIdentityRecord } from "@/features/agent-identity/read-durable-agent-identity.server";
import type { AgentIdentityRefusal } from "@/features/agent-identity/contracts";
import type { AgentRetirementRefusal } from "@/features/agent-identity/retirement-contracts";

/** Why the ceremony is not available, when it is not. Each states the real reason. */
export type DurableIdentityBlock =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "authority-unavailable" };

export interface DurableAgentIdentityCardProps {
  readonly block?: DurableIdentityBlock;
  /** The authenticated human, from the resolved server context. Never client-supplied. */
  readonly actingHumanId?: string;
  /** The organization, from the resolved server context. Never client-supplied. */
  readonly tenantId?: string;
  readonly genesisSpent?: boolean;
  readonly identities?: readonly DurableAgentIdentityRecord[];
}

const FIELD_STYLE =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/* Refusal reasons rendered as sentences. The REASON CODE is the product truth; this is its prose. */
const CREATE_REFUSAL_TEXT: Record<AgentIdentityRefusal, string> = {
  "no-authorized-tenant-context":
    "No authenticated organization and human could be resolved for this request. Nothing was written.",
  "malformed-agent-name": `The name must be 1–${MAX_AGENT_NAME_LENGTH} characters with no leading or trailing spaces. It is never trimmed for you, because a repaired name is a different name.`,
  "authority-unavailable":
    "The control-plane database could not be reached. The ceremony failed closed — nothing was written, and nothing was simulated.",
  "human-owner-unresolved":
    "The human in your session is not a live record, so ownership could not be established truthfully.",
  "agent-identity-already-exists":
    "This organization already holds a durable agent identity. The ceremony is a one-shot, and a retired identity still counts.",
};

const RETIRE_REFUSAL_TEXT: Record<AgentRetirementRefusal, string> = {
  "no-authorized-tenant-context":
    "No authenticated organization and human could be resolved for this request. Nothing was changed.",
  "malformed-agent-id": "That is not a valid identity reference. Nothing was changed.",
  "authority-unavailable":
    "The control-plane database could not be reached. Nothing was changed.",
  "agent-identity-not-found":
    "No such identity exists in this organization. Nothing was changed.",
  "not-the-human-owner":
    "Only the human who owns this identity may retire it, and that is not you.",
  "agent-identity-already-retired":
    "This identity was already withdrawn from service. Retirement is terminal, so nothing was changed.",
};

function Ladder() {
  return (
    <div className="flex flex-col gap-1.5">
      {AGENT_CAPABILITY_LADDER.map((step) => (
        <div key={step.rung} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Badge variant={step.reached ? "success" : "neutral"}>
            {step.reached ? step.rung : `NOT ${step.rung}`}
          </Badge>
          <span className="text-xs leading-5 text-fg-muted">{step.detail}</span>
        </div>
      ))}
    </div>
  );
}

export function DurableAgentIdentityCard({
  block,
  actingHumanId,
  tenantId,
  genesisSpent = false,
  identities = [],
}: DurableAgentIdentityCardProps) {
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [retiring, setRetiring] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  if (block) {
    /*
     * The two reasons are DIFFERENT FACTS and lead to different actions — one is answered by signing
     * in, the other by configuring the control plane. Neither implies that this organization holds
     * no agent identity: an unauthenticated reader is told nothing whatever about what exists.
     */
    return (
      <StateBlock
        tone={block.kind === "authority-unavailable" ? "unavailable" : "restricted"}
        title="Durable agent identity"
        description={
          block.kind === "unauthenticated"
            ? "Sign in to see or establish this organization's durable agent identity."
            : "The control-plane database could not be reached, so this organization's durable agent identity state is unknown. This is not a statement that none exists."
        }
      />
    );
  }

  function establish() {
    setRefusal(null);
    startTransition(async () => {
      const result = await createDurableAgentIdentityAction({ name });
      if (result.status === "established") {
        setConfirming(false);
        setName("");
        setOutcome(
          `Durable identity established: ${result.identity.name}. It holds no credential, no session, no permission and no runtime.`,
        );
        router.refresh();
        return;
      }
      setRefusal(CREATE_REFUSAL_TEXT[result.reason]);
    });
  }

  function retire(agentId: string) {
    setRefusal(null);
    startTransition(async () => {
      const result = await retireDurableAgentIdentityAction({ agentId });
      if (result.status === "retired") {
        setRetiring(null);
        setOutcome(
          `${result.retirement.name} was withdrawn from service. Nothing was deleted, and the creation ceremony stays closed.`,
        );
        router.refresh();
        return;
      }
      setRefusal(RETIRE_REFUSAL_TEXT[result.reason]);
    });
  }

  const inService = identities.filter((identity) => identity.inService);

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Durable agent identity</CardTitle>
          <CardDescription>
            The only control on this page that writes to the canonical database. One per organization,
            owned by a human, forever.
          </CardDescription>
        </div>
        <Badge variant="primary">canonical database</Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* ── WHO IS ACTING, AND FOR WHOM ─────────────────────────────────── */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border bg-surface-sunken p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
              Authenticated human
            </p>
            <p className="mt-1 break-all font-mono text-xs text-fg">{actingHumanId ?? "—"}</p>
          </div>
          <div className="rounded-md border bg-surface-sunken p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
              Organization
            </p>
            <p className="mt-1 break-all font-mono text-xs text-fg">{tenantId ?? "—"}</p>
          </div>
        </div>

        {/* ── WHAT EXISTS TODAY ───────────────────────────────────────────── */}
        {identities.length === 0 ? (
          <StateBlock
            tone="empty"
            title="No durable agent identity yet"
            description="This organization has not crossed the genesis boundary. The ceremony below is available exactly once."
          />
        ) : (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-fg">This organization&rsquo;s identities</h3>
            {identities.map((identity) => {
              const owned = identity.humanOwnerId === actingHumanId;
              return (
                <div
                  key={identity.agentId}
                  className="flex flex-col gap-2 rounded-md border bg-surface-sunken p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-fg">{identity.name}</span>
                    <Badge variant={identity.inService ? "success" : "neutral"}>
                      {identity.inService ? "in service" : "retired"}
                    </Badge>
                    {owned ? <Badge variant="info">you own this</Badge> : null}
                  </div>
                  <p className="break-all font-mono text-[11px] text-fg-muted">{identity.agentId}</p>
                  <p className="text-xs leading-5 text-fg-muted">
                    Created {identity.createdAt}
                    {identity.retiredAt ? ` · retired ${identity.retiredAt}` : ""}
                  </p>

                  {identity.inService ? (
                    retiring === identity.agentId ? (
                      <div className="flex flex-col gap-2 rounded-md border border-warning bg-warning-subtle p-3">
                        <p className="text-xs font-semibold text-fg">
                          Retire {identity.name}?
                        </p>
                        <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-5 text-fg-secondary">
                          <li>{GENESIS_DISCLOSURE.retirementIsNotDeletion}</li>
                          <li>{GENESIS_DISCLOSURE.retirementDoesNotReopen}</li>
                          <li>{GENESIS_DISCLOSURE.retirementIsTerminal}</li>
                          <li>{GENESIS_DISCLOSURE.noSuccession}</li>
                        </ul>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={pending}
                            onClick={() => retire(identity.agentId)}
                          >
                            <ShieldOff className="size-4" />
                            Withdraw from service
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => setRetiring(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending || !owned}
                          onClick={() => setRetiring(identity.agentId)}
                        >
                          Retire this identity
                        </Button>
                        {owned ? null : (
                          <p className="text-xs text-fg-muted">{RETIREMENT_AUTHORITY_SUMMARY}</p>
                        )}
                      </div>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {/* ── THE CEREMONY ────────────────────────────────────────────────── */}
        {genesisSpent ? (
          <StateBlock
            tone="restricted"
            title="The creation ceremony is closed"
            description={`${GENESIS_DISCLOSURE.genesisIsOneShot} ${GENESIS_DISCLOSURE.retirementDoesNotReopen}`}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <label
                htmlFor={`${ids}-name`}
                className="text-xs font-medium uppercase tracking-wider text-fg-muted"
              >
                Agent name
              </label>
              <input
                id={`${ids}-name`}
                className={FIELD_STYLE}
                value={name}
                maxLength={MAX_AGENT_NAME_LENGTH}
                placeholder="e.g. Atlas"
                disabled={pending || confirming}
                onChange={(event) => {
                  setName(event.target.value);
                  setRefusal(null);
                }}
              />
              <p className="text-xs text-fg-muted">
                Stored exactly as typed. Never trimmed, folded or repaired.
              </p>
            </div>

            {confirming ? (
              <div className="flex flex-col gap-3 rounded-md border border-primary bg-primary-subtle p-3">
                <p className="text-sm font-semibold text-fg">
                  Establish a durable identity named &ldquo;{name}&rdquo;?
                </p>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
                    What will be written
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs leading-5 text-fg-secondary">
                    {PERSISTED_IDENTITY_FIELDS.map((field) => (
                      <li key={field.column}>
                        <code className="font-mono text-[11px]">{field.column}</code> — {field.meaning}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
                    What will deliberately stay empty
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs leading-5 text-fg-secondary">
                    {WITHHELD_IDENTITY_FIELDS.map((field) => (
                      <li key={field.column}>
                        <code className="font-mono text-[11px]">{field.column}</code> — {field.meaning}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
                    What this does NOT grant
                  </p>
                  <div className="mt-1">
                    <Ladder />
                  </div>
                </div>

                <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-5 text-fg-secondary">
                  <li>{GENESIS_DISCLOSURE.genesisIsOneShot}</li>
                  <li>{GENESIS_DISCLOSURE.retirementIsNotDeletion}</li>
                  <li>{GENESIS_DISCLOSURE.retirementDoesNotReopen}</li>
                </ul>

                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" disabled={pending} onClick={establish}>
                    <BadgeCheck className="size-4" />
                    Establish durable identity
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={pending || name.length === 0}
                  onClick={() => {
                    setRefusal(null);
                    setConfirming(true);
                  }}
                >
                  Review this one-time ceremony
                </Button>
              </div>
            )}
          </div>
        )}

        {refusal ? (
          <StateBlock tone="error" title="Refused" description={refusal} />
        ) : null}
        {outcome ? (
          <p className="rounded-md border border-success bg-success-subtle p-3 text-xs leading-5 text-fg">
            {outcome}
          </p>
        ) : null}

        {/* ── THE LADDER, ALWAYS VISIBLE ──────────────────────────────────── */}
        <div className="flex flex-col gap-2 border-t pt-4">
          <h3 className="text-sm font-semibold text-fg">
            An identity is not an agent that works
          </h3>
          <Ladder />
          {inService.length > 0 ? (
            <p className="text-xs leading-5 text-fg-muted">
              {inService.length === 1 ? "This identity holds" : "These identities hold"} no credential
              and no session, so {inService.length === 1 ? "it" : "they"} cannot authenticate,
              cannot be authorized, and cannot execute anything.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
