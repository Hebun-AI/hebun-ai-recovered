"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  readonly id: string;
  readonly label: React.ReactNode;
  readonly content: React.ReactNode;
}

interface TabsProps {
  items: readonly TabItem[];
  /** Uncontrolled start; defaults to the first item. */
  defaultValue?: string;
  "aria-label": string;
  className?: string;
}

/*
 * WAI-ARIA tabs with automatic activation: one tab is in the Tab order (roving tabindex); Left/Right
 * move and select, Home/End jump. Only the selected panel is rendered.
 */
function Tabs({ items, defaultValue, className, ...rest }: TabsProps) {
  const [selected, setSelected] = useState(defaultValue ?? items[0]?.id);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();
  const index = Math.max(0, items.findIndex((item) => item.id === selected));

  const select = (next: number) => {
    const wrapped = (next + items.length) % items.length;
    setSelected(items[wrapped]!.id);
    tabRefs.current[wrapped]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: items.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  };

  const current = items[index];
  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={rest["aria-label"]}
        onKeyDown={onKeyDown}
        className="flex max-w-full gap-1 overflow-x-auto border-b border-border"
      >
        {items.map((item, i) => {
          const active = i === index;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[i] = node;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${item.id}`}
              aria-selected={active}
              aria-controls={`${base}-panel-${item.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setSelected(item.id)}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-(--dur-fast)",
                "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-ring",
                active
                  ? "border-primary text-fg"
                  : "border-transparent text-fg-secondary hover:text-fg"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {current && (
        <div
          role="tabpanel"
          id={`${base}-panel-${current.id}`}
          aria-labelledby={`${base}-tab-${current.id}`}
          tabIndex={0}
          className="pt-4 focus-visible:outline-2 focus-visible:outline-primary-ring"
        >
          {current.content}
        </div>
      )}
    </div>
  );
}

export { Tabs };
