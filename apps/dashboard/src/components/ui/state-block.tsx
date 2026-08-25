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
 * ── DENSITY IS PRESENTATION, AND ONLY PRESENTATION ───────────────────────────
 *
 * `density` changes padding, gap and mark size. It changes NO tone, NO wording, NO icon, NO border
 * treatment, NO role and NO aria-live — every signal above survives it untouched, which is the
 * whole reason it may exist at all. `comfortable` is the default and is byte-identical to the
 * released rendering, so the six consumers this phase does not touch cannot move.
 *
 * ── LAYOUT IS THE SAME BARGAIN, ONE STEP FURTHER ─────────────────────────────
 *
 * `layout` changes the ARRANGEMENT — whether the eyebrow sits under the mark or beside the title,
 * and whether the description reads at body or metadata size. It changes no tone, no wording, no
 * icon, no border treatment, no role and no aria-live either. `stack` is the default and is the
 * released rendering byte for byte.
 *
 * `row` exists for the case CMD-V4 found: a section whose ordinary answer is a SUCCESSFUL EMPTY,
 * where the block is the headline rather than a placeholder for missing content. Stacked, that
 * answer costs a mark row, a wrapped title and six lines of body copy before a Director learns the
 * one thing they came for. As a row it is the same five signals — mark, word, border, title,
 * sentence — arranged so the answer arrives first. It is not a smaller truth; it is the same truth
 * in the shape of a status line.
 *
 * It exists because absence is not always the main event on a surface. Where a block IS the answer
 * (`/knowledge` holds no records yet) it should occupy the room the answer would have. Where it is
 * a caption over a list that carries the actual content, the same block spends a fifth of a column
 * saying something the list is about to say six more times. `compact` is for the second case, and
 * it is a size, not a lesser truth: the same tone, the same words, the same mark.
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

export interface ToneSpec {
  /** The single word that names the reason. Never a synonym of another tone's word. */
  readonly eyebrow: string;
  readonly container: string;
  readonly badge: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly role?: "alert" | "status";
  readonly ariaLive?: "polite";
}

/**
 * The tone table, EXPORTED so a surface can arrange these five signals differently without
 * inventing a sixth set of them.
 *
 * ── WHY THIS IS AN EXPORT AND NOT A SIXTH PROP ───────────────────────────────
 *
 * CMD-FINAL needed the primary operating answer NOT to be a bordered card — a card is the right
 * shape for "there is nothing in this region", and the wrong shape for "here is the state of your
 * organization". Expressing that through StateBlock would have meant a third presentation axis on
 * top of `density` and `layout`, and a `frame: "bare"` that removes the border is a StateBlock that
 * has stopped being a block.
 *
 * So Command composes its own status line — and takes the WORD, the MARK and the BADGE from here,
 * unchanged. This is the distinction that matters: the AUTHORITY over what `empty` and
 * `unavailable` look like stays in this file, in one table, for every surface. Only the
 * ARRANGEMENT is Command's. A second table would be a second authority; a second layout is not.
 */
