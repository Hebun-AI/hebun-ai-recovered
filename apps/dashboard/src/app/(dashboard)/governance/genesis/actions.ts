"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { acceptGenesisNomination } from "@/features/governance-genesis/genesis-acceptance.server";
import type { GenesisAcceptanceResult } from "@/features/governance-genesis/contracts";

/*
 * The G2.1 acceptance boundary — KEY 2 of the two-key genesis ceremony.
 *
 * IT TAKES NO ARGUMENTS. That is the security property, not an omission. The tenant, the user, the
 * identity, the session and the assurance level are all resolved server-side from the durable R1
 * session. A forged `tenantId`, `userId`, `authIdentityId`, `membershipId`, `roleId`,
 * `authorityRank`, `status`, `acceptedAt`, `bootstrap` or `decisionId` has no parameter to arrive
 * in — those attacks are UNREPRESENTABLE here rather than validated away somewhere downstream.
 *
 * There is deliberately NO nomination action in this file, or anywhere else the client can reach.
 * Creating a nomination is the local operator ceremony's job
 * (`npm run governance:nominate-genesis`), so a signed-in human — of any role band — cannot
 * nominate anybody, including themselves.
 *
 * It is a SEPARATE action from anything Heby can call: Heby's server actions do not import this
 * module, so no message, model answer, slash command, or voice transcript has a representation in
 * which it could reach genesis entitlement.
 */
export async function acceptGenesisNominationAction(): Promise<GenesisAcceptanceResult> {
  const tenant = await resolveTenantContext();
  const result = await acceptGenesisNomination(tenant);
  if (result.status === "accepted") revalidatePath("/governance/genesis");
  return result;
}
