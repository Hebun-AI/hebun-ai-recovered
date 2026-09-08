/*
 * standing-observation-authority/observation-read-control.server.ts — the durable Director ON/OFF
 * authority for MACHINE-PRINCIPAL PROVIDER READS (TRH-25 prerequisite).
 *
 * ── A ROW, NOT A TABLE ───────────────────────────────────────────────────────
 *
 * R3B's decision, applied unchanged to a third permission. `provider_connectivity_controls` is
 * already keyed by a control key with a unique constraint, already has a durable Director-owned
 * writer under deployment possession, and already fails closed on a missing row, a missing
 * database or any read error. Building a second kill-switch table would create two places that
 * answer "may Hebun reach the outside" — and the failure mode of two switches is that somebody
 * flips the wrong one and believes the system is off.
 *
 * ── WHY NOT THE `claude` ROW, AND WHY NOT `external-send` ───────────────────
 *
 * Different permissions with different blast radii get different rows; that is the whole reason
 * `external-send` did not reuse `claude`. Model generation spends money on inference. Outbound
 * sending puts real messages in front of real people. A machine-principal provider READ does
 * neither: it spends provider quota and changes nothing outside Hebun. Three permissions, three
 * rows, and nothing here reads, writes or touches the other two.
 *
 * ── WHAT THIS SWITCH MEANS, AND THE ONE THING IT MUST NEVER MEAN ────────────
 *
 * ENABLED means only: "Hebun is not currently forbidden to perform authorized provider reads."
 * It is not permission to read. Permission comes from a Governance decision and the standing
 * authorization it wrote, and this switch cannot create, widen, revive or lengthen one.
 *
 *     A SWITCH MAY REMOVE PERMISSION THE ORGANIZATION GRANTED.
 *     IT MAY NEVER CREATE PERMISSION THE ORGANIZATION DID NOT GRANT.
 *
 * So an enabled switch with no active authorization observes nothing, and a disabled switch
 * refuses a perfectly valid authorization without altering it. The authorization is untouched by
 * either state — withdrawal remains a Governance act, and this remains an operational one.
 *
 * ── IT STOPS EVERY MACHINE READ, INCLUDING THE MANUAL CEREMONY ──────────────
 *
 * Deliberately not "unattended reads only". A kill switch a human can walk around is not an
 * emergency stop, and the operator reaching for it during an incident is exactly the person who
 * would otherwise be told the ceremony is exempt. TRH-21's HUMAN-sourced observation path is
 * untouched and does not consult this switch: it never mints a principal, never revalidates, and
 * a human at a terminal is already their own kill switch.
 *
 * ── GLOBAL, AND HONESTLY SO ──────────────────────────────────────────────────
 *
 * The row has no tenant column. One switch, every tenant, every provider, every observable
 * capability. That is coherent for generation one and wrong for a customer product — pausing one
 * tenant's observation pauses everyone's — and it is recorded here as a limitation rather than
 * hidden behind a per-tenant shape this table cannot honour. The per-authorization stop already
 * exists and is Governance's: withdraw the authorization.
 *
 * ── FAIL CLOSED, WHICH IS WHY IT STARTS OFF ─────────────────────────────────
 *
 * `resolveDirectorEnabled` treats an absent row, an unconfigured database and any read error as
 * DISABLED. No row exists in any deployment until an operator writes one, so machine observation
 * is refused until the Director arms it — including in production, where TRH-24's accepted
 * capability stops working the moment this ships and starts working again the moment the ceremony
 * runs. That direction is the correct one and it is stated rather than smoothed over.
 *
 * ── NO WRITER, HERE OR ANYWHERE UNDER `src/` ────────────────────────────────
 *
 * There is no setter in this module and none anywhere in the application, exactly as R5.1 left the
 * other two keys. The switch is changed only by `npm run provider:connectivity`, under deployment
 * possession. An ObservationPrincipal, a future trigger and the provider subsystem therefore cannot
 * enable their own path — not because each is checked, but because the capability to write this row
 * does not exist in the code they can reach.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import {
  createProviderConnectivityControlRepository,
  resolveDirectorEnabled,
  type ProviderConnectivityControlRepository,
} from "@/features/heby-provider-ops/provider-connectivity-control.server";
import { OBSERVATION_READ_CONTROL_KEY } from "./contracts";

/**
 * Re-exported so the revalidator names this authority through the module that owns the meaning,
 * rather than reaching into the model-connectivity feature for a type.
 */
export type { ProviderConnectivityControlRepository };

export interface ObservationReadControlDeps {
  /** Injectable for tests. `null` means "no durable authority", which fails closed. */
  readonly repo?: ProviderConnectivityControlRepository | null;
  /**
   * THE SAME CONTROL PLANE THE REST OF THE REVALIDATION READS.
   *
   * Not a convenience. The process-level repository resolves its own handle from the ambient
   * environment, so a caller revalidating against one database would have had its kill switch
   * answered by another — and a switch read from a database nobody is observing through is not a
   * switch. When a handle is supplied it is used, and a supplied handle that yields nothing FAILS
   * CLOSED rather than falling back to the ambient one.
   */
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/**
 * The fail-closed machine-provider-read kill-switch read.
 *
 * Called from the authoritative last-moment revalidation and nowhere else, so that a disabled
 * switch is obeyed by every machine-principal caller that exists or will exist, rather than by
 * every caller that remembered to ask.
 */
export async function resolveObservationReadEnabled(
  deps: ObservationReadControlDeps = {},
): Promise<boolean> {
  /* An explicitly injected repository wins, `null` included — that is how "unreadable" is proved. */
  if (deps.repo !== undefined) {
    return resolveDirectorEnabled(OBSERVATION_READ_CONTROL_KEY, { repo: deps.repo });
  }

  if (deps.getDb) {
    const db = deps.getDb();
    /* A caller that named a control plane and got none is refused, never quietly redirected. */
    if (!db) return false;
    return resolveDirectorEnabled(OBSERVATION_READ_CONTROL_KEY, {
      repo: createProviderConnectivityControlRepository(db),
    });
  }

  return resolveDirectorEnabled(OBSERVATION_READ_CONTROL_KEY);
}
