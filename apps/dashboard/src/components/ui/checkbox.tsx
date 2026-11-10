import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<React.ComponentProps<"input">, "type"> {
  label?: React.ReactNode;
}

/* A native checkbox tinted with the primary token; with `label`, the whole row is the click target. */
function Checkbox({ className, label, ...props }: CheckboxProps) {
  const box = (
    <input
      type="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer accent-primary",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring",
        "disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
  if (label === undefined) return box;
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-fg has-disabled:cursor-not-allowed has-disabled:text-fg-muted">
      {box}
      <span>{label}</span>
    </label>
  );
}

export { Checkbox };
