import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClasses } from "./input";

/*
 * A styled native <select>: the browser keeps keyboard, typeahead, screen-reader and mobile picker
 * behaviour, and the option list follows the page's `color-scheme` in Dark.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className="relative block min-w-0">
      <select className={cn(fieldClasses, "appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted"
      />
    </span>
  );
}

export { Select };
