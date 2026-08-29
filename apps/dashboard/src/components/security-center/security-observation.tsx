import type { SecurityCenterModel, SecurityRecordedAct } from "@/features/security-center";
import { SecurityRegion, SecurityEmptyState, SecurityStatusPill } from "./security-region";

/*
 * Recorded Governed Acts (E2-2 / S-B) — the first REAL connected evidence on this surface.
 *
 * It shows the most recent governed acts Hebun itself recorded for this tenant, read at request
 * time through the released `governance-activity` seam. Everything it renders is a fact the ledger
 * recorded; nothing is graded, scored, correlated or reinterpreted.
 *
 * ── THE THREE STATES ARE RENDERED APART ──────────────────────────────────────
 *
 * recorded     the ledger was read and holds acts — here is the bounded page and the real total.
 * known-empty  the ledger was READ SUCCESSFULLY and holds nothing for this organization.
 * unavailable  the ledger could not be read, and the honest reason is shown.
 *
 * Collapsing any two would be the defect this region exists to prevent. In particular an
 * unavailable read must never render as a calm empty state, because "nothing was recorded" is a
 * claim about the customer's organization and "Hebun could not look" is not.
 *
 *     KNOWN EMPTY != UNAVAILABLE
 *
 * ── AND EMPTY IS NOT REASSURING ──────────────────────────────────────────────
 *
 * Zero recorded acts says nothing about whether this organization is secure, and the empty state
 * says so rather than reading as an all-clear. No severity, risk, threat or incident language
 * appears anywhere here, because no authority for any of them exists.
 *
 *     ZERO RECORDED ACTS != SECURE      AUDIT RECORD != SECURITY EVENT
 */

function ActRow({ act }: { act: SecurityRecordedAct }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-lg border border-border bg-surface-sunken p-3">
      <time className="font-mono text-[0.65rem] text-fg-muted" dateTime={act.occurredAt}>
        {act.occurredAt}
      </time>
      <span className="truncate text-xs font-semibold text-fg" title={act.action}>
        {act.action}
      </span>
      <span className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.7rem] leading-5 text-fg-secondary">
        <span>
          <span className="text-fg-muted">entity </span>
          {act.entityType}
        </span>
        <span>
          <span className="text-fg-muted">actor </span>
          {act.actorType}
        </span>
        <span>
          <span className="text-fg-muted">result </span>
          {act.result}
        </span>
        <span>
          <span className="text-fg-muted">recorded by </span>
          {/* Null is REPORTED, never hidden and never replaced with a plausible value. */}
          {act.source ?? "not recorded"}
        </span>
        <span>
          <span className="text-fg-muted">authority </span>
          {act.authoritySource ?? "not recorded"}
        </span>
        {act.simulation && <SecurityStatusPill label="Simulated" />}
      </span>
    </li>
  );
}

export function SecurityObservation({ model, className }: { model: SecurityCenterModel; className?: string }) {
  const observation = model.recordedActObservation;

  /*
   * No observation was supplied by the composing surface. That is not an empty ledger and must not
   * render as one — it is a read that did not happen.
   */
  if (!observation) {
    return (
      <SecurityRegion className={className} eyebrow="Connected evidence" title="Recorded Governed Acts">
        <SecurityEmptyState
          title="No observation was read for this request"
          detail="The recorded-act ledger was not read here, so nothing about this organization's recorded activity is known on this page. That is not a statement that nothing was recorded."
        />
      </SecurityRegion>
    );
  }

  const total = observation.totalRecordedActs;
  return (
    <SecurityRegion
      className={className}
      eyebrow="Connected evidence"
      title="Recorded Governed Acts"
      action={<SecurityStatusPill label={observation.state === "unavailable" ? "Unavailable" : "Connected · derived"} tone={observation.state === "unavailable" ? "muted" : "accent"} />}
    >
      <div className="flex flex-col gap-3">
        {observation.state === "unavailable" && (
          <SecurityEmptyState
            title="The recorded-act ledger could not be read"
            detail={observation.unavailableReason ?? undefined}
            tone="restricted"
          />
        )}

        {observation.state === "known-empty" && (
          <SecurityEmptyState
            title="The ledger was read and holds no recorded acts for this organization"
            detail="This is an established fact about the ledger, not a read failure — and it is not an all-clear. A count of recorded acts indicates nothing about whether this organization is secure."
          />
        )}

        {observation.state === "recorded" && (
          <>
            <p className="text-[0.7rem] leading-5 text-fg-secondary">
              The {observation.acts.length} most recent recorded acts
              {typeof total === "number" && <> of {total} held for this organization</>}
              {observation.truncated && <> — the ledger holds more than this page shows</>}.
            </p>
            <ul className="flex flex-col gap-2">
              {observation.acts.map((act) => (
                <ActRow key={`${act.occurredAt}-${act.action}-${act.entityType}`} act={act} />
              ))}
            </ul>
          </>
        )}

        {/* Provenance and limits travel WITH the evidence, on the page, not in a comment. */}
        <div className="flex flex-col gap-1 border-t border-border pt-2.5">
          <p className="text-[0.7rem] leading-5 text-fg-muted">
            <span className="font-medium text-fg-secondary">Where this comes from: </span>
            {observation.provenance}
          </p>
          <p className="text-[0.7rem] leading-5 text-fg-muted">
            <span className="font-medium text-fg-secondary">What it does not show: </span>
            {observation.limits}
          </p>
          {observation.generatedAt && (
            <p className="text-[0.7rem] leading-5 text-fg-muted">
              {/* Request-time, and said so. There is no stream and no continuous monitoring here. */}
              <span className="font-medium text-fg-secondary">Read at: </span>
              {observation.generatedAt} — a read taken for this request, not a live stream.
            </p>
          )}
        </div>
      </div>
    </SecurityRegion>
  );
}
