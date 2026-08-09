import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Operations — Hebun AI" };

/*
 * Legacy Events — retired in Hebun UI Phase 22D.
 *
 * Events here were a derived, non-authoritative projection with no connected source. An event is
 * not a signal, so a redirect to Runtime & Signals would be a false equivalence; a neutral
 * redirect to Operations Overview is preferred. No loop, no chain.
 */

export default function EventsPage(): never {
  permanentRedirect("/operations");
}
