import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Operations — Hebun AI" };

/*
 * Legacy Orchestration — retired in Hebun UI Phase 22D.
 *
 * Orchestration here is simulated (agents/mock) with no authoritative surface of its own;
 * Operations Overview honestly reports its state. A neutral redirect to Overview is preferred
 * over a false equivalence. No loop, no chain.
 */

export default function OrchestrationPage(): never {
  permanentRedirect("/operations");
}
