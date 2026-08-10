"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAuthEnvironment,
  resolveRequestAuthentication,
} from "@/features/auth-runtime/request-session.server";
import { createTenantRegistry } from "@/features/tenant-registry/tenant-registry-service.server";

/**
 * Tenant-aware server boundary for the R1 proof slice. The tenant is resolved
 * from the server-side session — the form never supplies a tenant id. Fails
 * closed to /login when the request is not authorized.
 */
export async function createFoundationRegistryAction(
  formData: FormData,
): Promise<void> {
  const env = getAuthEnvironment();
  if (env.status !== "configured") redirect("/login");
  const result = await resolveRequestAuthentication(env);
  if (result.status !== "authorized") redirect("/login");

  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");

  try {
    await createTenantRegistry(result.tenantContext, {
      slug,
      title,
      description: description || undefined,
    });
  } catch {
    // Do not fake success. On validation/persistence failure the list simply
    // reloads unchanged.
  }
  revalidatePath("/foundation");
}
