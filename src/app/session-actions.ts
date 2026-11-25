"use server";

import { redirect } from "next/navigation";
import { setActingUser, clearActingUser, listSelectableUsers } from "@/lib/session";

// DEV-ONLY: records which seeded user you are acting as, then lands on the
// dashboard. No credential check (see lib/session.ts). Only ids shown in the
// login picker are accepted.
export async function signInAsAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "").trim();
  const allowed = await listSelectableUsers();
  if (!userId || !allowed.some((u) => u.id === userId)) {
    redirect("/login");
  }
  await setActingUser(userId);
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  await clearActingUser();
  redirect("/login");
}
