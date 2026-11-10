"use client";

import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<React.ComponentProps<"button">, "onChange" | "role" | "type"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/* An on/off control. A <button role="switch"> keeps Space and Enter native; state is aria-checked. */
function Switch({ checked, onCheckedChange, className, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        /* `after:` widens the touch target to 36×36 without changing the drawn size. */
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent after:absolute after:-inset-2 after:content-['']",
        "transition-colors duration-(--dur-fast)",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-border-control",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "block size-4 rounded-full shadow-xs transition-transform duration-(--dur-fast)",
          /* On: the ink that reads on primary in both themes (white thumb on Dark's light blue is 2.5:1). */
          checked ? "translate-x-4 bg-on-primary" : "translate-x-0.5 bg-fg-inverse"
        )}
      />
    </button>
  );
}

export { Switch };
