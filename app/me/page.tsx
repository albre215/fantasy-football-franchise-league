import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth-session";
import { OwnerDashboard } from "@/components/owner/owner-dashboard";
import { ownerService } from "@/server/services/owner-service";

export const dynamic = "force-dynamic";

export default async function MePage() {
  try {
    const user = await requireAuthenticatedUser();
    const dashboard = await ownerService.getOwnerDashboard(user.id);

    return <OwnerDashboard dashboard={dashboard} />;
  } catch {
    redirect("/");
  }
}
