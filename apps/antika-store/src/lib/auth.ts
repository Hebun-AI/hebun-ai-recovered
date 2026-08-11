import { cookies } from "next/headers";

import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createSessionValue,
  isValidSession,
} from "./session";

export { ADMIN_COOKIE, adminPassword } from "./session";

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return isValidSession(store.get(ADMIN_COOKIE)?.value);
}

export async function startSession(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, await createSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
