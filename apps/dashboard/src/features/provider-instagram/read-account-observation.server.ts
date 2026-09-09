/*
 * provider-instagram/read-account-observation.server.ts — ONE authorized Instagram account read.
 *
 * The body the observation path runs. It performs exactly one provider request, timestamps the read
 * with Hebun's clock — Instagram does not timestamp it — and returns what Instagram said.
 *
 * IT TOUCHES NO TABLE. A released firewall asserts that every file under a provider module writes
 * nothing, and this module keeps that: it has no database import and no writer. Persistence belongs
 * to Provider Observation History, which owns the sentence "the provider reported this".
 *
 * Server-only.
 */
import {
  type InstagramAccountObservation,
  type InstagramResult,
} from "./contracts";
import { readAccount, type InstagramTransportDeps } from "./instagram-transport.server";

export interface ReadAccountObservationDeps extends InstagramTransportDeps {
  /** Injectable so an observation's instant is provable. Never reaches a provider request. */
  readonly now?: () => Date;
}

/**
 * Observe one Instagram professional account by its provider-issued id.
 *
 * ONE REQUEST. There is no follower-history call, no media page and no insights lookup — this phase
 * declares one capability and spends exactly one quota unit of attention on it.
 */
export async function observeAccountById(
  accessToken: string,
  accountId: string,
  deps: ReadAccountObservationDeps = {},
): Promise<InstagramResult<InstagramAccountObservation>> {
  const account = await readAccount(accessToken, accountId, deps);
  if (!account.ok) return account;

  return {
    ok: true,
    value: {
      account: account.value,
      observedAt: (deps.now ?? (() => new Date()))().toISOString(),
    },
  };
}
