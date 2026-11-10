import { cn } from "@/lib/utils";

/*
 * Shared by Input and Select so every text-entry control has one height, border and focus ring.
 * Phones get 40px and 16px text (smaller text makes iOS zoom the page on focus); from `sm` the
 * control matches the 36px Button. The edge uses `border-control` (≥3:1 in Light and Dark); an
 * invalid field keeps its error colour through focus; a disabled one drops to the quiet border.
 */
export const fieldClasses = cn(
  "h-10 w-full min-w-0 rounded-lg border border-border-control bg-surface px-3 text-base text-fg sm:h-9 sm:text-sm",
  "placeholder:text-fg-muted transition-colors duration-(--dur-fast) enabled:hover:border-fg-muted",
  "focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-ring",
  "aria-invalid:border-error aria-invalid:focus-visible:outline-error",
  "disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-fg-muted"
);

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(fieldClasses, className)} {...props} />;
}

export { Input };
