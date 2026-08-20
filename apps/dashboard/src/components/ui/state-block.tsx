import { AlertTriangle, CircleSlash, Inbox, Loader, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * state-block.tsx — Stage 0. The ONE way a Hebun surface renders "there is nothing to show here",
 * and the one place the difference between the reasons is drawn.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * Absence is Hebun's most common visual state. The Organizational Intelligence Runtime is
 * contract-only, the Executive Overview is unavailable to every real tenant, and a new tenant holds
 * no Knowledge — so most of the product, most of the time, is telling a reader that something is
 * not there. Before this file that was improvised in more than fifty components, each choosing its
 * own border, icon, wording and weight, while the shared `EmptyState` had six consumers and
 * `ErrorState` / `LoadingState` had none at all.
 *
 * ── WHAT IT REFUSES TO DO ────────────────────────────────────────────────────
 *
 * It does not rename a single runtime state. `empty`, `unavailable`, `restricted`, `error` and the
 * in-flight case already exist across `src/features` as distinct result unions with distinct
 * meanings; this is a PRESENTATION layer keyed to them. Nothing here decides what state a read is
 * in, and nothing here may collapse two of them into one rendering:
 *
 *   empty        the read SUCCEEDED and there is nothing. A fact about the organization.
 *   unavailable  the read did NOT succeed. NOT a count, and never rendered as "none".
 *   restricted   data may well exist; this viewer's authority does not extend to it.
 *                Never implies absence.
 *   error        an operation failed. Announced to assistive technology.
 *   loading      in flight. Announced politely; it is not an outcome.
 *
 * The distinction is carried by ICON + EYEBROW WORD + BORDER TREATMENT, never by colour alone, so
 * it survives greyscale, colour-blindness and a screen reader.
 *
 * ── ITS RELATIONSHIP TO `EmptyState` ─────────────────────────────────────────
 *
 * `ui/empty-state.tsx` is the released predecessor and is left EXACTLY as it is. It has six
 * consumers on released surfaces, and it cannot express a tone without changing what those six
 * render: it draws an icon and an eyebrow only when the caller supplies them, and it is built on
 * `text-base`/`text-sm` rather than the Stage 0 scale. Rewriting it to carry a tone would have
 * meant a presentation change on six surfaces this phase was not asked to touch, so it was not
 * rewritten. This is the primitive canonical surfaces use from here on; `EmptyState` is what the
 * rest of the product still uses until each surface is taken deliberately.
 *
 * `ErrorState` and `LoadingState` are likewise untouched. They have zero consumers, and deleting or
 * re-pointing them is a cleanup this phase did not authorize.
 */

export type StateTone = "empty" | "unavailable" | "restricted" | "error" | "loading";

interface ToneSpec {
  /** The single word that names the reason. Never a synonym of another tone's word. */
  readonly eyebrow: string;
  readonly container: string;
  readonly badge: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly role?: "alert" | "status";
  readonly ariaLive?: "polite";
}

const TONES: Readonly<Record<StateTone, ToneSpec>> = Object.freeze({
  /* Dashed + neutral: the released EmptyState treatment, unchanged. */
  empty: {
    eyebrow: "Empty",
    container: "border-dashed border-border-strong bg-surface-sunken",
    badge: "bg-primary-subtle text-primary",
    icon: Inbox,
  },
  /* Solid + struck-through mark: a read that did not answer looks nothing like an answer of none. */
  unavailable: {
    eyebrow: "Unavailable",
    container: "border-solid border-border-strong bg-surface-sunken",
    badge: "bg-surface-raised text-fg-muted",
    icon: CircleSlash,
  },
  /* Solid + lock: the boundary is the viewer's authority, not the data's existence. */
  restricted: {
    eyebrow: "Restricted",
    container: "border-solid border-border-strong bg-surface-raised",
    badge: "bg-warning-subtle text-warning",
    icon: Lock,
  },
  error: {
    eyebrow: "Error",
    container: "border-solid border-error/30 bg-error-subtle",
    badge: "bg-error-subtle text-error",
    icon: AlertTriangle,
    role: "alert",
  },
  loading: {
    eyebrow: "Loading",
    container: "border-solid border-border bg-surface",
    badge: "bg-primary-subtle text-primary",
    icon: Loader,
    role: "status",
    ariaLive: "polite",
  },
});

export interface StateBlockProps extends Omit<React.ComponentProps<"div">, "title"> {
  readonly tone?: StateTone;
  readonly title: string;
  readonly description: string;
  readonly action?: React.ReactNode;
  /** Overrides the tone's own word. Supplied by released consumers; defaults to the tone. */
  readonly eyebrow?: string;
  /** Overrides the tone's mark. Supplied by released consumers. */
  readonly icon?: React.ReactNode;
  /** Renders without the eyebrow row. Used where the surrounding card already names the reason. */
  readonly hideEyebrow?: boolean;
}

function StateBlock({
  action,
  className,
  description,
  eyebrow,
  hideEyebrow = false,
  icon,
  title,
  tone = "empty",
  ...props
}: StateBlockProps) {
  const spec = TONES[tone];
  const Mark = spec.icon;

  return (
    <div
      data-state-tone={tone}
      role={spec.role}
      aria-live={spec.ariaLive}
      className={cn(
        /*
         * No minimum height. A block that says "there is nothing here" must not occupy more of the
         * screen than the thing it is standing in for: the released `EmptyState` reserves 12rem, and
         * on a workspace where absence is the normal state that is how the way in ends up below the
         * fold. It is as tall as its own words.
         */
        "flex flex-col items-start gap-2.5 rounded-xl border p-5 text-left sm:p-6",
        spec.container,
        className,
      )}
      {...props}
    >
      {/*
        Mark and word on ONE row. Stacked, they cost two rows to say one thing, and on a workspace
        whose ordinary state is absence that stacking is what pushes the actual capability off the
        screen. The mark is the tone's, and the word is the tone's; either alone identifies it.
      */}
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            spec.badge,
            tone === "loading" && "motion-safe:animate-pulse",
          )}
          aria-hidden="true"
        >
          {icon ?? <Mark className="size-4" />}
        </span>
        {hideEyebrow ? null : (
          <p className="text-label font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {eyebrow ?? spec.eyebrow}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-title font-semibold text-fg text-balance">{title}</h3>
        <p className="max-w-2xl text-body text-fg-secondary text-pretty">{description}</p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export { StateBlock };
