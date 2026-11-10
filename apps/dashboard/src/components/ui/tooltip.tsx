"use client";

import { cloneElement, useId, useState, type ReactElement } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  /** One focusable element (a button or link). It receives aria-describedby. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  side?: "top" | "bottom";
}

/*
 * A short description for a control. Opens on hover and on keyboard focus, closes on leave, blur
 * and Escape (WCAG 1.4.13), and stays open while the pointer is over it. Supplementary only: the
 * control must still carry its own accessible name.
 */
function Tooltip({ content, children, side = "top" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="relative inline-flex"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      {cloneElement(children, { "aria-describedby": id })}
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className={cn(
          "absolute left-1/2 z-(--z-tooltip) w-max max-w-60 -translate-x-1/2 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-fg shadow-md",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
        )}
      >
        {content}
      </span>
    </span>
  );
}

export { Tooltip };
