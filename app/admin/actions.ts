"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  checkAdminPassword,
  createAdminToken,
} from "@/lib/admin-auth";

export interface AdminLoginState {
  error?: string;
}

/** Only ever bounce back to an in-app admin path, so `?next=` can't be used as an open redirect. */
function safeNext(next: string) {
  return next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

export async function adminLogin(
  _previous: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const password = String(formData.get("password") ?? "");
  if (!(await checkAdminPassword(password))) {
    // Slows down guessing without needing a shared rate-limit store.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: "Wrong code." };
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, await createAdminToken(), adminCookieOptions());

  redirect(safeNext(String(formData.get("next") ?? "")));
}

export async function adminLogout() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/");
}
