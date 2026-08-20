import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface shadow-sm",
        className
      )}
      {...props}
    />
  );
}

/*
 * `CardHeader` becomes a ROW at `sm`, which is correct for its intended shape — a title block on
 * one side, an action on the other — and wrong for the shape 24 call sites across the product
 * actually pass it: `<CardTitle>` and `<CardDescription>` as two direct children. Those two become
 * row siblings and the title is squeezed into a narrow column beside its own description. Measured
 * on the Knowledge authoring card at a 520px column: a 62.5px-wide, 72px-tall title (three wrapped
 * lines) sitting alongside the sentence describing it.
 *
 * `stacked` is ADDITIVE and opt-in. The default is unchanged, so all 346 `Card` consumers and all
 * 24 of those header sites render exactly as they did; canonical surfaces pass `stacked` and get a
 * header that keeps a title above its description at every width. The remaining 23 sites are
 * recorded debt, not a silent fix — each belongs to the surface that owns it.
 */
function CardHeader({
  className,
  stacked = false,
  ...props
}: React.ComponentProps<"div"> & { stacked?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-5 sm:p-6",
        stacked ? "min-w-0" : "sm:flex-row sm:items-start sm:justify-between",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-base font-semibold leading-6 text-fg text-balance", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm leading-6 text-fg-secondary text-pretty", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-t border-border px-5 py-4 sm:px-6",
        className
      )}
      {...props}
    />
  );
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
