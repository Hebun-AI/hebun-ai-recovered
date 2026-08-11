"use server";

import { redirect } from "next/navigation";

import { adminPassword, startSession } from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("devam") ?? "/admin");

  if (password !== adminPassword()) {
    return { error: "Parola hatalı." };
  }

  await startSession();
  redirect(next.startsWith("/admin") ? next : "/admin");
}
