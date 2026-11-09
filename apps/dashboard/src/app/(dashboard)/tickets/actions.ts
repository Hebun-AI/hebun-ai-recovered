"use server";

/*
 * V1-STAGE-5 — the support ticket boundary. Two writes: any member files a ticket for their own
 * organization; the Governance authority changes a ticket's status. Tenant and actor come from the
 * session only. Nothing is sent anywhere.
 */
import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { changeSupportTicketStatus, createSupportTicket } from "@/features/support-tickets/support-tickets.server";
import type { SupportTicketWrite } from "@/features/support-tickets/contracts";

export async function createSupportTicketAction(input: { readonly title: string; readonly description: string }): Promise<SupportTicketWrite> {
  const result = await createSupportTicket(await resolveTenantContext(), { title: input?.title, description: input?.description });
  if (result.status !== "refused") revalidatePath("/tickets");
  return result;
}

export async function changeSupportTicketStatusAction(input: {
  readonly ticketId: string;
  readonly status: string;
  readonly expectedVersion: number;
}): Promise<SupportTicketWrite> {
  const result = await changeSupportTicketStatus(await resolveTenantContext(), {
    ticketId: input?.ticketId,
    status: input?.status,
    expectedVersion: input?.expectedVersion,
  });
  if (result.status !== "refused") revalidatePath("/tickets");
  return result;
}