export const TONES: Readonly<Record<StateTone, ToneSpec>> = Object.freeze({
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

/**
 * How much room the block takes. Presentation only — see the header.
 *
 * `comfortable` restates the released classes EXACTLY, so the default path renders what it always
 * rendered rather than something that merely looks similar.
 */
export type StateDensity = "comfortable" | "compact";

interface DensitySpec {
  readonly container: string;
  readonly mark: string;
  readonly icon: string;
  readonly copy: string;
}

const DENSITIES: Readonly<Record<StateDensity, DensitySpec>> = Object.freeze({
  /*
   * THESE ARE THE RELEASED LITERALS, IN THE RELEASED ORDER, ON PURPOSE. Composing them out of a
   * shared base plus a density fragment produced the same class SET in a different ORDER — which
   * renders identically, and is still a worse guarantee than the one available for free. Written
   * out whole, the default path emits the released markup byte for byte, and the test that proves
   * it compares strings rather than reasoning about the cascade.
   */
  comfortable: {
    container: "flex flex-col items-start gap-2.5 rounded-xl border p-5 text-left sm:p-6",
    mark: "flex size-8 items-center justify-center rounded-lg",
    icon: "size-4",
    copy: "flex flex-col gap-1.5",
  },
  /* One step down on every axis of ROOM, and no step down on any axis of MEANING. */
  compact: {
    container: "flex flex-col items-start gap-2 rounded-xl border p-4 text-left",
    mark: "flex size-7 items-center justify-center rounded-md",
    icon: "size-3.5",
    copy: "flex flex-col gap-1",
  },
});

/**
 * How the block is ARRANGED. Presentation only — see the header.
 *
 * `stack` restates the released arrangement exactly. `row` is the executive status line: mark and
 * eyebrow flank the title on one line, and the sentence reads beneath at metadata size.
 *
 * THE ONE THING THIS TABLE MAY CARRY THAT `DENSITIES` MAY NOT is a step of the Hebun type scale for
 * the DESCRIPTION — `text-body` stacked, `text-meta` in a row — because arrangement is exactly what
 * decides whether a sentence is the content or the caption under it. It is a step of the released
 * scale, never a raw size, and `--fs-meta` is 13px, a pixel above CMD-V2's floor. Everything that
 * carries MEANING — tone, word, mark, border, role, live region — stays out of here, and the suite
 * asserts it.
 */
export type StateLayout = "stack" | "row";

interface LayoutSpec {
  /** Wraps mark + eyebrow + title. */
  readonly head: string;
  readonly title: string;
  readonly description: string;
  /** Whether the eyebrow renders beside the title rather than beside the mark. */
  readonly eyebrowBesideTitle: boolean;
}

const LAYOUTS: Readonly<Record<StateLayout, LayoutSpec>> = Object.freeze({
  stack: {
    head: "flex items-center gap-2.5",
    title: "text-title font-semibold text-fg text-balance",
    description: "max-w-2xl text-body text-fg-secondary text-pretty",
    eyebrowBesideTitle: false,
  },
  row: {
    head: "flex min-w-0 w-full items-center gap-2.5",
    title: "min-w-0 flex-1 text-title font-semibold text-fg text-balance",
    description: "max-w-2xl text-meta leading-5 text-fg-secondary text-pretty",
    eyebrowBesideTitle: true,
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
  /**
   * Room, not meaning. Defaults to `comfortable`, which is the released rendering unchanged.
   * `compact` is for a block that captions content rather than standing in for it.
   */
  readonly density?: StateDensity;
  /**
   * Arrangement, not meaning. Defaults to `stack`, which is the released rendering unchanged.
   * `row` is the executive status line — the answer on one line, the sentence beneath it.
   */
  readonly layout?: StateLayout;
}

function StateBlock({
  action,
  className,
  density = "comfortable",
  description,
  eyebrow,
  hideEyebrow = false,
  icon,
  layout = "stack",
  title,
  tone = "empty",
  ...props
}: StateBlockProps) {
  const spec = TONES[tone];
  const room = DENSITIES[density];
  const shape = LAYOUTS[layout];
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
        room.container,
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
      <div className={shape.head}>
        <span
          className={cn(
            room.mark,
            spec.badge,
            tone === "loading" && "motion-safe:animate-pulse",
          )}
          aria-hidden="true"
        >
          {icon ?? <Mark className={room.icon} />}
        </span>
        {/*
          THE EYEBROW MOVES; IT NEVER LEAVES. In a row it sits at the far end of the same line, so
          the reason-word is still on screen, still a word, still not a colour — the three things
          CMD-B1 relies on to keep "empty" and "unavailable" from ever looking alike. `hideEyebrow`
          remains the caller's decision in both arrangements, and Command spends it on neither of
          the two states where the distinction lives.
        */}
        {shape.eyebrowBesideTitle ? (
          <>
            <h3 className={shape.title}>{title}</h3>
            {hideEyebrow ? null : (
              <p className="shrink-0 text-label font-semibold uppercase tracking-[0.14em] text-fg-muted">
                {eyebrow ?? spec.eyebrow}
              </p>
            )}
          </>
        ) : hideEyebrow ? null : (
          <p className="text-label font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {eyebrow ?? spec.eyebrow}
          </p>
        )}
      </div>
      {shape.eyebrowBesideTitle ? (
        <p className={shape.description}>{description}</p>
      ) : (
        <div className={room.copy}>
          <h3 className={shape.title}>{title}</h3>
          <p className={shape.description}>{description}</p>
        </div>
      )}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export { StateBlock };
