"use server";

/*
 * V1-STAGE-4 — the profile boundary. One write: the session user's own display name. Everything
 * else on /account is read. Membership, roles and invitations stay on /governance/authority.
 */
import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { updateOwnDisplayName } from "@/features/account-profile/account-profile.server";
import type { DisplayNameUpdate } from "@/features/account-profile/contracts";

export async function updateOwnDisplayNameAction(input: { readonly displayName: string; readonly expectedVersion: number }): Promise<DisplayNameUpdate> {
  const result = await updateOwnDisplayName(await resolveTenantContext(), {
    displayName: input?.displayName,
    expectedVersion: input?.expectedVersion,
  });
  if (result.status === "updated") revalidatePath("/", "layout");
  return result;
}
