"use client";

/** Silme gibi geri alınamaz işlemler için onay soran gönder düğmesi. */
export function ConfirmButton({
  children,
  message,
  className,
  formAction,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  /** Formun kendi action'ı yerine bu sunucu eylemine gönderir. */
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <button
      type="submit"
      className={className}
      formAction={formAction}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
