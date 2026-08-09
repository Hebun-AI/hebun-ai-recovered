import { redirect } from "next/navigation";

/*
 * Legacy /director/intelligence/learning ("Learning Center") — RETIRED (Hebun UI Phase 20D).
 *
 * `learning` is a runtime candidate kind, but a candidate kind does not justify a dedicated L2
 * surface — learning is surfaced through Candidates and, once validated, Insights. This obsolete,
 * mock-backed duplication is retired; the deep link redirects to the neutral Intelligence Overview.
 * No mock is rendered.
 */

export default function LearningRedirect() {
  redirect("/intelligence");
}
