"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { login, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn w-full" disabled={pending}>
      {pending ? "Kontrol ediliyor…" : "Giriş yap"}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="devam" value={next} />

      <label className="block">
        <span className="label-caps text-ink-faint">Parola</span>
        <input
          name="password"
          type="password"
          required
          autoFocus
          className="field mt-2"
          placeholder="••••••••"
        />
      </label>

      {state.error ? (
        <p className="border border-oxblood/40 bg-oxblood/5 px-4 py-2.5 text-sm text-oxblood">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
