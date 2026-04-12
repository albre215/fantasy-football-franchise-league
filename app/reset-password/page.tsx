import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen py-10 sm:py-12" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
