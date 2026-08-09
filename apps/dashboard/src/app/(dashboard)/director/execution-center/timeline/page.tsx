import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Execution — Hebun AI" };

/*
 * Legacy Execution Timeline — retired in Hebun UI Phase 22D.
 *
 * An execution timeline has no independent real authority; the authoritative execution
 * surface is Execution. This route permanently redirects there. No loop (the target is a
 * distinct real page), no chain.
 */

export default function ExecutionTimelinePage(): never {
  permanentRedirect("/director/execution-center");
}
