import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { AccountSettingsForm } from "@/components/account/account-settings-form";
import { accountService } from "@/server/services/account-service";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/");
  }

  const account = await accountService.getAccountProfile(session.user.id);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 py-16">
      <div className="container max-w-3xl space-y-6">
        <div className="space-y-3">
          <span className="inline-flex rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-foreground">
            Account
          </span>
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight text-balance">Account Settings</h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Review the profile details your league memberships and homepage account controls use today.
            </p>
          </div>
        </div>
        <AccountSettingsForm account={account} />
      </div>
    </main>
  );
}
