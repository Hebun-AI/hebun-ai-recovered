import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Execution — Hebun AI" };

/*
 * Legacy Failures — retired in Hebun UI Phase 22D.
 *
 * Execution failures have no independent real authority; the authoritative execution surface
 * is Execution. This route permanently redirects there. No loop, no chain.
 */

export default function FailuresPage(): never {
  permanentRedirect("/director/execution-center");
}
