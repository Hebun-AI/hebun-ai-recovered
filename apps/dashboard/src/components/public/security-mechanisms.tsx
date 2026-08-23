import { SECURITY_MECHANISMS } from "@/features/public-claims/capability-claims";

/*
 * Security, as a list of named mechanisms.
 *
 * No adjective appears here and none may: "enterprise-grade", "military-grade", "zero-trust" and
 * "bank-level" describe a feeling rather than a system, and each is banned by the public claim
 * contract this list renders. What is published instead is what the code does — the algorithm, the
 * boundary, the thing that is not stored — so a reader can check it rather than believe it.
 *
 * Hebun holds no compliance certification, which the page states in its own sentence rather than
 * leaving to be assumed from the absence of a badge.
 */
export function SecurityMechanisms() {
  return (
    <dl className="flex flex-col">
      {SECURITY_MECHANISMS.map((mechanism) => (
        <div
          key={mechanism.field}
          className="grid grid-cols-1 gap-x-8 gap-y-1 border-t border-border py-5 first:border-t-2 first:border-t-fg sm:grid-cols-[11rem_minmax(0,1fr)]"
        >
          <dt className="font-mono text-label tracking-[0.08em] uppercase text-fg-muted">
            {mechanism.field}
          </dt>
          <dd className="max-w-[var(--measure-prose)] text-body leading-relaxed text-fg">
            {mechanism.statement}
          </dd>
        </div>
      ))}
    </dl>
  );
}
