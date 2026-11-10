"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface DropdownItem {
  readonly label: React.ReactNode;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
}

interface DropdownProps {
  label: React.ReactNode;
  items: readonly DropdownItem[];
  align?: "start" | "end";
  className?: string;
}

/*
 * A menu button (WAI-ARIA APG). Enter, Space or ArrowDown opens on the first item, ArrowUp on the
 * last; arrows move, Home/End jump, Escape closes and returns focus to the button, Tab and an
 * outside press close it. Disabled items are skipped by the arrows and cannot be chosen.
 */
function Dropdown({ label, items, align = "end", className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const enabled = items.flatMap((item, i) => (item.disabled ? [] : [i]));

  const focusItem = (position: number) => {
    if (enabled.length === 0) return;
    const wrapped = (position + enabled.length) % enabled.length;
    itemRefs.current[enabled[wrapped]!]?.focus();
  };

  const openAt = (position: number) => {
    setOpen(true);
    requestAnimationFrame(() => focusItem(position));
  };

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const current = enabled.indexOf(itemRefs.current.findIndex((node) => node === document.activeElement));
    const moves: Record<string, number> = {
      ArrowDown: current + 1,
      ArrowUp: current - 1,
      Home: 0,
      End: enabled.length - 1,
    };
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    } else if (moves[event.key] !== undefined) {
      event.preventDefault();
      focusItem(moves[event.key]!);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <Button
        ref={triggerRef}
        variant="outline"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openAt(0);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openAt(-1);
          }
        }}
      >
        {label}
        <ChevronDown aria-hidden="true" className="size-4" />
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute top-full z-(--z-dropdown) mt-1 min-w-44 rounded-lg border border-border bg-surface-raised p-1 shadow-md",
            align === "end" ? "right-0" : "left-0"
          )}
        >
          {items.map((item, i) => (
            <button
              key={i}
              ref={(node) => {
                itemRefs.current[i] = node;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              aria-disabled={item.disabled || undefined}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
              className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-fg hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none disabled:cursor-not-allowed disabled:text-fg-muted"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { Dropdown };
