import { cn } from "@/lib/utils";

/* Shared by Input and Select so every text-entry control has one height, border and focus ring. */
export const fieldClasses = cn(
  "h-9 w-full min-w-0 rounded-lg border border-border-strong bg-surface px-3 text-sm text-fg",
  "placeholder:text-fg-muted transition-colors duration-(--dur-fast)",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-ring",
  "aria-invalid:border-error",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-muted"
);

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(fieldClasses, className)} {...props} />;
}

export { Input };
