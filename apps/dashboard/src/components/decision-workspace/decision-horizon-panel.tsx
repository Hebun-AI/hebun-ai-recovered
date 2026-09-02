/*
 * The Decision Horizon — everything awaiting a human decision, as a product surface (DH-1).
 *
 * THIS COMPONENT HOLDS NO AUTHORITY AND PERFORMS NO READ. It receives what the page already read on
 * the server, imports TYPES only, and offers NO control: every decision here is taken on the
 * authority's own surface, and this panel says which one for each item rather than pretending it
 * could take any of them.
 *
 *     COMPOSED != OWNED.      GATHERED != DECIDED.
 *
 * ── WHY IT SITS ABOVE THE ACTION QUEUE ───────────────────────────────────────
 *
 * `/approvals` already renders the action-authorization queue in full, with its controls. This
 * panel exists because that queue is ONE OF THREE sources, and a Director reading a full-looking
 * queue had no way to learn that hypotheses and Knowledge versions were also waiting somewhere
 * else. So the horizon states the whole shape first, and the queue below it remains the place the
 * action decisions are actually made.
 *
 * ── THE SENTENCE THIS PANEL EXISTS TO PROTECT ───────────────────────────────
 *
 * "Nothing is awaiting a decision" is rendered ONLY when the horizon says `complete` and no source
 * produced an item. A partial horizon renders what it has AND names the authority that could not
 * answer — never a shorter list with no explanation.
 */
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StateBlock } from "@/components/ui/state-block";
import {
  DECISION_SOURCE_OWNERS,
  HORIZON_EMPTY_STATEMENT,
  horizonPartialStatement,
} from "@/features/decision-horizon/contracts";
import type { DecisionHorizon } from "@/features/decision-horizon/read-decision-horizon.server";

export interface DecisionHorizonPanelProps {
  readonly horizon: DecisionHorizon;
}

export function DecisionHorizonPanel({ horizon }: DecisionHorizonPanelProps) {
  if (horizon.status !== "read") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>What needs your decision</CardTitle>
        </CardHeader>
        <CardContent>
          <StateBlock
            tone="unavailable"
            title="The horizon could not be read"
            description="No organization is resolved for this session, so no source could be asked. Nothing here says whether anything is waiting."
          />
        </CardContent>
      </Card>
    );
  }

  const unavailableNames = horizon.unavailableSources.map(
    (source) => DECISION_SOURCE_OWNERS[source].authority,
  );
  const complete = horizon.completeness === "complete";
  const nothingWaiting = complete && horizon.answeredTotal === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>What needs your decision</CardTitle>
        <CardDescription>
          Every authority in Hebun that records something as awaiting a human decision, gathered in
          one place. This is a composition, not an owner: each item belongs to the authority that
          recorded it, and each decision is taken on that authority&rsquo;s own surface. These are
          different kinds of decision — they are never ranked against each other, and Hebun holds no
          priority, urgency or deadline for any of them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/*
          * THE COMPLETENESS VERDICT COMES FIRST, because it changes the meaning of everything
          * below it. A partial horizon that looked complete is the one failure this panel exists
          * to prevent.
          */}
        {!complete ? (
          <StateBlock
            tone="unavailable"
            title="This horizon is incomplete"
            description={horizonPartialStatement(unavailableNames)}
          />
        ) : null}

        {nothingWaiting ? (
          <p className="text-sm leading-6 text-fg-secondary">{HORIZON_EMPTY_STATEMENT}</p>
        ) : null}

        <ul className="space-y-3">
          {horizon.blocks.map((block) => {
            const owner = DECISION_SOURCE_OWNERS[block.source];
            return (
              <li key={block.source} className="rounded-md border border-border px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-medium text-fg">{owner.authority}</span>
                  {block.status === "answered" ? (
                    <span className="text-xs tabular-nums text-fg-secondary">
                      {block.total} awaiting
                    </span>
                  ) : (
                    <span className="text-xs text-fg-secondary">could not be read</span>
                  )}
                </div>

                {block.status !== "answered" ? (
                  <p className="mt-1 text-xs leading-5 text-fg-secondary">
                    Hebun could not read {owner.subject} ({block.reason}). This does not say the
                    source holds nothing — only that it could not be asked.
                  </p>
                ) : (
                  <>
                    {block.total === 0 ? (
                      <p className="mt-1 text-xs leading-5 text-fg-secondary">
                        This authority answered, and it has nothing awaiting a decision.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {block.items.map((item) => (
                          <li key={item.recordId} className="text-xs leading-5 text-fg-secondary">
                            <span className="text-fg">{item.label}</span>{" "}
                            <span className="font-mono text-fg-muted">{item.recordId}</span>
                            {item.recordedAt ? (
                              <span className="text-fg-muted"> · recorded {item.recordedAt}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {block.truncated ? (
                      <p className="mt-1 text-xs leading-5 text-fg-secondary">
                        PARTIAL, NOT COMPLETE: this authority holds {block.total} awaiting a
                        decision and more than are listed here.
                      </p>
                    ) : null}
                  </>
                )}

                {/*
                  * WHERE THE DECISION IS ACTUALLY TAKEN. For the action-authorization source that
                  * is THIS page — the queue directly below — so saying "go to /approvals" from a
                  * panel already on /approvals would send a reader in a circle. The other two are
                  * elsewhere and are linked.
                  */}
                <p className="mt-1 text-xs leading-5 text-fg-muted">
                  {block.source === "action-requests" ? (
                    <>Decided in the authorization queue below on this page, never in this panel.</>
                  ) : (
                    <>
                      Decided at{" "}
                      <Link href={owner.route} className="underline underline-offset-2">
                        {owner.route}
                      </Link>
                      , never here.
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
