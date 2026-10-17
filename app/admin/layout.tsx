import type { Metadata } from "next";
import type { ReactNode } from "react";
import { isOperator } from "@/lib/server/queries";
import { OperatorShell } from "@/components/admin/operator-shell";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Draftly · Operator",
  robots: { index: false, follow: false, nocache: true },
};

// Every /admin route: the login until the operator cookie is there, the
// shell around the page after. Pages check again and render nothing when
// signed out, so no operator data is read without the session.
export default async function OperatorLayout({ children }: { children: ReactNode }) {
  if (!(await isOperator())) return <LoginForm />;
  return <OperatorShell>{children}</OperatorShell>;
}
