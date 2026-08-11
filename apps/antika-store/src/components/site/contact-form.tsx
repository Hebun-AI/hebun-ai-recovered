"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { sendMessage, type ContactState } from "@/app/(site)/iletisim/actions";

const INITIAL: ContactState = { status: "bos", message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "Gönderiliyor…" : "Mesajı gönder"}
    </button>
  );
}

export function ContactForm() {
  const [state, action] = useActionState(sendMessage, INITIAL);

  if (state.status === "basarili") {
    return (
      <div className="border border-verdigris/40 bg-verdigris/5 p-8">
        <p className="eyebrow text-verdigris">Alındı</p>
        <p className="display mt-3 text-[1.8rem] leading-tight">Teşekkürler.</p>
        <p className="mt-3 text-sm text-ink-soft">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="label-caps text-ink-faint">Adınız</span>
          <input name="name" required className="field mt-2" placeholder="Ad Soyad" />
        </label>
        <label className="block">
          <span className="label-caps text-ink-faint">E-posta</span>
          <input
            name="email"
            type="email"
            required
            className="field mt-2"
            placeholder="ornek@eposta.com"
          />
        </label>
      </div>

      <label className="block">
        <span className="label-caps text-ink-faint">Konu</span>
        <input
          name="subject"
          className="field mt-2"
          placeholder="Ekspertiz talebi / TRH-021 hakkında"
        />
      </label>

      <label className="block">
        <span className="label-caps text-ink-faint">Mesajınız</span>
        <textarea
          name="body"
          required
          rows={6}
          className="field mt-2 resize-y"
          placeholder="Parçanın fotoğrafını, ölçüsünü ve elinize nasıl geçtiğini yazarsanız daha hızlı yanıt veririz."
        />
      </label>

      {/* bot tuzağı — ekranda görünmez */}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      {state.status === "hata" ? (
        <p className="border border-oxblood/40 bg-oxblood/5 px-4 py-3 text-sm text-oxblood">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <SubmitButton />
        <p className="text-xs text-ink-faint">
          Bilgileriniz yalnız bu yazışma için kullanılır, üçüncü tarafla paylaşılmaz.
        </p>
      </div>
    </form>
  );
}
