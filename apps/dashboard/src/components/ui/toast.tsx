"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "info" | "success" | "error";

interface ToastInput {
  message: React.ReactNode;
  tone?: ToastTone;
}

interface ToastEntry extends Required<ToastInput> {
  readonly id: number;
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/** Shows a short, self-dismissing message. Must be used under a ToastProvider. */
export function useToast(): (toast: ToastInput) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>.");
  return show;
}

const TONE_CLASSES: Record<ToastTone, string> = {
  info: "border-l-info",
  success: "border-l-success",
  error: "border-l-error",
};

const DISMISS_AFTER_MS = 5000;

function ToastItem({ toast, onDismiss }: { toast: ToastEntry; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), DISMISS_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <li
      role={toast.tone === "error" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-3 rounded-lg border border-l-4 border-border bg-surface-raised px-4 py-3 text-sm text-fg shadow-md",
        TONE_CLASSES[toast.tone]
      )}
    >
      <div className="min-w-0 flex-1">{toast.message}</div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="flex size-6 shrink-0 items-center justify-center rounded text-fg-secondary hover:text-fg focus-visible:outline-2 focus-visible:outline-primary-ring"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

/*
 * The live region exists before any toast does, so a screen reader announces the first one. Toasts
 * stack bottom-right on a wide screen and span the width on a phone.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    setToasts((all) => [...all, { id, message: toast.message, tone: toast.tone ?? "info" }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <ol
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-(--z-toast) flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-96 [&>li]:pointer-events-auto"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </ol>
    </ToastContext.Provider>
  );
}
