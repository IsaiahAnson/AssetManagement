import type { ReactNode } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getNavBadges } from "@/lib/dashboard";
import { readFlash } from "@/lib/flash";
import { redirect } from "next/navigation";
import { canActingUserWrite } from "@/lib/authz";
import { getActingUser } from "@/lib/session";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  // The proxy checks the cookie signature; this also catches a signed cookie
  // for a user who is no longer active.
  if (!(await getActingUser())) {
    redirect("/login");
  }
  const [badges, flash, canWrite] = await Promise.all([
    getNavBadges(),
    readFlash(),
    canActingUserWrite()
  ]);
  return (
    <AppLayout badges={badges} flash={flash} readOnly={!canWrite}>
      {children}
    </AppLayout>
  );
}
