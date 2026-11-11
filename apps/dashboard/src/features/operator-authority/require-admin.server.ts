/**
 * The admin guard for pages and reads (P4 D6). Call it in the `/admin` layout AND in every admin page
 * or data read — defence in depth, re-evaluated per call from the database.
 *
 *   unauthenticated → /login        no grant → 404 (admin is not advertised)
 *   grant without a valid MFA (missing, expired, credential changed) → /admin/verify
 */
import { notFound, redirect } from "next/navigation";
import { resolveAdminAccessForRequest } from "@/features/operator-authority/admin-request.server";
import type { AdminOperator } from "./admin-access.server";

export async function requireAdminAccess(): Promise<AdminOperator> {
  const access = await resolveAdminAccessForRequest();
  if (access.status === "granted") return access.operator;
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "forbidden") notFound();
  redirect("/admin/verify");
}
