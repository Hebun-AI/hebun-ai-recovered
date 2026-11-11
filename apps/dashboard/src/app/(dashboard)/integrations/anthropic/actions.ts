"use server";

/*
 * P5 BYOK slice 1. The tenant comes from the session only; the form contributes exactly one field,
 * `apiKey`, which is handed to the released credential store and never echoed, logged or redirected.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { revokeByokKey, saveByokKey } from "@/features/provider-anthropic/byok-key.server";

const PAGE = "/integrations/anthropic";

export async function saveAnthropicKeyAction(formData: FormData): Promise<void> {
  const tenant = await resolveTenantContext();
  if (!tenant) redirect("/login");
  const value = formData.get("apiKey");
  const outcome = await saveByokKey(tenant, typeof value === "string" ? value.trim() : "");
  revalidatePath(PAGE);
  redirect(`${PAGE}?outcome=${outcome}`);
}

export async function revokeAnthropicKeyAction(): Promise<void> {
  const tenant = await resolveTenantContext();
  if (!tenant) redirect("/login");
  const outcome = await revokeByokKey(tenant);
  revalidatePath(PAGE);
  redirect(`${PAGE}?outcome=${outcome}`);
}
