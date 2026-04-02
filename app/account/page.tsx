import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { AccountSettingsForm } from "@/components/account/account-settings-form";
import { BrandMasthead } from "@/components/brand/brand-masthead";
import { accountService } from "@/server/services/account-service";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/");
  }

  const account = await accountService.getAccountProfile(session.user.id);

  return (
    <main className="min-h-screen py-10 sm:py-12">
      <div className="container max-w-3xl space-y-6">
        <BrandMasthead
          description="Review the profile details your league memberships and homepage account controls use today."
          eyebrow="Account"
          title="Account Settings"
        />
        <AccountSettingsForm account={account} />
      </div>
    </main>
  );
}
