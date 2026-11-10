"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Modal and Drawer are both the native <dialog> opened with showModal(): the browser makes the rest
 * of the page inert, traps Tab inside, moves focus in, sends Escape as `cancel`, and returns focus to
 * the opener on close. Both are controlled: `open` is the truth, `onClose` asks the owner to drop it.
 */
interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

function DialogShell({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "border border-border bg-surface p-0 text-fg shadow-lg backdrop:bg-overlay",
        className
      )}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-title font-semibold text-fg">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-fg-secondary">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-secondary hover:bg-surface-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm text-fg">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}

/* Centered; full width minus a 16px gutter on a phone, at most 32rem. */
function Modal({ className, ...props }: DialogProps) {
  return (
    <DialogShell
      {...props}
      className={cn("m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-lg rounded-xl", className)}
    />
  );
}

/* Docked to the right edge at full height; the full screen width on a phone. */
function Drawer({ className, ...props }: DialogProps) {
  return (
    <DialogShell
      {...props}
      className={cn("my-0 mr-0 ml-auto h-dvh max-h-none w-full max-w-md rounded-none border-y-0 border-r-0", className)}
    />
  );
}

export { Modal, Drawer };
