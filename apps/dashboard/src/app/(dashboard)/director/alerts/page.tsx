import { redirect } from "next/navigation";

/*
 * Legacy /director/alerts — RETIRED (Hebun UI Phase 20D).
 *
 * Alerts were merged into the Command Inbox (Phase 20A decision D2): an alert is one attention
 * KIND on the unified Inbox surface, not a standalone authoritative destination. This mock-backed
 * page is superseded; the deep link redirects to the canonical Inbox. No mock is rendered.
 */

export default function AlertsRedirect() {
  redirect("/command/inbox");
}
