import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Operations — Hebun AI" };

/*
 * Legacy Task Planning — retired in Hebun UI Phase 22D.
 *
 * The task queue/dispatch here is seeded, in-memory, and not a live dispatcher, with no
 * authoritative surface of its own; Operations Overview honestly reports its state. A neutral
 * redirect to Overview is preferred over a false equivalence. No loop, no chain.
 */

export default function TaskPlanningPage(): never {
  permanentRedirect("/operations");
}
